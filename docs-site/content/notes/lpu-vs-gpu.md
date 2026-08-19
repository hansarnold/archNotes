---
title: "LPU/TSP 与 GPU：从 tile、执行模型到软件栈"
description: "先给结论：LPU 不是“把 GPU 的线程数减少”，GPU 也不是“只会做图形”。二者都能执行大规模并行张量计算，但它们把控制、调度、数据移动和延迟隐藏的复杂度放在了不同位置。"
outline: deep
products: ["Groq LPU/TSP","NVIDIA GPU"]
documentType: "比较研究"
topics: ["执行模型","调度责任","存储系统"]
---

# LPU/TSP 与 GPU：从 tile、执行模型到软件栈

<Badge type="tip" text="Groq LPU/TSP" /> <Badge type="tip" text="NVIDIA GPU" /> <Badge type="info" text="比较研究" />

这篇笔记比较的是两种体系结构思路：

- **LPU/TSP 一侧**：以 Groq 公开的 ISCA 2020 单芯片 TSP、ISCA 2022 多芯片系统和 ASAP 2022 BERT 映射论文为依据；
- **GPU 一侧**：以现代 NVIDIA CUDA GPU 的公开编程模型为代表，不表示所有厂商、所有代际 GPU 的细节都相同。

先给结论：LPU 不是“把 GPU 的线程数减少”，GPU 也不是“只会做图形”。二者都能执行大规模并行张量计算，但它们把**控制、调度、数据移动和延迟隐藏的复杂度放在了不同位置**。

本文先建立两类处理器的基础对照。若要继续研究 2026 年 NVIDIA Rubin GPU 与 Groq 3 LPX 在同一次 decode 中如何协同，请读 [Rubin GPU + Groq 3 LPX：异构推理与负载分配](nvidia-groq3-heterogeneous-inference.md)。

若要把 Tenstorrent Tensix 加入同一坐标系，请读 [Groq LPU、Tenstorrent Tensix 与 NVIDIA GPU：机制级对照](groq-tenstorrent-comparison.md)。

若要把 Google TPU、MXU systolic array、XLA 与 ICI Pod 一并加入，请读 [AI Accelerator 架构总览](ai-accelerator-architecture-comparison.md)。

## 1. 先统一 tile 的含义

这里的 **tile 是芯片微架构和二维版图上的重复硬件块**，不是 GEMM/CUDA 中的软件 data tile、CTA tile 或 tensor tile。

### 1.1 conventional CMP 中的 tile

`CMP` 是 **Chip Multiprocessor**，即在同一块 die 上集成多个处理器核心。Groq 论文 Figure 1(a) 使用的 conventional CMP 抽象中，一个 tile 基本就是一个独立 core：

```text
一个 CMP tile / core
├── IF / ID：取指与译码
├── INT / FPU：整数与浮点运算
├── MEM：Load / Store
├── Register File
└── NET：片上网络接口
```

因此它是：

- **tile 内部异构**：一个 tile 内含多类硬件；
- **全芯片同构**：芯片重复排列结构大致相同的 core/tile。

真实现代 GPU 的 SM 比这张教学抽象复杂得多，但也可以观察到类似的“重复 SM，每个 SM 内含调度、寄存器、访存和多类计算单元”的组织思路。

### 1.2 TSP 中的 tile 和 slice

TSP 将传统 core 中的功能按空间解聚，每个 tile 实现一种特定功能，同类 tile 沿 Y 方向组成 functional slice：

```text
               Y：同类 tile 纵向组成 slice
               ↑
MEM slice    SXM slice    MXM slice    VXM slice    MEM slice
[MEM tile]   [SXM tile]   [MXM tile]   [VXM tile]   [MEM tile]
[MEM tile]   [SXM tile]   [MXM tile]   [VXM tile]   [MEM tile]
[MEM tile]   [SXM tile]   [MXM tile]   [VXM tile]   [MEM tile]

数据沿 X 方向在不同功能 slice 之间流动 →
```

- MEM tile：片上 SRAM 的读写；
- SXM tile：交换、移位、排列和 lane 间数据移动；
- MXM tile：矩阵乘加；
- VXM tile：逐元素向量运算、激活和量化；
- ICU：取指、译码和向各 functional slice 分发指令。

论文把这种组织称为 **local functional homogeneity, chip-wide heterogeneity**：slice 内功能同质，全芯片由不同功能的 slices 构成。

第一代论文中，每个 functional slice 是一条 20-stage vector pipeline；每个 tile 产生 16 个元素，合起来覆盖最大 320-element vector：

```text
20 tiles × 16 elements/tile = 320 elements
```

所以可把 tile 理解为“某类功能流水线在 16 个并行元素上对应的一段物理硬件”，把 slice 理解为“纵向拼接这些 tile、覆盖完整向量宽度的功能模块”。这是针对 ISCA 2020 那一代 TSP 的解释，不应直接当成后续 LPU 产品规格。

## 2. 一张表看主要差异

| 维度 | Groq LPU/TSP | 现代 CUDA GPU（代表性描述） |
| --- | --- | --- |
| 芯片组织 | 按功能分成 MEM/SXM/MXM/VXM 等 slices | 重复排列多线程 SM，每个 SM 内有多类计算、访存和控制资源 |
| 主要抽象 | tensor、stream、functional slice、编译好的 program | kernel、grid、thread block、thread、warp |
| 并行方式 | 宽 SIMD、功能流水、算子间 producer-consumer chaining | SIMT、多 warp、多 block；矩阵计算还使用 Tensor Cores |
| 指令组织 | slice-specific instruction queues；指令与数据在指定位置和周期相遇 | warp 执行指令；硬件 warp scheduler 在发射时选择 ready warp |
| 调度责任 | 编译器提前完成 placement、routing 和 time-space scheduling | 编译器生成 kernel，运行时硬件负责 block/warp 调度和大量延迟隐藏 |
| 延迟隐藏 | 编译器安排算子重叠、stream 传递和静态流水 | 用大量 resident warps、occupancy 和异步流水隐藏延迟 |
| 主存储模型 | 第一代论文强调显式管理的片上 SRAM 与 streaming register file | device DRAM/HBM + L2 + 每 SM 的 L1/shared memory + registers |
| cache | 第一代 TSP 数据路径刻意去掉传统 cache 等 reactive elements | cache hierarchy 是通用 GPU 存储系统的重要部分 |
| 数据移动 | 编译器显式安排 MEM bank、stream 方向、SXM 重排与到达时间 | 程序优化访问合并、shared-memory staging；cache/内存系统动态服务请求 |
| 控制流 | 更适合可提前确定形状、资源和执行路径的图 | 每线程拥有状态与控制流，支持分支；warp divergence 会影响利用率 |
| 性能特征 | 强调可预测执行、低 batch 流水和硬件感知全图编译 | 强调通用吞吐、动态适应、广泛工作负载与成熟软件生态 |
| 软件优化重心 | 全图 lowering、布局、静态排程、算子跨 slice 融合 | kernel fusion、tiling、occupancy、coalescing、shared memory、库与 kernel 选择 |

表中是架构倾向，不是绝对边界。例如 GPU 编译器也会做大量静态优化，CUDA Graphs 也能减少运行时开销；LPU 仍需要 host runtime，也需要在运行时启动程序、传输输入和协调多芯片。

## 3. 最大差异：谁负责调度？

### 3.1 GPU：编译器与动态硬件共同调度

CUDA 程序把工作表达为 kernels、thread blocks 和 threads。block 被分配到有容量的 SM；SM 将 threads 组成 warps。每个指令发射周期，硬件 warp scheduler 从可继续执行的 warps 中选择一个发射。

这种设计的重要价值是适应性。遇到内存等待或数据依赖时，硬件可以切换到其他 ready warp，用 thread-level parallelism 隐藏延迟。代价是需要维护多个 warp 的执行状态、寄存器、scoreboard/调度逻辑以及层次化存储系统。

因此 GPU 优化经常问：

- 是否有足够 active warps 隐藏 latency？
- register/shared-memory 用量是否限制 occupancy？
- thread blocks 是否能铺满 SM？
- 分支是否造成 warp divergence？
- global-memory access 是否 coalesced？

### 3.2 LPU/TSP：把更多决定提前到编译期

TSP 编译器不仅选择指令，还要决定：

- 操作放在哪个 functional slice；
- tensor 放在哪个 MEM slice/bank；
- 使用哪条 stream、向东还是向西；
- SXM 如何重排 lanes；
- 指令在第几个 logical cycle 发射；
- operand 经过 transport delay 后何时到达；
- 哪些 slice operations 可以同周期并行；
- 哪些位置必须插入 NOP、Repeat、Sync/Notify。

这类编译结果更像一份 **time-space schedule**：时间和物理位置都已经成为程序的一部分。硬件不需要像 GPU 那样在每次发射时从许多 warps 中动态寻找可运行工作，但编译器必须掌握准确的资源和延迟模型。

可以把责任分配粗略画成：

```text
GPU
源码/图 → 编译器生成 kernels → runtime 分配 blocks
                              → GPU 动态选择 ready warps

LPU/TSP
模型图 → lowering/layout/placement/routing/time schedule
      → 已安排好的 slice instruction streams → 硬件按计划推进
```

所以更准确的说法不是“GPU 动态、LPU 静态”，而是：

> GPU 保留较强的运行时硬件调度能力；LPU/TSP 把更多跨算子、跨资源和数据移动决策前移到全图编译阶段。

## 4. 两种不同的延迟隐藏方法

假设一条 load 需要等待：

### GPU 的典型思路

```text
warp 0：等待 load ───────────────┐
warp 1：执行 ALU                 │ 硬件切换 ready warp
warp 2：执行 Tensor Core         │
warp 3：发起下一批 load ─────────┘
```

GPU 通过大量线程/warp、低成本上下文切换和 occupancy，让其他工作覆盖当前 warp 的等待时间。

### LPU/TSP 的典型思路

```text
cycle 0   MEM 读 X/W
cycle 4   MXM 开始消费已经到达的 stream
cycle 8   VXM 处理上一段 MXM 输出
cycle 12  MEM 写回更早一段结果
```

编译器提前让 MEM、MXM、VXM 等不同 slices 在不同数据段上形成流水。这里隐藏的不是“换一个 warp 执行”，而是“让多个功能工位持续处理不同阶段的数据”。

两边的目标相同：减少昂贵资源空闲；实现机制不同。

## 5. 存储系统与数据移动

### 5.1 GPU

现代 CUDA GPU 通常包含：

```text
device DRAM/HBM
    ↕
共享 L2 cache
    ↕
每个 SM 的 L1 / shared memory
    ↕
per-thread registers
```

GPU kernel 通常需要优化 global-memory coalescing、shared-memory reuse、bank conflict、cache locality 和 host-device transfer。cache 可以适应运行时访问，但命中率和资源竞争也会让精确周期更难仅凭源代码推断。

### 5.2 LPU/TSP

ISCA 2020 TSP 使用大量显式管理的片上 SRAM，并用 chip-wide streaming register file 在 slices 间输送 operand/result。编译器需要决定数据的 bank、方向、对齐和到达时刻。

这并不等于“LPU 不需要内存优化”。相反，由于很多决定不交给 cache 自动处理，layout、bank placement、生命周期、intermediate forwarding 和避免写回会成为编译器的核心问题。

当扩展到多芯片时，ISCA 2022 系统还需要把 C2C link、hop latency、Send/Receive 和 deskew 纳入软件调度。

## 6. 同一个计算图会怎样执行？

考虑：

```text
Y = GELU(X × W + B)
```

### GPU 视角

一个常见实现会调用矩阵乘库或 Tensor Core kernel，再执行 bias/GELU kernel；更先进的 library/compiler 也可能把 epilogue 融合进 GEMM。硬件在各 SM 上调度 blocks 和 warps，数据可能经过 registers、shared memory、L1/L2 和 HBM。

重点问题是 tiling、Tensor Core 数据布局、occupancy、访存合并、kernel fusion，以及 launch/同步开销。

### LPU/TSP 视角

编译器可以规划：

```text
MEM 读取 X/W → streams → MXM 执行矩阵乘
                         ↓ 结果继续流动
                    VXM 执行 bias/GELU → MEM
```

在 ASAP 2022 BERT 案例中，作者重点讨论了 GEMM 与 GELU/LayerNorm/Softmax 的重叠、VXM chaining、SXM 重排、量化融合和中间数据转发。这里的关键不是启动更多线程，而是让各 functional slices 的 schedule 互相咬合。

不过，两边都能进行算子融合和流水。真正的比较必须固定模型、shape、精度、batch、编译器版本、内存容量和服务配置，不能只比较 TOPS 或某个云端 tokens/s 数字。

## 7. 动态性、可预测性和适用范围

### GPU 更自然处理的情况

- 数据相关分支和不规则访问；
- 动态 shape 或不断变化的 kernel；
- 训练、科学计算、图形和大量自定义算子；
- 需要成熟 CUDA libraries、profilers 和开发生态；
- 工作集依赖大容量 HBM、cache 和通用多线程模型。

### LPU/TSP 设计更有吸引力的情况

- 模型和 tensor shape 可在执行前确定；
- 目标是低 batch、稳定 latency 的推理流水；
- 编译器能看到较完整的计算图并做全局安排；
- 算子能有效映射到 MEM/SXM/MXM/VXM；
- 数据重用和中间结果能留在片上、沿 stream 连续消费。

这里说的是设计适配性，不是无条件性能排名。某个模型是否更快，最终取决于芯片代际、软件成熟度、模型支持、数值格式、内存容量、并行方案和实际服务负载。

## 8. 常见误解

### 误解 1：LPU 就是没有 cache 的 GPU

不准确。functional slicing、stream programming model、slice-specific instruction flow 和 time-space scheduling 共同改变了芯片组织和编程模型，不只是删掉 cache。

### 误解 2：GPU 完全靠硬件，编译器不重要

不准确。GPU 的 kernel fusion、tiling、instruction selection、register allocation 和 Tensor Core mapping 都高度依赖编译器与库。区别在于 GPU 仍保留强大的 runtime warp/block scheduling。

### 误解 3：静态调度意味着没有 runtime

不准确。LPU 仍需要 host runtime 完成程序和权重装载、输入输出传输、启动、同步和多设备协调。静态的是 device program 中更多资源与周期关系。

### 误解 4：确定性执行等于云 API 延迟恒定

不准确。网络、请求排队、多租户、tokenization 和服务编排不属于单芯片静态 schedule，端到端 API latency 仍会波动。

### 误解 5：tile 在两边是同一个概念

不准确。本文前半部分的 tile 是物理微架构块；CUDA/GEMM 优化中的 tile 通常是软件划分的数据块。看到 tile 时必须先问“这是硬件空间还是数据空间？”

## 9. 建议的学习与实验

1. 对照 ISCA 2020 Figure 1，自己画出 conventional CMP tile 和 TSP functional slice。
2. 阅读 CUDA Programming Guide 的 SIMT、hardware multithreading 和 memory hierarchy。
3. 给同一个 `read → matmul → activation → write` DAG 分别写 GPU 与 LPU 的执行时间线。
4. 运行本项目 `labs/static_scheduler/`，观察资源冲突和 transport delay 如何产生 NOP。
5. 给 scheduler 增加一个简化的 GPU 模式：当某个 warp 等待时，从 ready-warps 集合中选择另一个 warp。
6. 比较两个模型：LPU 模型报告静态 makespan；GPU 模型报告 occupancy、stall reasons 和平均完成时间。

## 10. 资料来源与证据边界

- Groq，*Think Fast: A Tensor Streaming Processor (TSP) for Accelerating Deep Learning Workloads*，ISCA 2020：<https://groq.humain.ai/wp-content/uploads/2024/02/2020-Isca.pdf>
- Groq，*A Software-defined Tensor Streaming Multiprocessor for Large-scale Machine Learning*，ISCA 2022：<https://groq.humain.ai/wp-content/uploads/2023/05/GroqISCAPaper2022_ASoftwareDefinedTensorStreamingMultiprocessorForLargeScaleMachineLearning-1.pdf>
- Groq，*Answer Fast: Accelerating BERT on the Tensor Streaming Processor*，ASAP 2022：<https://groq.humain.ai/wp-content/uploads/2022/10/Groq_ASAP2022_BestPaper.pdf>
- NVIDIA，*CUDA Programming Guide*：<https://docs.nvidia.com/cuda/cuda-programming-guide/index.html>
- NVIDIA，*CUDA C++ Best Practices Guide*：<https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/>

Groq 论文主要描述第一代 TSP 和当时的软件映射。NVIDIA 文档描述 CUDA 编程模型和当前支持的 GPU 概念。二者不是同年份、同工艺、同精度的产品对测资料，因此本篇只比较机制，不给出速度、功耗或成本倍数。
