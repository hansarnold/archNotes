# AI Accelerator Architecture 多架构学习路线

建议按 18-22 周推进。时间不是硬约束，重点是每阶段同时产出 GPU、Groq、Tenstorrent 和 Google TPU 四份可比较的执行模型。

## 第 0 阶段：补齐基础

主题：流水线、SIMD/vector、VLIW、dataflow、scratchpad、bank conflict、systolic array、NoC。

完成标准：能够解释 cache 与显式管理 SRAM 的差异，以及动态调度与静态调度各自把复杂度放在哪里。

对照阅读：`notes/ai-accelerator-architecture-comparison.md`。区分 GPU software tile、Groq hardware tile、Tenstorrent tensor tile/core node、TPU MXU/PE 与 XLA/Pallas block。

## 第 1 阶段：单芯片 TSP 微架构

阅读 ISCA 2020，按 Figure 1-6 重建：

- functional slice 与 tile；
- 20 个 superlanes、16-lane tile 和 320-element vector；
- MEM、SXM、MXM、VXM、ICU；
- 东西向 data flow 与南北向 instruction flow；
- streaming register file 与片上 SRAM。

交付物：给 `notes/architecture.md` 增加自己的结构图和术语表。

## 第 1N 阶段：NVIDIA GPU 软硬件流水调度与同步

阅读 `notes/nvidia-gpu-synchronization.md`，先跟踪 work pipeline 与 warp instruction pipeline，再把“同步”放回每一个放行 gate：

- host submission、stream/graph dependency、grid dispatch 与 block/cluster placement；
- Green/Execution Context 的 SM/work-queue partition、context event 与“减少干扰不等于保证并发”；
- resident/active、eligible、issued warp 的区别，以及 occupancy 如何影响 latency hiding；
- fetch/decode、dependency readiness、scheduler selection、execution/memory pipeline 与 completion；
- warp scheduler 与 scoreboard 如何判断 instruction 是否 ready；
- Nsight Compute 的 not selected、long/short scoreboard、math pipe throttle、barrier、membar 与 drain 如何映射回流水；
- Independent Thread Scheduling、active mask、participant set 与 warp `*_sync` collective；
- `__syncwarp`、`__syncthreads`、CTA/cluster barrier 的 participant 与 scope；
- `cuda::atomic_ref` 的 atomicity、memory order、thread scope，以及 wait/notify、latch 与 hot-spot serialization；
- fence 的 acquire/release/SC semantic 与 CTA/GPU/system scope；
- atomic flag 为什么需要正确的 release/acquire，而 `volatile` 不能替代同步；
- `mbarrier` 的 phase、arrival count、tx-count 与 arrive/wait separation；
- `cp.async`、TMA、async proxy、double buffering 和 `cuda::pipeline`；
- `cp.async`/WGMMA/tcgen 的 async group、specialized wait 与 target-generation 边界；
- Cooperative Groups 的 subgroup/cluster/grid、PDL、CDP parent-child completion；
- Blackwell Cluster Launch Control 怎样通过 async cancellation、mbarrier 与 proxy handoff 实现 block/cluster work stealing；
- stream-ordered allocation lifetime、host/Unified Memory access 与 memory synchronization domain；
- signal、CUDA event、counting/timeline semaphore、cross-device event、NCCL 与 NVSHMEM completion 的边界。

实验：写 global-load dependency chain，用 Nsight Compute 观察 active/eligible/issued warp 与 scoreboard/pipeline stall；实现 warp collective、atomic aggregation 与双缓冲 async copy；最后为 PDL、stream-ordered allocation 和可用的 multi-GPU operation 标出不同 completion event。

交付物：对一个 `launch → residency → global load/TMA → shared → async MMA → global store → remote consumer → storage reuse` 流水标出 participant、readiness、atomicity、completion、visibility、ownership 与 lifetime 分别由谁保证，并解释为什么其他机制不能直接替代它。

## 第 2 阶段：ISA 与指令流

阅读 ISCA 2020 Section III 和 ISA 专利：

- 每个 functional slice 的独立 instruction queue；
- VLIW bundle 与 slice-specific discrete instructions；
- `d_func`、`d_skew` 和 transport delay；
- NOP、Repeat、IFetch、Sync/Notify、SetVL；
- instruction staggering 与 logical time。

实验：运行 `labs/static_scheduler/`，再添加 resource collision 和 stream capacity 检查。

## 第 2T 阶段：Tensix core 与 TT-Metalium

阅读 `notes/tenstorrent-architecture.md` 和 TT-Metalium single-core labs：

- Tensix Engine、RISC-V controllers、local L1 SRAM；
- reader、compute、writer 三 kernel 模型；
- circular buffer 的 wait/reserve/push/pop；
- unpack、matrix/vector math、pack；
- device DRAM、NoC address 与 tile layout。

实验：运行 `labs/tensix_pipeline/`，分别制造 reader-bound、compute-bound 和 writer-backpressure。

## 第 2G 阶段：Google TPU 与 systolic array

阅读 `notes/google-tpu-architecture.md`、TPU v1 论文与当前 Cloud TPU system architecture：

- TPU chip、Google TensorCore、MXU、vector/scalar unit；
- `128 × 128` 与 `256 × 256` systolic array 的代际边界；
- operand wavefront、PE reuse、array fill/drain；
- HBM、VMEM、SMEM 与 host memory；
- SparseCore、ICI、slice 与 Pod；
- TPU7x dual-chiplet 与 framework device exposure；
- TPU 8i/8t 只记录 announced direction，不与 TPU7x 混用参数。

实验：运行 `labs/systolic_array/`，分别 sweep K、M/N partial tile 和 array dimension，解释 output padding、wavefront utilization 与 combined utilization。

## 第 3 阶段：编译器

沿专利中的管线建立编译器心智模型：

```text
model graph → DAG → rewrite/lowering → memory/layout
→ resource allocation → time-space schedule → assembly/binary
```

重点学习：DAG、拓扑排序、list scheduling、modulo scheduling、liveness、buffer allocation、cost model、约束求解、指令打包。

交付物：扩展本地 scheduler，使其输出每个 resource 的 instruction queue 和 NOP 区间。

Tenstorrent 对照：跟踪 `TT-Forge → TT-MLIR → TT-NN → TT-Metalium`，理解 tensor layout 如何编码 device/core grid、memory space 和 sharding。交付一张相同 matmul 在 TTIR、TTNN 和 Metal kernel 中的 lowering 图。

TPU 对照：跟踪 `JAX/PyTorch-XLA → StableHLO/HLO → XLA → GSPMD → PJRT/libtpu`，区分 high-level IR、SPMD partition、runtime API 与未完整公开的 TPU ISA。再用 Pallas/Mosaic 观察 custom kernel 如何显式面对 block、VMEM、DMA 和 semaphore。

## 第 4 阶段：推理运行时与框架

研究编译期与运行期的边界：

- framework model 如何进入 compiler front-end；
- compiled program、weights、inputs 如何由 host 装载；
- PCIe、device SRAM 与执行启动；
- 动态 shape、sequence length 和 host-side preprocessing；
- 单芯片与多芯片 program image 的差异。

交付物：画出 BERT 从 host input 到 device output 的完整时序图，并标出哪些信息公开、哪些未知。

Tenstorrent 对照：画出 `host → MeshCommandQueue → device DRAM → reader → CB → compute → CB → writer`，并标出 host object 与 device data/kernel 的边界。

TPU 对照：画出 `framework → trace/lowering → HLO compile → PJRT dispatch → HBM/VMEM → MXU/vector → outfeed`，记录 first-step compile time、steady-state step time 与 compilation cache。

## 第 5 阶段：软件优化

精读 ASAP 2022 BERT 论文：

- GEMM 与 GELU/LN/Softmax 重叠；
- VXM ALU chaining；
- SXM on-the-fly reorder/mask；
- quantize/dequantize 融合；
- weight preloading 与 MXM 利用率；
- scratchpad 最小化与 intermediate forwarding。

交付物：在纸面或 scheduler 中分别实现 unfused 与 fused schedule，比较 makespan 和中间 buffer 生命周期。

Tenstorrent 对照：实现 multi-core matmul 的 DRAM 重复读取与 NoC multicast 两种流量模型，比较 CB depth、L1 占用和 NoC bytes。

TPU 对照：比较 unfused/fused HLO，记录 intermediate HBM bytes、padding、MXU utilization 和 compile time；再设计一个 Pallas HBM→VMEM double-buffered block pipeline。

## 第 6 阶段：多芯片网络与 topology

阅读 ISCA 2022：

- global shared address space 如何由分布式 SRAM 构成；
- source routing 与 software-scheduled link；
- 物理链路延迟、deskew、Send/Receive；
- tensor/model/pipeline parallelism；
- 计算负载与 data movement 的联合平衡。

交付物：给本地 scheduler 增加 `C2C_LINK` resource 和 hop latency，模拟两芯片流水。

Tenstorrent 同时学习：MeshDevice、replicated/sharded tensor、all-gather/broadcast、chip Ethernet fabric 和 Galaxy。交付物是把同一 tensor-parallel matmul 分别映射到 Groq C2C schedule 与 Tensix mesh collective。

TPU 同时学习：GSPMD、logical mesh、ICI 3D torus、slice、Pod 和 multi-slice DCN。交付物是把同一 sharded matmul 映射到 TPU HLO collective，并比较 ICI、Tenstorrent Ethernet、GPU NVLink/NCCL 与 Groq C2C 的 topology/overlap 责任。

## 第 7 阶段：Rubin GPU + Groq 3 LPX 异构推理

阅读 `notes/nvidia-groq3-heterogeneous-inference.md`，把早期 TSP 的静态排程知识放到 2026 年 AFD 系统中：

- Rubin GPU 负责 prefill、KV cache 和 decode attention；
- Groq 3 LPX 负责 decode FFN、MoE expert 和部分 pointwise；
- 每 token 的 intermediate activation 如何成为 GPU↔LPX 图切分边界；
- 为什么 AFD 不等于传统 prefill/decode disaggregation；
- request routing、gang admission、rate matching 与 tail latency；
- 产品架构已公布，但公开 Dynamo LPX backend/recipe/ABI 仍不完整的边界。

交付物：给 scheduler 增加 `GPU_ATTN`、`LPX_FFN`、`G2L_LINK`、`L2G_LINK` resources，对比 GPU-only 与 AFD 在不同 ISL、OSL、batch 和链路延迟下的 crossover。

Tenstorrent 对照：实现 GPU pool 与 Tenstorrent pool 的 request-level router，研究 model support、queue、SLO、cost、session affinity 和 fallback；不要假设存在公开 GPU↔Tensix layer-level AFD。

TPU 对照：把 TPU slice 作为第四种独立 resource pool，研究 compile artifact、shape family、queue、topology、SLO 和 fallback；不要从 XLA 同时支持 GPU/TPU 推断存在 layer-level GPU↔TPU execution ABI。

## 最终项目

选择一个小型 Transformer block，完成：

1. 算子 DAG；
2. tensor shape 与数值格式；
3. Groq MEM/SXM/MXM/VXM 映射与静态 instruction/resource schedule；
4. Tenstorrent core grid、tile、CB、NoC 与 reader/compute/writer mapping；
5. GPU kernel/block/warp、HBM/shared-memory baseline；
6. TPU HLO fusion、MXU tile/wavefront、HBM/VMEM 与 GSPMD sharding；
7. 四者的 buffer lifetime、SRAM/VMEM/HBM/GDDR 占用和 data movement；
8. fused/unfused、dynamic/static 与 pipeline 性能模型；
9. 单芯片到多芯片的四种扩展方案；
10. GPU+LPX AFD 与 GPU/Tenstorrent/TPU request-level routing；
11. 相同 model/quality/shape/topology 的公平 benchmark 方案；
12. 明确列出公开事实、教学假设和无法验证项。
