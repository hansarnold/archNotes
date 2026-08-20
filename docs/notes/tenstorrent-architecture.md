---
title: "Tenstorrent：Tensix 架构、编程模型与软件栈"
description: "本文把 Tenstorrent 纳入本项目的第二条 AI accelerator 研究主线。范围聚焦："
outline: deep
products: ["Tenstorrent Tensix"]
documentType: "架构专论"
topics: ["Dataflow core","NoC","TT-Metalium"]
---

# Tenstorrent：Tensix 架构、编程模型与软件栈

最后核对日期：2026-08-07。

本文把 Tenstorrent 纳入本项目的第二条 AI accelerator 研究主线。范围聚焦：

- Blackhole 与 Wormhole Tensix processor；
- Tensix core、local SRAM、matrix/vector engine 和片上 NoC；
- TT-Metalium、TT-NN、TT-Forge 与 TT-MLIR；
- 单芯片、多芯片 mesh、Galaxy 系统及与 GPU 的系统级配合。

关于“Tenstorrent 是否相当于删去 GPU SM 中对 AI 冗余的部分”，独立专题 [Tenstorrent 做了什么减法？从 NVIDIA GPU SM 到 Tensix Dataflow Core](tenstorrent-rethinking-gpu-sm.md) 会逐项比较 warp、thread state、dynamic scheduling、cache、CUDA scalar pipeline 与 Tensix 的替代机制。

Tenstorrent 还开发并授权 Ascalon RISC-V CPU IP，但它不是本文的主要研究对象。需要区分：**Tensix 是 AI compute architecture，Ascalon 是通用高性能 CPU architecture。**

## 0. 结论先行

Tenstorrent 的核心思路可以概括为：

> 在二维 NoC 上排列大量 Tensix core；每个 core 都拥有本地 SRAM、数据移动控制器、矩阵/向量引擎和可编程 RISC-V 控制处理器。程序显式地把 tile 从 device DRAM 搬到 core-local SRAM，通过 circular buffer 让 reader、compute、writer 三条流水并发，再把结果送往 DRAM 或其他 core。

它与 GPU、Groq 的差异不是“有多少 TOPS”，而是把可编程性和调度责任放在不同位置：

| 架构 | 基本空间组织 | 主要调度方式 | 低层开发者能看到什么 |
| --- | --- | --- | --- |
| NVIDIA GPU | 重复 SM，warp/block 并行 | 硬件动态 warp 调度 + CUDA runtime/compiler | kernel、thread/block、shared memory、streams |
| Groq TSP/LPU | MEM/SXM/MXM/VXM functional slices | 全图编译器 time-space schedule | 公开论文中的 stream/slice/指令流；当前商业编译器不开放 |
| Tenstorrent Tensix | 重复 Tensix core 的二维 mesh；每个 core 内含多类功能 | host command queue + 每 core 的 reader/compute/writer device kernels + 显式同步 | RISC-V kernel、NoC、L1 SRAM、circular buffer、tile 和 core placement |

因此，Tenstorrent 是研究“开放、显式、分布式 tile dataflow”的好平台；Groq 是研究“编译器主导、确定性、功能切片流水”的好对象。

## 1. 当前硬件研究范围

Tenstorrent 的技术与产品可以分为五层，本项目以 AI accelerator 为中心，同时记录相邻业务，避免把公司、芯片、板卡和软件混成同一个概念：

| 层级 | 代表 | 本项目范围 |
| --- | --- | --- |
| AI compute IP | Tensix / Tensix Core | 核心研究：matrix/vector engine、SRAM、NoC、RISC-V control |
| Accelerator ASIC/card | Blackhole p100/p150、Wormhole n150/n300 | 核心研究：芯片代际、device DRAM、PCIe、板间互联 |
| System/cloud | QuietBox、Galaxy、supercluster、Tenstorrent Cloud | 核心研究：mesh、fabric、multi-chip 和可复现实验入口 |
| Software/compiler | TT-Metalium、TT-NN、TT-Forge、TT-MLIR | 核心研究：从 framework 到 kernel 的开放软件栈 |
| General-purpose CPU IP | Ascalon / Ascalon S | 相邻研究：只在 heterogeneous host/agent system 需要时展开 |

Tenstorrent 同时销售/部署系统并授权 IP。产品形态和开放软件是其架构策略的一部分，但本文不会把公司宣传中的模型覆盖率或相对性能直接当作独立验证结果。

### 1.1 Blackhole：当前主线

截至核对日期，Tenstorrent 的 PCIe card 页面将 Blackhole 列为当前最强 Tensix processor。Blackhole p100a/p150a/p150b 的公开共同规格包括：

- 120 个 Tensix core；
- 16 个 chip-level “big RISC-V” core；
- 180 MB SRAM；
- 1.35 GHz AI clock；
- 664 TFLOPS Block FP8；
- 300 W total board power；
- PCIe 5.0 x16。

p100a 配置 28 GB GDDR6、448 GB/s；p150 配置 32 GB GDDR6、512 GB/s，并提供 4 个被动 QSFP-DD 800G 端口用于 Blackhole card 之间互联。

这里有两个容易混淆的“RISC-V”：

1. 每个 Tensix core 内用于 data movement 和 compute pipeline 控制的小型 RISC-V processor；
2. Blackhole 芯片额外公开的 16 个 “big RISC-V” core。

二者不应合并计数，也不能把 RISC-V controller 的数量当成 tensor compute core 数。

### 1.2 Wormhole：可实践的上一代

官方将 Wormhole 称为上一代技术，但 n150/n300 仍在销售并受支持：

- n150：单颗 Wormhole processor，最高 160 W；
- n300：两颗 Wormhole processor，最高 300 W；
- 可通过板间连接形成 multi-chip mesh；
- 支持 TT-Metalium 与高层软件栈。

本项目建议：

- 用 Blackhole 理解当前系统方向、Galaxy 和 scale-out；
- 用 Wormhole 的公开教程和硬件建立可复现实验；
- Grayskull 只作为历史代际，官方已停止当前软件支持，不作为新实验基线。

### 1.3 Galaxy：从 core 到机架

Tenstorrent Galaxy Blackhole 是 6U、32 颗 Blackhole ASIC 的系统。官方产品页公开：

| 资源 | Galaxy Blackhole |
| --- | --- |
| Accelerators | 32 × Blackhole ASIC |
| Compute | 23 PFLOPS Block FP8 |
| Accelerator SRAM | 6.2 GB @ 2.9 PB/s |
| Accelerator DRAM | 1 TB GDDR6 @ 16 TB/s |
| Accelerator fabric | 每 ASIC 10 × 400 GbE；系统聚合 32 TB/s |
| Cluster scale-out | 最多 56 × 800 GbE QSFP-DD；聚合 11.2 TB/s |
| Form factor | 6U air-cooled |

这些都是厂商产品规格，不等于任意模型的可持续吞吐。`Block FP8` 也不能与 Groq FP8、NVIDIA NVFP4 峰值直接做倍数比较。

## 2. Tensix processor 的空间组织

一个 Tenstorrent accelerator 通常以 PCIe device 连接 host：

```text
Host CPU / host DRAM
        │ PCIe
        ▼
Device DRAM (GDDR6)
        │
        ▼
2D NoC grid
├── Tensix core
├── Tensix core
├── DRAM controller nodes
├── Ethernet nodes
└── PCIe / management nodes
```

关键不是所有网格节点都相同，而是它们共享可寻址、可路由的二维 NoC。Tensix core、DRAM controller、Ethernet、PCIe 和管理节点占据不同坐标。

对 kernel developer 而言，一个 NoC 地址可以理解为：

```text
(x coordinate, y coordinate, local address)
```

这使 data movement 成为程序的一部分：从哪个 DRAM bank、哪个 core-local SRAM、经过哪种 unicast/multicast 到哪里，都可以显式表达。

## 3. 一个 Tensix core 内部有什么

官方 TT-Metalium 教程把一个 Tensix core 描述为四类主要资源：

```text
Tensix core
├── local L1 SRAM
├── two NoC routers / endpoints
├── Tensix Engine
│   ├── matrix engine / FPU
│   ├── vector engine / SFPU
│   ├── unpacker
│   ├── packer
│   └── tile register files
└── RISC-V controllers
    ├── reader/data movement
    ├── writer/data movement
    └── unpack / math / pack control
```

这里的 RISC-V processor 主要发出控制命令，不是亲自完成大规模矩阵乘。真正的 tile math 由 Tensix Engine 完成。

### 3.1 Local SRAM 不是 cache

Tenstorrent 文档经常把 core-local SRAM 称为 `L1`，但明确说明它**不是硬件自动管理的 cache**。它是 scratchpad/working memory：

- kernel code、circular buffer 和 tile 数据占用本地 SRAM；
- 程序显式从 device DRAM 或其他 core 搬数据；
- developer/compiler 负责容量、生命周期、bank、sharding 和复用；
- NoC 只能访问允许作为数据移动端点的共享 SRAM 区域，不能随意 DMA 私有 stack variable。

用 card 级 180 MB SRAM 除以 120 个启用的 Tensix core，可得到约 1.5 MB/core 的平均数量级；这是帮助建立容量直觉的推导值，不替代具体芯片的 memory map 与可用容量。不要把这些 SRAM 理解成所有 core 共享、硬件自动替换的一块 L1 cache。

### 3.2 Tile 是原生计算单位

TT-Metalium 示例通常使用 `32 × 32` element tile，matrix/vector engine 从 source registers 读取 tile，在 destination registers 中产生结果。Tensor 可以采用 row-major 或 tile layout；进入计算引擎前常需要 tilize、padding、sharding 和数据格式转换。

应区分：

- logical tensor shape；
- padded physical shape；
- tile shape；
- 每 core shard shape；
- mesh/device distribution。

当前 TT-MLIR 用 layout attribute 显式编码 tensor 如何映射到 devices、cores 和 memory。不同 op/engine 对 tile shape 有约束，所以不能把一个示例的 `32 × 32` 无限泛化为所有数据路径。

## 4. TT-Metalium 的三 kernel 流水

典型 operation 在每个 participating Tensix core 上运行三类协作 kernel：

![Reader kernel 经 NoC 把 tile 填入 Input CB，Compute 等待 ready tile 后 unpack、计算并 pack 到 Output CB，Writer 再经 NoC 写出；每个 CB 的 empty slot 与 ready tile 状态决定何时转移和归还 ownership](../assets/diagrams/tenstorrent-architecture-01.svg "Reader、Compute 与 Writer 通过 local SRAM 中的 circular buffer ownership 交接形成重叠流水。")

### 4.1 Reader

Reader kernel 通过 NoC 将 tile 从 DRAM 或远端 core SRAM 读入本地 circular buffer。它在生产新 tile 前必须确认 buffer 有空位。

### 4.2 Compute

Compute kernel 等待 input circular buffer 中有足够 tile，然后：

1. unpack tile 到 Tensix Engine source registers；
2. 发出 matrix/vector operation；
3. 在 destination registers 累积或生成结果；
4. pack 结果到 output circular buffer。

虽然开发者写的是一个 compute kernel source，文档说明 compiler 会为 unpack、math 和 pack 控制生成多个 RISC-V binary。

### 4.3 Writer

Writer 等待 output circular buffer 中出现 ready tile，再通过 NoC 写回 DRAM 或送往下一个 core。

### 4.4 为什么 circular buffer 是核心抽象

Circular buffer 是 local SRAM 中的 producer-consumer FIFO。常见同步操作表达：

- producer 等待空位、保留空间、push ready tile；
- consumer 等待 tile、读取、pop 已消费 tile；
- compute 对 destination register 执行 acquire/commit；
- packer 执行 wait/release。

当 buffer 容量、reader latency、compute latency 和 writer latency 匹配时，可以形成：

```text
reader:  tile 2
compute: tile 1
writer:  tile 0
```

这与 Groq 的 functional-slice pipeline 目标相似，都是重叠数据移动与计算；但 Tenstorrent 将这一流水暴露为 per-core kernels、NoC 和 circular buffer 协议，而 Groq 公开模型更强调全图编译得到的跨 slice time-space schedule。

## 5. NoC、多 core 与数据复用

Tensix processor 的性能不仅取决于 matrix engine，还取决于是否减少重复 DRAM 流量。

### 5.1 Unicast 与 multicast

多 core matmul 的简单实现可能让每个 core 重复从 DRAM 读取相同 tile。更好的实现是：

1. 一个 core 从 DRAM 读取；
2. 通过 NoC multicast 把 tile 写入多个接收 core 已预留的 SRAM/CB；
3. 接收 core 在本地复用 tile；
4. 计算和下一批 multicast 重叠。

官方教程说明每个 Tensix core 可使用两套 NoC 实例，reader/writer 默认映射到不同 NoC；高级 kernel 可以重新分配以平衡 read/write traffic。

### 5.2 Core placement 是性能问题

要同时考虑：

- core grid shape；
- DRAM bank 到 core 的距离和争用；
- multicast rectangle；
- reader/writer 分别使用的 NoC；
- L1 circular buffer 容量；
- uneven tile partition；
- sharded tensor 的下一算子消费位置。

因此 TT-Metalium 优化不能只问“用了多少 core”，还要问“tile 在哪里、经过什么路径、被复用多少次”。

## 6. Host、runtime 与执行

TT-Metalium host program 通常负责：

- 打开 `MeshDevice`；
- 分配 device DRAM/L1 buffer；
- 创建 `Program`；
- 指定 core range 与 kernel；
- 设置 compile-time/runtime arguments；
- JIT compile kernel；
- 经 mesh command queue 上传 tensor、dispatch program、读回结果。

当前 API 将单设备也表示为 `1 × 1 mesh`。这样从一个 chip 扩展到多个 chip 时，可以保留统一的 mesh/device 抽象。

Command queue 是异步提交与顺序管理机制；它不等于 GPU warp scheduler。Tenstorrent device 上真正的并发来自：

- 多个 Tensix core；
- core 内 reader/compute/writer；
- NoC async operation；
- circular buffer producer-consumer；
- 多 device collective/fabric。

## 7. 软件栈

这套软件栈可以按“谁负责降低哪一层抽象”来阅读。前一层能接收模型，不等于所有 op、shape、dtype 和 training path 都已稳定：

| 层级 | 责任与边界 |
| --- | --- |
| PyTorch / JAX / ONNX 等 model frontend | 提供模型与 tensor graph 入口；实际支持范围仍受 op、shape、dtype 和 training path 限制。 |
| TT-Forge | 作为 MLIR-based end-to-end compiler stack 连接 model frontend 与 Tenstorrent lowering；当前官方标记为 public beta。 |
| TT-MLIR | 用 `TTIR`、`TTNN`、`D2M`、`TTKernel` 和 `TTMetal` 等 dialect，将 logical op 逐层映射到 layout、device/core grid、memory space、kernel 与 runtime artifact。 |
| TT-NN | 提供 Python/C++ neural-network op API 与库，是 model developer 与 low-level kernel 之间的主要中间层。 |
| TT-Metalium | 提供 low-level SDK、runtime 和 kernel 接口，直接暴露 RISC-V device kernel、Tensix engine、L1/DRAM、circular buffer、NoC、core placement 与 mesh dispatch。 |
| Device hardware | 由 Tensix core、SRAM、NoC、DRAM 和 mesh 承载最终的 kernel execution 与 data movement。 |

### 7.1 TT-Forge

TT-Forge 是 MLIR-based end-to-end compiler stack，目标是从 PyTorch、JAX、ONNX 等框架进入 Tenstorrent stack。当前官方页面将其标为 public beta，因此模型通过前端并不自动代表所有 op、shape、dtype、training path 都已稳定。

### 7.2 TT-MLIR

TT-MLIR 提供多层 dialect：

- `TTIR`：较高层 tensor operation；
- `TTNN`：接近 TT-NN API 的 tensor dialect；
- `D2M`：向低层 device/metal 映射的中间层；
- `TTKernel` / `TTMetal`：接近 kernel 和 Metal runtime 的低层表示。

研究重点是跟踪：

```text
logical op
→ tensor layout
→ device/core grid
→ memory space and sharding
→ TT-NN/Metal operation
→ kernel and runtime artifact
```

### 7.3 TT-NN

TT-NN 是建立在 TT-Metalium 上的开源 neural-network op library，提供 Python/C++ API、200+ operations、custom op、mesh device、graph trace 和 parameter cache。它是模型开发者与 low-level kernel 之间的主要中间层。

### 7.4 TT-Metalium

TT-Metalium 是 low-level open-source SDK，直接暴露：

- RISC-V device kernel；
- Tensix matrix/vector engine API；
- L1/DRAM allocation；
- circular buffer；
- NoC unicast/multicast/barrier/semaphore；
- core placement 与 mesh dispatch。

这层是 Tenstorrent 相对 Groq 最适合动手研究的部分：可以在真实硬件上看到并改变 data movement、buffer 和 kernel mapping。

## 8. 多芯片与 Galaxy

TT-NN 和 TT-Metalium 使用 mesh abstraction 统一单芯片、多芯片：

- tensor 可以 replicated 或 sharded 到 mesh；
- 支持 all-gather、all-broadcast 等 collective；
- chip 间通过 Ethernet/fabric 连接；
- Galaxy 将 32 颗 ASIC 组成机箱级系统；
- 更大部署继续通过标准 Ethernet scale out。

这不意味着“任意 core-to-core 通信与片上 NoC 一样快”。研究时必须区分：

| 层级 | 典型资源 | 代价 |
| --- | --- | --- |
| core 内 | registers、local SRAM、CB | 最低 |
| chip 内 | NoC 到其他 core/DRAM node | 显式路由与争用 |
| chip 间 | Ethernet link / fabric | 更高延迟和同步成本 |
| host/device | PCIe | 应减少频繁往返 |
| rack/cluster | external Ethernet | 需要 collective、topology 和 fault handling |

## 9. 典型优化问题

### 9.1 Memory/layout

- row-major 与 tile layout 转换；
- DRAM interleaved、L1 sharded 与 replicated placement；
- padding 是否浪费 compute；
- CB 深度是否足够隐藏 latency；
- tensor reshard 是否成为主开销。

### 9.2 Compute/data movement overlap

- reader、compute、writer 是否达到 steady state；
- unpack/math/pack 是否平衡；
- matrix engine 与 SFPU 是否串行等待；
- writer 是否因 output CB 满而反压 compute；
- reader 是否因 input CB 满而停顿。

### 9.3 NoC

- DRAM tile 是否被多个 core 重复读取；
- multicast 是否提高复用；
- NOC0/NOC1 是否失衡；
- placement 是否导致热点 link；
- semaphore/barrier 是否过细。

### 9.4 Multi-device

- data、tensor、pipeline parallel 如何选；
- collective payload 与计算是否重叠；
- model state 是否适合 replicate；
- mesh topology 是否与 logical sharding 对齐；
- chip 间 fabric 是否成为瓶颈。

## 10. Tenstorrent 与 GPU 如何配合

与 Groq 3 不同，当前公开资料没有定义 NVIDIA GPU 与 Tensix 在同一个 Transformer layer 中执行类似 AFD 的标准路径。Tenstorrent 官方强调 Galaxy 可独立部署或加入现有 GPU fleet，但这首先表示系统级共存，不自动意味着共享 CUDA stream、NCCL rank、KV cache ABI 或 unified memory。

当前最可信的配合模式是：

| 模式 | GPU | Tenstorrent | 边界 |
| --- | --- | --- | --- |
| 请求级路由 | CUDA 优化、动态/高 batch workload | 已验证 TT 模型、成本/容量或主权部署 | 完整请求 |
| GPU 训练 → TT serving | pretraining/SFT 或现有训练流水 | 编译并部署 checkpoint | model artifact/version |
| 异步评估 | 训练继续运行 | 独立 checkpoint inference/eval | storage/message queue |
| 多模态 stage pipeline | GPU encoder 或不受支持 stage | TT 上受支持的后续 stage | embedding/tensor；需验证 ABI |
| 数据中心资源池 | GPU pool | Galaxy/Tensix pool | gateway/scheduler |

以下能力不能从“标准 Ethernet”或“开放软件”直接推出：

- GPU 与 Tensix 共享 coherent address space；
- Tensix 直接加入 NCCL communicator；
- GPU prefill 后把原生 KV cache 无转换交给 TT decode；
- 每 layer 在 CUDA kernel 与 TT-Metal kernel 间自动迁移；
- NVIDIA Dynamo 已有官方 Tenstorrent backend。

如果未来出现明确 transport、layout 和 runtime integration，再把它升级为细粒度实验。在此之前，本项目把 GPU+Tenstorrent 定位为**服务级、模型阶段级和训练/部署流水级异构**。

## 11. 建议的实践路线

### 无 Tenstorrent hardware

1. 运行本项目 `labs/tensix_pipeline/`，理解 bounded circular buffer 的反压；
2. 用 TT-Metalium 文档重写 reader/compute/writer 伪代码；
3. 建立 tile/layout/NoC traffic 计算表；
4. 阅读 tt-metal/tt-mlir source，跟踪一个 elementwise 或 matmul op；
5. 使用 Tenstorrent Cloud 或硬件后再替换模拟参数。

### 有 Wormhole/Blackhole hardware

1. `tt-smi` 确认 board、firmware、core grid；
2. 从 single-core eltwise、single-core matmul 开始；
3. 扩展到 multi-core partition；
4. 加入 local reuse 与 NoC multicast；
5. 用 TT-NN Visualizer/性能报告检查 per-core memory、layout 和 data movement；
6. 最后再运行完整模型，避免只看到 high-level API 而不理解 kernel。

## 12. 公开边界与主要来源

### 官方文档

- Tenstorrent 文档入口：<https://docs.tenstorrent.com/>
- 软件栈总览：<https://docs.tenstorrent.com/getting-started/tt-software-stack.html>
- TT-Metalium single-core matmul lab：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html>
- TT-Metalium multi-core multicast lab：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab3/lab3.html>
- TT-Metalium advanced topics：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/index.html>
- TT-NN overview：<https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/about.html>
- TT-MLIR overview：<https://docs.tenstorrent.com/tt-mlir/overview.html>
- TT-MLIR tensor layout：<https://docs.tenstorrent.com/tt-mlir/specs/tensor-layout.html>
- TT-MLIR device/mesh model：<https://docs.tenstorrent.com/tt-mlir/specs/device.html>
- TT-Forge：<https://docs.tenstorrent.com/forge/index.html>

### 官方产品页

- PCIe cards 与 Blackhole/Wormhole 规格：<https://tenstorrent.com/en/hardware/cards>
- Galaxy systems：<https://tenstorrent.com/en/hardware/galaxy>
- TT-Metalium 产品说明：<https://tenstorrent.com/software/tt-metalium>
- Tenstorrent Cloud：<https://tenstorrent.com/en/hardware/cloud>
- Support/product lifecycle：<https://tenstorrent.com/en/support>
- 2026 公司、IP 与异构部署方向：<https://tenstorrent.com/newsroom/tenstorrent-sets-new-performance-records-launches-tt--ascalon-s>

产品页中的性能、模型覆盖率和相对领先表述属于厂商信息。本文用它们描述产品定位和公开规格，不把它们当成独立第三方 benchmark。真正比较 Groq、Tenstorrent 和 GPU 时，必须固定模型、精度、质量、batch、ISL/OSL、软件版本和系统功耗。

## 术语表

| 术语 | 概念 |
| --- | --- |
| Tensix | Tenstorrent 的 AI compute architecture，包括 tile matrix/vector engine、local SRAM、RISC-V control 与 NoC。 |
| Tensix core | 二维 mesh 中的计算 core；内部包含本地 SRAM、计算引擎、NoC 接口和控制 processor。 |
| Tensix Engine | 真正执行 tile matrix/vector operation 的硬件引擎，不等同于 RISC-V controller。 |
| Big RISC-V | Blackhole 公开的 chip-level 通用 RISC-V core，与每个 Tensix 内的小型控制 processor 不同。 |
| L1 SRAM | Tensix core-local scratchpad；名字含 L1，但不是硬件自动管理 cache。 |
| NoC | Network-on-Chip，连接 Tensix、DRAM、Ethernet、PCIe 等 grid node 的片上网络。 |
| Circular Buffer / CB | local SRAM 中的 producer-consumer FIFO，用于 reader、compute、writer 传递 tile。 |
| Reader kernel | 从 DRAM/remote L1 经 NoC 读取 tile 到 input CB 的 data-movement kernel。 |
| Compute kernel | 控制 unpack、matrix/vector math 和 pack 的 kernel。 |
| Writer kernel | 从 output CB 把 tile 写到 DRAM/remote L1 的 data-movement kernel。 |
| FPU | Tensix matrix engine 的文档用语；不要按 CPU scalar FPU 理解。 |
| SFPU | Tensix vector/special-function engine，用于 elementwise、activation 等操作。 |
| Tile layout | 将 tensor 存为适合 Tensix Engine 的 tiled physical representation。 |
| Sharding | 把 tensor 分布到多个 core/device 的 layout strategy。 |
| TT-Metalium | 低层 open-source SDK，直接控制 kernel、NoC、SRAM、CB 和 core placement。 |
| TT-NN | 建立在 Metalium 上的 neural-network operation library。 |
| TT-Forge | 面向模型 framework 的 MLIR-based compiler stack。 |
| TT-MLIR | Tenstorrent 的 multi-level IR/compiler infrastructure。 |
| MeshDevice | 统一表示 1×1 单设备和多设备 mesh 的 runtime abstraction。 |
| Block FP8 | Tenstorrent 产品规格使用的块浮点格式口径，不能与其他厂商 FP8 峰值直接等同比较。 |
| Galaxy | Tenstorrent 的多 ASIC server/system 产品线。 |
| Blackhole | 当前主线 Tensix processor generation。 |
| Wormhole | 仍受支持并可购买的上一代 Tensix processor generation。 |
| Grayskull | 更早 Tensix generation；官方当前软件支持已停止。 |
| Ascalon | Tenstorrent 的通用高性能 RISC-V CPU IP，不是 Tensix AI core。 |
