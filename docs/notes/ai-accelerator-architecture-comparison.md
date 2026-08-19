---
title: "AI Accelerator Architecture Comparison"
description: "本文是项目的统一 coordinate system。它不做脱离 model、Data Type、batch、software 和 system boundary 的 peak ranking，而是比较四种 Architecture 怎样分配 compute、memory、Scheduling 和 Communication responsibility。"
outline: deep
products: ["NVIDIA GPU","Groq LPU/TSP","Tenstorrent Tensix","Google TPU"]
documentType: "比较研究"
topics: ["计算组织","调度","数据移动","软件栈"]
---

# AI Accelerator Architecture Comparison

最后核对日期：2026-08-10。

本文是项目的统一坐标系。它不做脱离 model、dtype、batch、software 和 system boundary 的“谁最快”排名，而是比较四种 architecture 怎样分配计算、存储、调度和通信责任。

比较对象：

- NVIDIA CUDA GPU：通用 parallel throughput baseline；
- Groq LPU/TSP：functional slicing 与 compiler time-space scheduling；
- Tenstorrent Tensix：open programmable core mesh 与 explicit NoC dataflow；
- Google TPU：XLA-compiled TensorCore/MXU systolic system 与 ICI Pod。

具体参数必须注明代际：GPU generation、Groq ISCA 论文/LPX、Tenstorrent Wormhole/Blackhole、TPU v1/v4/v6e/TPU7x 不能混为一个抽象芯片。

## 0. 四句话抓住核心

- **GPU**：用大量 SM、warp、cache/HBM 和动态 hardware scheduling 覆盖广泛 workload。
- **Groq**：把功能单元空间解聚成 slices，由 compiler 提前安排 tensor 在什么周期、什么位置流过芯片。
- **Tenstorrent**：把包含 matrix/vector engine、local SRAM、RISC-V 和 NoC 的 Tensix core 重复成 mesh，用 reader/compute/writer kernel 显式搬 tile。
- **TPU**：用 XLA 编译 ML graph，在 TensorCore 内让 MXU systolic array 执行矩阵 wavefront，并通过 HBM/VMEM 与 ICI Pod 扩展。

```text
GPU
[SM] [SM] [SM] [SM]
 hardware selects ready warps

Groq
[MEM slice] [SXM slice] [MXM slice] [VXM slice]
 compiler schedules streams through functions

Tenstorrent
[Tensix core]—NoC—[Tensix core]—NoC—[Tensix core]
 reader/compute/writer exchange tiles through CB

Google TPU
[TensorCore: MXU + vector + scalar]—ICI—[TensorCore]
 XLA-compiled graph drives systolic compute and collectives
```

## 1. 统一比较表

| 维度 | NVIDIA GPU | Groq LPU/TSP | Tenstorrent Tensix | Google TPU |
| --- | --- | --- | --- | --- |
| 基本计算组织 | 重复 SM | heterogeneous functional slices | 重复 locally heterogeneous Tensix core | one or more TensorCore per chip；MXU/vector/scalar |
| 矩阵单元 | SM 内 Tensor Core | MXM slice | Tensix matrix engine/FPU | MXU systolic array |
| 非矩阵计算 | CUDA scalar/SFU/vector paths | VXM/SXM/MEM | SFPU/vector + RISC-V control | vector unit + scalar unit |
| 编程抽象 | kernel/grid/block/thread/warp/stream | tensor stream、compiled graph、slice | core grid、tile、CB、reader/compute/writer | JAX/PyTorch-XLA graph、HLO、sharding、Pallas block |
| 调度核心 | runtime + dynamic block/warp scheduling | compiler time-space schedule | per-core kernel + CB/NoC synchronization | XLA graph schedule + MXU wavefront + runtime dispatch |
| 延迟隐藏 | occupancy、warp switching、async copy | cross-slice operation/data pipeline | reader/compute/writer overlap | fusion、HBM/VMEM pipeline、systolic wavefront、collective overlap |
| 片上存储 | registers、shared/L1、L2 | distributed SRAM、streaming register file | per-core L1 SRAM scratchpad | VMEM/SMEM/register path，代际相关 |
| 大容量 memory | HBM/GDDR | 早期 TSP 强调 SRAM；LPX 有 DDR5 system layer | GDDR6 | HBM |
| 数据移动 | load/store、coalescing、cache、shared staging | compiler placement/routing/stream | explicit NoC read/write/multicast | XLA buffer/layout + HBM/VMEM movement；Pallas 显式 block/DMA |
| 动态控制流 | 最强 | 更依赖 graph/shape 可预知 | RISC-V kernel 可编程，但 tile pipeline 仍偏规则 | XLA 支持 control/dynamic semantics，但编译 specialization 与 MXU 偏规则 |
| 低层开放性 | CUDA/PTX 开放接口；硬件/firmware 部分闭源 | 当前商业 compiler/ISA 不开放 | TT-Metalium/TT-NN/TT-MLIR 大量开源 | StableHLO/XLA/PJRT/Pallas 开放；TPU backend/ISA/RTL 不完整公开 |
| 单机互联 | NVLink/NVSwitch/PCIe | compiler-scheduled C2C；LPX system | Ethernet/fabric | ICI |
| 大规模系统 | multi-GPU cluster | GroqRack/LPX | Galaxy/supercluster | TPU slice/Pod/multi-slice |
| 典型优势 | 通用性、生态、training/HPC | predictable low-latency inference | explicit/open dataflow、training+inference | large-scale compiled training/inference、Pod integration |

## 2. “Core”与“Tile”不是同一层概念

### GPU

- SM 是物理 compute core cluster；
- CUDA Core 是 scalar execution lane/product term；
- Tensor Core 是 SM 内 matrix pipeline；
- software tile 是 block/warp 负责的数据块。

### Groq

- hardware tile 是 functional slice 沿物理方向重复的一段；
- 多个同功能 tile 组成 MXM/VXM/MEM/SXM slice；
- 它不是 GEMM software tile。

### Tenstorrent

- Tensix core 是 NoC mesh node；
- tensor tile 是 matrix/vector engine 的数据单位；
- core node 与 data tile 必须区分。

### TPU

- Google TensorCore 是 TPU chip 内较大的计算组织；
- MXU 是其中的 matrix unit；
- systolic array 的 PE 是局部 MAC element；
- XLA/Pallas block 是 software tiling；
- Google TensorCore 不等于 NVIDIA Tensor Core。

## 3. 同一个 MatMul + activation 怎样执行

考虑：

```text
Y = GELU(X × W + B)
```

### 3.1 GPU

1. framework/library/compiler 选择 GEMM/fused kernel；
2. blocks 分配到 SM，threads 组成 warp；
3. warp scheduler 动态选择 ready warp；
4. HBM data 经 cache/shared/register staging；
5. Tensor Core 做 MMA；
6. epilogue 融合 bias/GELU 或启动后续 kernel。

主要变量：block/warp tile、occupancy、coalescing、shared memory、register pressure、fusion、kernel choice。

### 3.2 Groq

1. compiler 将 X/W/B 映射到 MEM bank；
2. stream 按 direction/route 到 MXM；
3. MXM result 直接流向 VXM；
4. VXM 执行 bias/GELU；
5. SXM 必要时重排；
6. functional delay 与 transport delay 进入 time-space schedule。

主要变量：placement、routing、bank、stream、chaining、NOP、全图 overlap。

### 3.3 Tenstorrent

1. program/compiler 选择 core grid、DRAM/L1 layout 与 CB；
2. reader 从 DRAM 读 X/W 或 NoC multicast；
3. compute 等待 CB，unpack tile；
4. matrix engine accumulate；
5. SFPU/vector path 执行 activation；
6. pack 到 output CB；
7. writer 写回或发给下一个 core。

主要变量：core placement、shard、CB depth、DRAM bank、NoC multicast、unpack/math/pack balance。

### 3.4 TPU

1. framework program lowering 到 StableHLO/HLO；
2. XLA 做 fusion、layout、buffer 与 tiling；
3. X/W 从 HBM 进入 MXU/near-compute path；
4. A/B value 在 systolic array 中形成 wavefront；
5. vector unit 执行 bias/GELU；
6. result 保留给 fused consumer 或写回 HBM；
7. multi-device 时 GSPMD 插入 sharding/collective。

主要变量：MXU-friendly dimension、padding、fusion、HBM/VMEM bytes、sharding、collective、compile cache。

## 4. 四种不同的延迟隐藏哲学

```text
GPU：       当前 warp 等待 → 切换到另一个 ready warp
Groq：      当前 data item 在 VXM → 下一个 item 同时在 MXM/MEM
Tenstorrent: reader 搬 tile 2 → compute 算 tile 1 → writer 写 tile 0
TPU：       systolic wavefront + HBM/VMEM double buffer + fused graph/collective overlap
```

没有一种机制自动保证高利用率：

- GPU 可能被 occupancy、divergence、memory stall 限制；
- Groq 可能出现静态 schedule bubble、placement/routing constraint；
- Tensix 可能出现 CB empty/full、NoC/DRAM backpressure；
- TPU 可能被 fill/drain、padding、HBM/vector op 或 collective 限制。

## 5. 谁负责管理 memory

| 问题 | GPU | Groq | Tenstorrent | TPU |
| --- | --- | --- | --- | --- |
| 自动 cache | 重要 | 第一代公开 data path 刻意弱化 | local L1 不是 cache | HBM/VMEM 编译管理为主；具体代际内部不全公开 |
| 显式 scratchpad | shared memory | MEM SRAM/stream | per-core L1/CB | VMEM/SMEM/Pallas block |
| reuse 表达 | thread/block tiling、cache/shared | chaining 与 compiler stream | CB、local shard、multicast | XLA fusion/tiling、MXU wavefront、Pallas block |
| layout owner | library/compiler + programmer | compiler | TT-NN/TT-MLIR/kernel | XLA/GSPMD/Pallas |
| intermediate writeback | fusion 避免 HBM | stream forwarding | remote L1/CB 或 DRAM | XLA fusion/VMEM reuse |

共同规律：

> 峰值 compute 只有在数据复用、layout 和 intermediate lifetime 与硬件匹配时才有意义。

## 6. 编译器与低层入口

### GPU

```text
framework/compiler
→ CUDA libraries / Triton / PTX
→ driver/runtime
→ kernel on SM
```

GPU 的 low-level surface 成熟，但 kernel placement/warp issue 仍主要由 runtime hardware 完成。

### Groq

```text
model graph
→ lowering/layout/placement/routing/time scheduling
→ coordinated slice instruction streams
```

论文/专利公开方法，但商业 compiler、IR 和 binary interface 不完整公开。

### Tenstorrent

```text
framework
→ TT-Forge / TT-MLIR
→ TT-NN
→ TT-Metalium
→ RISC-V kernels + NoC + Tensix Engine
```

开发者可以直接修改 memory movement、CB 和 core mapping。

### TPU

```text
JAX / PyTorch-XLA / supported TensorFlow path
→ StableHLO / HLO
→ XLA + GSPMD
→ PJRT / libtpu
→ TPU executable

custom kernel:
Pallas → Mosaic TPU → TPU low-level program
```

XLA/StableHLO/PJRT 开源不代表完整 TPU backend、ISA 和 RTL 开源。

## 7. 多芯片系统

| 架构 | Scale-up | Scale-out/cluster | Software responsibility |
| --- | --- | --- | --- |
| GPU | NVLink/NVSwitch | InfiniBand/Ethernet | NCCL、TP/PP/DP/EP、runtime/compiler |
| Groq | C2C/source-routed network；LPX fabric | Groq system deployment | compiler placement、routing、deskew、system scheduler |
| Tenstorrent | on-board/chip Ethernet fabric | standard Ethernet Galaxy/supercluster | MeshDevice、sharding、collective、placement |
| TPU | ICI 3D mesh/torus | Pod/multi-slice over DCN | GSPMD、mesh/sharding、collective、XLA scheduling |

公平比较不能只看 aggregate link bandwidth。必须固定：

- topology；
- message size；
- collective algorithm；
- model parallel strategy；
- overlap；
- host/DCN boundary；
- failure/retry；
- P50/P99 step time。

## 8. Dynamic workload 与 programmability

从更通用到更依赖结构信息，可以建立一个粗略连续谱：

```text
GPU dynamic SIMT
    ↓
Tenstorrent programmable tile/core dataflow
    ↓
TPU XLA-compiled tensor graph + custom Pallas
    ↓
Groq compiler-scheduled functional pipeline
```

这不是绝对排名：

- Pallas 能表达 custom TPU kernel；
- Tensix RISC-V kernel 仍受 tensor engine/dataflow 约束；
- GPU graph compiler 也会做 aggressive fusion/specialization；
- Groq system 仍有 host/runtime/request scheduling；
- StableHLO 支持 dynamic dimension，但 backend cost 依旧存在。

应针对具体问题比较：dynamic shape、branch、gather/scatter、custom dtype、collective、compile latency 和 fallback。

## 9. Workload 适配倾向

### GPU

- broad training/inference；
- HPC/scientific computing；
- dynamic/custom workload；
- mature library 依赖；
- 强通用性和调试工具。

### Groq

- small batch/strict TPOT；
- graph/shape 可预知；
- low-jitter inference；
- LLM decode FFN/MoE；
- Rubin+LPX AFD/speculative path。

### Tenstorrent

- 希望开放 low-level dataflow；
- training 与 inference；
- 可显式 sharding 到 core/device mesh；
- standard Ethernet scale-out；
- 自定义 kernel/layout/NoC 研究。

### TPU

- JAX/XLA/PyTorch-XLA compiled workload；
- large dense/MoE training；
- Pod-scale SPMD；
- large-scale inference；
- embedding-heavy workload/SparseCore；
- shape/layout 能配合 MXU 的 tensor program。

这些是架构倾向，不是性能判决。

## 10. 异构协作边界

| 组合 | 已公开的细粒度协作 | 当前可信的通用边界 |
| --- | --- | --- |
| NVIDIA GPU + Groq 3 LPX | Rubin attention + LPX FFN/MoE AFD；LPX draft + GPU verify | layer/token-level supported product architecture |
| GPU + Tenstorrent | 没有同等级公开标准 | request pool、training→serving、stage/workflow |
| GPU + TPU | 没有共享 CUDA/TPU layer ABI | request pool、checkpoint/workflow、XLA source portability |
| TPU + Tenstorrent/Groq | 没有公开 fine-grained standard | service/model artifact boundary |

共同的安全假设：

> 如果没有公开 transport、layout、ownership、synchronization 和 failure semantics，就不要假设两个 accelerator 能在同一 layer 内低成本交换 tensor/KV state。

## 11. 公平实验方法

### 固定输入

- model revision；
- numerical quality，而不仅是格式名；
- batch/concurrency；
- input/output shape；
- LLM ISL/OSL/KV/prefix cache；
- training optimizer/global batch/convergence target；
- compiler/runtime/firmware；
- chip count/topology；
- host、network 与 power boundary。

### 分层测量

| 层级 | 指标 |
| --- | --- |
| Compute unit | useful MAC/FLOP、active lanes/PE、array/engine utilization |
| Memory | HBM/DRAM bytes、SRAM/VMEM reuse、layout conversion、stall |
| Graph | fusion、intermediate materialization、critical path |
| Network | collective bytes、link utilization、overlap、tail |
| Compile | compile/JIT time、cache hit、artifact、shape specialization |
| Request | TTFT、TPOT/ITL、P50/P99、goodput/SLO |
| Training | step time、MFU、convergence、checkpoint/recovery |
| System | throughput、power、cost、availability、failure domain |

### 不做的比较

- 不同 FP8/Block FP8/NVFP4 峰值直接相除；
- SRAM bandwidth 与 HBM bandwidth 直接相除；
- 云 API tokens/s 反推裸 chip；
- 不同模型、量化、batch、OSL 的 tokens/s 横比；
- product projection 当第三方 benchmark；
- TPU v1 参数代表 Ironwood；
- early TSP 参数代表 LPX；
- Wormhole kernel 结果代表 Blackhole/Galaxy。

## 12. 项目实验映射

| 实验 | 主要架构概念 | 对照问题 |
| --- | --- | --- |
| `labs/static_scheduler/` | Groq functional/transport delay 与 static resource queue | static NOP vs runtime stall |
| `labs/tensix_pipeline/` | Tensix reader/compute/writer 与 CB backpressure | explicit producer-consumer overlap |
| `labs/systolic_array/` | TPU MXU wavefront、fill/drain、partial tile | systolic utilization vs GPU/Tensix tiling |
| future `warp_scheduler/` | GPU ready-warp/occupancy | dynamic latency hiding |
| future `mesh_collective/` | TPU ICI、TT mesh、GPU collective、Groq C2C | topology-aware communication |
| future `heterogeneous_router/` | accelerator pool/SLO routing | fine-grained vs request-level cooperation |

最终项目应把同一个 Transformer block 映射为：

1. GPU block/warp/Tensor Core + HBM/shared-memory model；
2. Groq MEM/SXM/MXM/VXM time-space schedule；
3. Tenstorrent core grid + CB + NoC mapping；
4. TPU HLO fusion + MXU tile + VMEM/HBM + GSPMD sharding。

然后比较谁管理 compute、memory、communication 和 schedule，而不是只给出一个总时间。

## 13. 延伸阅读

- GPU 与 Groq 基础：[LPU 与 GPU](lpu-vs-gpu.md)
- Groq/Tenstorrent/GPU 深入对照：[三架构机制级对照](groq-tenstorrent-comparison.md)
- Tenstorrent 对 GPU SM 的机制替代：[Tenstorrent 做了什么减法](tenstorrent-rethinking-gpu-sm.md)
- Google TPU 架构：[Systolic Array、XLA 与 Pod](google-tpu-architecture.md)
- Rubin + Groq 3 LPX：[异构推理与负载分配](nvidia-groq3-heterogeneous-inference.md)
- 全部官方与论文来源：[资料目录](../sources/catalog.md)

## 共享参考

- [术语表](../glossary.md)：跨文章反复使用的执行、存储、同步和软件栈概念。
- [资料目录](../sources/catalog.md)：官方资料、论文、开源项目与统一证据边界。
