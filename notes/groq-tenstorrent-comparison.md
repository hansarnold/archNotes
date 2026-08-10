# Groq LPU、Tenstorrent Tensix 与 NVIDIA GPU：机制级对照

最后核对日期：2026-08-07。

本文不做脱离上下文的“谁最快”排名，而是回答：

1. Groq 与 Tenstorrent 各自怎样组织 compute、memory、instruction 和 data movement？
2. 它们分别把复杂度放在 compiler、runtime、programmer 还是 hardware？
3. 面向训练、推理、多芯片和 GPU 协作，应怎样选择研究问题与实验？

如果要集中理解 Tenstorrent 为什么不沿用 CUDA thread/warp/SM 的完整组织，请先读独立专题 [Tenstorrent 做了什么减法？从 NVIDIA GPU SM 到 Tensix Dataflow Core](tenstorrent-rethinking-gpu-sm.md)。本文继续承担三架构的横向对照。

包含 Google TPU 的统一四架构坐标系见 [AI Accelerator 架构总览](ai-accelerator-architecture-comparison.md)。

比较对象必须注明代际：

- Groq：用 ISCA 2020/2022 TSP 论文建立机制，以 2026 NVIDIA Groq 3 LP30/LPX 说明当前产品方向；
- Tenstorrent：以当前 Blackhole 为主，Wormhole 作为公开教程与实践平台；
- GPU：以现代 NVIDIA CUDA GPU 的公开编程模型为代表，不泛化到所有 GPU。

## 0. 一句话抓住三者差异

- **GPU**：把大量相似 SM、warp、cache/HBM 和强动态调度组织成通用吞吐机器。
- **Groq**：把不同功能单元空间解聚为 functional slices，让 compiler 提前安排全图的时间、位置和数据流。
- **Tenstorrent**：把含 matrix/vector engine、local SRAM、RISC-V controller 和 NoC 的 Tensix core 重复成 mesh，让 software 显式编写 reader/compute/writer 数据流。

```text
GPU
[heterogeneous SM] [heterogeneous SM] [heterogeneous SM]
       runtime hardware schedules ready warps

Groq
[MEM slice] [SXM slice] [MXM slice] [VXM slice]
       compiler schedules data through functional pipeline

Tenstorrent
[Tensix core]—NoC—[Tensix core]—NoC—[Tensix core]
       per-core reader/compute/writer kernels exchange tiles
```

Groq 与 Tenstorrent 都重视显式数据移动和片上 SRAM，但不能因此称为同一种 dataflow architecture。

## 1. 主要架构对照

| 维度 | Groq TSP/LPU | Tenstorrent Tensix | NVIDIA CUDA GPU |
| --- | --- | --- | --- |
| 基本重复/空间单元 | 同功能 tile 组成 MEM/SXM/MXM/VXM slice | 每个 Tensix core 内含 local SRAM、matrix/vector engine、RISC-V control、NoC | SM，内部含 warp scheduler、register、shared memory、Tensor/ALU/LDST 等 |
| 全芯片组织 | chip-wide heterogeneous functional slices | grid of locally heterogeneous cores | grid of locally heterogeneous SMs |
| 编程抽象 | tensor stream、functional slice、compiled program | tile、core grid、reader/compute/writer kernel、CB、NoC、MeshDevice | kernel、grid、block、thread、warp、stream |
| 指令控制 | slice-specific queues；compiler 安排 logical time | per-core RISC-V kernel 控制 data movement 与 Tensix Engine | warp instruction；hardware scheduler 选择 ready warp |
| 数据移动 | compiler 安排 MEM bank、stream、SXM、C2C 和到达周期 | kernel 显式发 NoC read/write/multicast，通过 local CB 同步 | load/store、cache、shared-memory staging、async copy 等 |
| 片上存储 | 大量显式管理 SRAM、streaming register file | per-core L1 SRAM scratchpad，Blackhole 约 1.5 MB/core | registers、per-SM shared/L1、shared L2 |
| 外部存储 | 早期公开芯片强调 SRAM；LPX 增加 DDR5 系统层 | GDDR6 device DRAM + local SRAM | HBM/GDDR + cache hierarchy |
| 延迟隐藏 | compiler 构建跨 slices/ops 的静态流水 | reader、compute、writer 与 NoC/CB producer-consumer pipeline | 大量 resident warps 与动态切换 |
| 同步 | 编译期时序、Sync/Notify、multi-chip deskew | CB wait/push/pop、register acquire/commit、NoC barrier/semaphore | barrier、event、atomic、warp/block/grid sync |
| 动态性 | 更依赖 shape/graph 可预知 | kernel 与 runtime 更可编程；仍需显式 layout/placement | 最强动态硬件调度和控制流支持 |
| 开放性 | 论文、专利公开机制；当前 compiler/ISA 不开放 | TT-Metalium、TT-NN、TT-Forge、TT-MLIR 开源 | CUDA 编程接口广泛，底层硬件/firmware 多为闭源 |
| 产品重点 | 低延迟推理、确定性、Groq 3 AFD/LPX | training + inference、开放 kernel、mesh scale-out | 通用训练、推理、HPC、graphics 与成熟生态 |

## 2. “Tile”在三种语境中不同

### Groq hardware tile

ISCA 2020 中的 tile 是 functional slice 沿纵向重复的一段物理硬件，例如一个 MXM tile 或 VXM tile。多个 tile 组成覆盖完整 vector width 的 slice。

### Tenstorrent tensor tile

TT-Metalium 中 tile 首先是 matrix/vector engine 的数据单位。常见示例是 `32 × 32` elements；tile 存在 CB、register 和 tiled tensor layout 中。Tensix core 本身也可能被文档非正式称为 grid tile，但学习时应明确是“core node”还是“tensor data tile”。

### GPU software tile

CUDA/GEMM 中的 tile 通常是 thread block/warp 负责的数据分块，不是一个固定物理 core。

因此看到 `tile` 必须先问：

```text
physical hardware block?
NoC grid node?
tensor storage tile?
software work tile?
```

## 3. 同一个 MatMul + activation 怎样运行

考虑：

```text
Y = GELU(X × W + B)
```

### 3.1 GPU

1. runtime 启动 GEMM/fused kernel；
2. block 被分配到 SM，warp scheduler 动态选择 ready warp；
3. tile 从 HBM/cache 搬到 shared memory/register；
4. Tensor Core 计算；
5. epilogue 可能融合 bias/GELU；
6. 依靠 occupancy、warp switching 和 cache 隐藏 latency。

主要优化问题：coalescing、tiling、shared memory、register pressure、occupancy、fusion、kernel selection。

### 3.2 Groq

1. compiler 把 X/W 放到 MEM bank；
2. stream 经数据路径到 MXM；
3. MXM 输出不必完整写回，继续流向 VXM；
4. VXM 完成 bias/GELU；
5. SXM 必要时重排；
6. 所有 slice instruction 与 transport delay 被写入 time-space schedule。

主要优化问题：placement、stream direction、functional/transport delay、chaining、bank/layout、NOP、全图 overlap。

### 3.3 Tenstorrent

1. host 为参与 core 创建 DRAM/L1 buffer 与 CB；
2. reader kernel 从 DRAM 读取 X/W tile，或通过 NoC multicast 共享；
3. compute kernel 等待 input CB，unpack 到 registers；
4. matrix engine 累积 output tile；
5. SFPU/compute path 执行 activation；
6. pack 到 output CB；
7. writer 写回 DRAM 或发到下一个 core。

主要优化问题：core grid、tile layout、CB depth、DRAM bank、NoC multicast、sharding、unpack/math/pack balance、reader/compute/writer overlap。

## 4. 调度责任放在哪里

```text
GPU：
graph/compiler → kernels → runtime → hardware block/warp scheduling

Groq：
graph → lowering/layout/placement/routing/time schedule
      → coordinated slice instruction streams

Tenstorrent high-level：
framework → TT-Forge/TT-MLIR → TT-NN → TT-Metalium programs

Tenstorrent low-level：
host program explicitly chooses cores/buffers/kernels
→ RISC-V reader/compute/writer + NoC + CB synchronization
```

### 4.1 Groq 的极端

Groq 将更多跨算子和跨资源决定前移到 compiler，以减少 runtime reactive scheduling 和 jitter。代价是 compiler 必须拥有精确的硬件、network 和 timing model。

### 4.2 Tenstorrent 的位置

Tenstorrent 不是 GPU 式“只写大量 threads”，也不是 Groq 式“开发者只看到最终全图静态 program”。TT-Metalium 暴露 device kernels、core placement、NoC 和 SRAM，开发者能显式构造 dataflow；TT-Forge/TT-MLIR 则尝试自动完成更高层 lowering。

### 4.3 GPU 的适应性

GPU hardware 可以在 warp stall 时选择其他 ready warp，更自然地处理动态 shape、控制流、unpredictable latency 和广泛 workload。代价是更复杂的 dynamic scheduler、state、cache hierarchy 和性能波动来源。

## 5. SRAM-first 的相似与不同

相似点：

- 都强调显式管理 on-chip SRAM；
- 都希望中间结果直接流向下一个消费者；
- 都把 data movement 当成性能模型的一等资源；
- 都通过 pipeline overlap 减少 compute idle；
- 都不应被简化成“没有 cache 的 GPU”。

差异点：

| 问题 | Groq | Tenstorrent |
| --- | --- | --- |
| SRAM 空间 | MEM slices/系统级分布式 SRAM | 每 Tensix core 独立 L1 SRAM + device GDDR6 |
| producer-consumer | chip-wide streams，compiler 安排到达 | local circular buffers，kernel wait/push/pop |
| 数据重排 | SXM functional slice | NoC movement、layout op、unpack/pack、TT-NN/Metal kernel |
| 计算位置 | op 类型天然对应 MXM/VXM 等 slice | programmer/compiler 选择 Tensix core grid，每个 core 有 matrix/vector engine |
| 外存依赖 | 初代论文工作集偏 on-chip；LPX 有 DDR5 层 | 常规执行显式 DRAM↔L1 streaming |

## 6. 多芯片扩展

### 6.1 Groq

ISCA 2022 描述 software-scheduled C2C、source routing、global shared address space 和 runtime deskew。Groq 3 LPX 将 256 颗 LP30 作为协调的低延迟推理系统。

研究重点：

- link 进入 compiler schedule；
- hop latency 和 arrival time；
- layer/model/pipeline partition；
- deterministic synchronization；
- 计算与通信联合 placement。

### 6.2 Tenstorrent

Tenstorrent 从单 device 就使用 MeshDevice abstraction；tensor 可以 replicated/sharded，TT-NN 提供 collective，芯片通过 Ethernet/fabric 连接。Galaxy Blackhole 进一步扩为 32 ASIC 系统和 multi-server supercluster。

研究重点：

- logical mesh 与 physical topology；
- tensor layout/sharding；
- all-gather、broadcast、reduce 等 collective；
- NoC 与 chip-to-chip Ethernet 的层级差异；
- core、chip、server 三层 load balance。

### 6.3 与 GPU multi-GPU 的对照

GPU 常通过 NVLink/NVSwitch/NCCL 构建 TP、PP、DP、EP；Tenstorrent 希望把 core mesh 的编程思路延伸到标准 Ethernet scale-out；Groq 则强调 compiler-scheduled network 与确定性。

三者不能只比较 aggregate link bandwidth。必须看 collective pattern、message size、topology、software overhead、overlap 和 tail latency。

## 7. 编译器与软件开放性

| 层级 | Groq | Tenstorrent | NVIDIA GPU |
| --- | --- | --- | --- |
| Framework 接入 | 商业 compiler/runtime；公开细节有限 | TT-Forge frontends | PyTorch/JAX/XLA/TensorRT 等成熟生态 |
| Graph/IR | 专利/论文可见 pipeline，真实 IR 未公开 | TT-MLIR dialect/source 开放 | MLIR/XLA/TensorRT/torch compiler 多层生态 |
| Op library | 商业实现 | TT-NN 开源 | cuBLAS/cuDNN/TensorRT 等 |
| Low-level kernel | 当前商业 SDK 不公开完整机制 | TT-Metalium C++/RISC-V/NoC/CB | CUDA C++/PTX，硬件细节部分抽象 |
| Profiler/visualizer | 公开资料有限 | TT-NN visualizer/perf report/tt-smi 等 | Nsight/DCGM 等成熟工具 |

这使两条学习路线互补：

- Groq 更适合从论文、专利和系统模型研究 compiler-scheduled hardware；
- Tenstorrent 更适合阅读 source、运行 kernel、修改 memory/dataflow 并验证；
- GPU 提供成熟基线，帮助判断显式 dataflow 是否真正减少了 memory/launch/scheduling cost。

## 8. Workload 适配性

### Groq 更值得研究的场景

- batch 小、严格 per-token latency；
- graph/shape 可预知；
- 全图能在 functional slices 间形成长流水；
- 大型 LLM decode FFN/MoE；
- 与 Rubin GPU 组成 AFD 或 speculative decoding。

### Tenstorrent 更值得研究的场景

- 需要开放 low-level kernel 与自定义 dataflow；
- training 与 inference 都要覆盖；
- tensor 可显式 sharding 到 core/device mesh；
- 希望用标准 Ethernet scale out；
- 视频、语言、vision 等多类模型，而不只低延迟 LLM decode。

### GPU 更自然的场景

- 成熟训练、autograd、optimizer 和 collective；
- 动态控制流、custom op 和广泛 HPC；
- 软件兼容优先；
- 大 HBM、强 batching 和现成优化库；
- 需要最成熟 profiling/debugging 工具。

这些是架构倾向，不是性能结论。Tenstorrent 官方把 Galaxy 定位为 training + inference；Groq 3 LPX 公开定位主要是 inference。具体模型仍须实测。

## 9. 与 GPU 的配合矩阵

| 配合方式 | Groq + GPU | Tenstorrent + GPU | 当前结论 |
| --- | --- | --- | --- |
| 独立 device pool/request routing | 可行 | 可行 | 最通用；按模型支持、SLO、成本路由 |
| GPU training → accelerator serving | 可行 | 可行，TT-Forge/TT-NN 路径更开放 | 用 model artifact/version 作为边界 |
| GPU P/D disaggregation | Dynamo GPU↔GPU 已公开 | GPU↔TT 没有标准 KV ABI | 不要假定跨厂商 KV 可直接兼容 |
| Attention–FFN AFD | Rubin attention + LPX FFN 是正式产品架构 | 没有公开 GPU↔Tensix AFD 标准 | Groq 3 独有的当前研究重点 |
| Speculative draft/verify | LPX draft + Rubin verify 已公布 | 可研究，但没有同等级官方跨设备路径 | Tenstorrent 先做服务/模型级实验 |
| Multi-modal stage pipeline | 取决于支持模型与 transfer | 可按 embedding/tensor 边界自研 | 必须验证 layout、dtype、transport |
| 同一同步训练 world | LPU 当前不适用 | TT 支持自身 training；与 CUDA 混合 world 未公开 | 不把 TT 当 NCCL rank |
| 独立异步评估 | 可行 | 可行 | 最低耦合、最易工程落地 |

关键差异：

> Groq 3 被 NVIDIA 明确设计成 Rubin inference pipeline 的专用低延迟伙伴；Tenstorrent 当前更像可独立运行训练/推理、也可作为数据中心第二种 compute pool 的开放通用 AI accelerator。

Tenstorrent 官方所说“drop into an existing GPU fleet”应先解释为基础设施和资源池级共存，而不是未经证明的 layer-level coherent execution。

## 10. 应怎样做公平实验

### 10.1 固定条件

- 完全相同的 model revision；
- 相同 numerical quality，而不仅是格式名称；
- 相同 input/output shape；
- LLM 固定 ISL、OSL、batch、concurrency、KV/prefix cache；
- training 固定 global batch、optimizer、loss curve 和 convergence target；
- 包含 host、device memory、interconnect 和系统功耗；
- 标注 compiler/runtime/firmware 版本。

### 10.2 分解指标

| 层级 | 指标 |
| --- | --- |
| Kernel | compute time、DRAM bytes、SRAM reuse、NoC/stream bytes、utilization |
| Graph | fusion、layout conversion、intermediate writeback、critical path |
| Request | TTFT、TPOT/ITL、P50/P99、tokens/s/user |
| System | aggregate throughput、goodput/SLO、power、cost、failure rate |
| Compile | compile/JIT time、artifact size、shape specialization、cache hit |

### 10.3 不做的比较

- Groq FP8 PFLOPS ÷ Tenstorrent Block FP8 TFLOPS；
- SRAM aggregate bandwidth 直接除 HBM/GDDR bandwidth；
- 云 API TPS 反推裸芯片；
- 不同模型、量化和 output length 的“tokens/s”横比；
- 产品页投影当成第三方 benchmark。

## 11. 项目实验映射

| 实验 | Groq 学习目标 | Tenstorrent 学习目标 | GPU 对照 |
| --- | --- | --- | --- |
| `static_scheduler` | functional delay、transport delay、resource queue | 不直接模拟 TT | 静态 schedule vs warp scheduling |
| `tensix_pipeline` | 对照 producer-consumer chaining | reader/compute/writer、CB backpressure | async copy/compute pipeline |
| 未来 `noc_mapping` | C2C source routing | NoC unicast/multicast、core placement | shared memory/cache/collective |
| 未来 `heterogeneous_router` | GPU+LPX AFD gang admission | GPU/TT request pool routing | GPU-only/P-D baseline |
| 未来 `compiler_ir` | 专利 pipeline 教学 IR | TT-MLIR layout/lowering trace | MLIR/XLA/CUDA graph |

推荐最终项目不再只映射一个 Transformer block 到 Groq，而是完成三份实现模型：

1. Groq MEM/SXM/MXM/VXM time-space schedule；
2. Tenstorrent core grid + CB + NoC mapping；
3. GPU kernel/block/warp + memory hierarchy baseline。

然后对同一 workload 比较计算、存储、通信和调度责任，而不是只比较总时间。

## 12. 主要来源

### Groq/NVIDIA

- Groq ISCA 2020：<https://groq.humain.ai/wp-content/uploads/2024/02/2020-Isca.pdf>
- Groq ISCA 2022：<https://groq.humain.ai/wp-content/uploads/2023/05/GroqISCAPaper2022_ASoftwareDefinedTensorStreamingMultiprocessorForLargeScaleMachineLearning-1.pdf>
- Groq ASAP 2022：<https://groq.humain.ai/wp-content/uploads/2022/10/Groq_ASAP2022_BestPaper.pdf>
- NVIDIA Groq 3 LPX：<https://developer.nvidia.com/blog/inside-nvidia-groq-3-lpx-the-low-latency-inference-accelerator-for-the-nvidia-vera-rubin-platform>

### Tenstorrent

- Documentation：<https://docs.tenstorrent.com/>
- TT software stack：<https://docs.tenstorrent.com/getting-started/tt-software-stack.html>
- TT-Metalium lab/architecture：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html>
- TT-NN：<https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/about.html>
- TT-MLIR：<https://docs.tenstorrent.com/tt-mlir/overview.html>
- Blackhole/Wormhole cards：<https://tenstorrent.com/en/hardware/cards>
- Galaxy：<https://tenstorrent.com/en/hardware/galaxy>
- 2026 公司、IP 与异构部署方向：<https://tenstorrent.com/newsroom/tenstorrent-sets-new-performance-records-launches-tt--ascalon-s>

### GPU background

- CUDA Programming Guide：<https://docs.nvidia.com/cuda/cuda-programming-guide/index.html>
- CUDA Best Practices Guide：<https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/>

## 术语表

| 术语 | 概念 |
| --- | --- |
| Functional slicing | Groq 将同类功能单元聚集为 slice 的空间组织。 |
| Time-space schedule | 同时决定 operation 执行周期和物理资源位置的 schedule。 |
| Tensix mesh | 由 NoC 连接的 Tensix core/device grid。 |
| Circular buffer | Tenstorrent local SRAM 中连接 producer/consumer kernel 的 FIFO。 |
| SIMT | GPU 让一个 warp 中多线程执行同一指令的模型。 |
| Scratchpad | 由 software/compiler 显式管理的片上存储，不是自动 cache。 |
| Dynamic scheduling | runtime hardware 根据 ready state 选择工作，例如 GPU warp scheduling。 |
| Static scheduling | compiler 提前决定资源和时序；Groq 将此推进到全图和 network。 |
| AFD | Attention–FFN Disaggregation，Rubin GPU attention 与 Groq 3 LPX FFN/MoE 的 layer 内协作。 |
| MeshDevice | Tenstorrent 统一单 device 与多 device 的 runtime abstraction。 |
| Request-level routing | 在完整请求边界选择 GPU、Groq 或 Tenstorrent pool。 |
| Stage-level pipeline | 在 encoder/decoder 等较粗 graph boundary 连接不同设备。 |
| Fine-grained heterogeneous execution | 在每 layer/token 或更细粒度跨设备执行；需要明确 ABI、transport 和同步支持。 |
