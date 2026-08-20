---
title: 从 NVIDIA GPU SM 到 Tensix Dataflow Core
description: 聚焦 Tenstorrent 相对 GPU SM 弱化的动态机制、增加的显式 dataflow 机制，以及硬件减法带来的软件代价。
outline: deep
products: ["Tenstorrent Tensix", "NVIDIA GPU"]
documentType: "比较研究"
topics: ["Core 设计", "调度", "Memory hierarchy"]
---

# 从 NVIDIA GPU SM 到 Tensix Dataflow Core

本文只讨论一个设计问题：**如果主要 workload 是规则 tensor computation，哪些 GPU SM 的动态机制可以弱化，又需要用什么显式机制补回来？** Tensix 完整结构见[架构专论](./tenstorrent-architecture.md)，三架构责任对照见[Groq、Tensix 与 GPU](./groq-tenstorrent-comparison.md)。

## 1. 先固定比较层级

CUDA Core 只是 SM 内一类 scalar execution lane，不是完整 core。合理的比较对象是：

- NVIDIA SM：warp scheduler、register file、shared/L1、load/store、tensor/scalar pipelines 与 CTA residency；
- Tensix core：local SRAM、data-movement RISC-V、unpack/math/pack、tensor/vector engine 和 NoC endpoints。

两者也不是 pin-to-pin 替代品。GPU 同时服务 graphics、HPC、irregular parallelism 和 AI；Tensix 更集中地面向 tiled tensor dataflow。因此“减法”只在指定 workload 和软件契约下成立。

![两列按 Scheduling、Compute state、Memory ownership、Movement 和 Backpressure 对齐：GPU SM 由硬件维护 resident warp state、动态选取 ready work 并结合 cache 与 scoreboard；Tensix 由 compiler、Reader Compute Writer kernel、local SRAM circular buffer 与 NoC 显式承担更多责任](../assets/diagrams/tenstorrent-rethinking-gpu-sm-01.svg "GPU SM 保留更多动态硬件责任，Tensix 则把 placement、data movement 与 buffering 更明确地交给软件可见 dataflow。")

## 2. 弱化 CUDA-style thread/warp 抽象

GPU 以 logical thread 编程，以 warp 为发射单位。它需要维护 per-thread register state、active mask、control flow 和大量 resident warp，以便在某些 warp 等待时发射其他 warp。

Tensix 的主要数据和计算单位是 tile。Reader、compute 和 writer kernel 围绕 CB 交换 tile；计算引擎执行 matrix/vector operation。RISC-V controller 负责 data movement 与控制，但不是把每个 tensor element 变成独立 CUDA-style thread。

结果是 Tensix 不需要复制完整的 warp execution contract，但 software 必须显式安排 tile shape、layout、core placement 和 kernel 协作。

## 3. 弱化动态 warp scheduling

GPU scheduler 根据 scoreboard readiness、pipeline availability 和 issue policy 动态选择 warp。这让同一个 SM 能吸收 memory latency、dependency latency 和不同 warp 的进度差异。

Tensix 更依赖提前 placement 和 producer/consumer pipeline：

```text
DRAM / remote L1
  → reader kernel
  → input circular buffer
  → compute kernel
  → output circular buffer
  → writer kernel
```

当某阶段变慢，CB 的 full/empty state 产生 backpressure。它用有界数据流协议代替一部分“大量 resident warp + 动态选择”的适应性。

这并不表示 Tensix 没有 runtime 或控制处理器；它表示 steady-state throughput 更依赖 kernel pipeline 和 buffer balance。

## 4. 弱化透明 cache 的中心地位

GPU 通过 register、shared memory、L1/L2 cache 和 HBM 共同供数。Shared memory 可以显式管理，但 cache 仍负责吸收大量动态 locality。

Tensix 把 core-local SRAM、tile layout、CB 和 NoC data movement 暴露给软件。程序要决定：

- tile 放在哪个 core；
- reader 从 DRAM 还是 remote L1 取数；
- 哪些数据 multicast；
- CB 容量和生命周期；
- 输出何时写回或直接交给下游 core。

这减少了部分 cache tag、replacement 和 miss-handling 责任，却增加了 compiler/kernel 对 locality、capacity 和 route 的责任。

## 5. 弱化 divergence/reconvergence 需求

GPU warp 内线程走不同控制路径时，需要 predication、active mask 和 reconvergence 机制。它们支持通用控制流，但 divergence 会降低 active-lane utilization。

规则 tensor kernel 通常可以在更高层按 tile 和 core 分区，Tensix 因而不需要把 CUDA-style divergence 作为主要计算引擎的基本契约。不规则边界仍然存在，只是更可能通过 padding、specialized kernel、host/runtime dispatch 或 RISC-V control 处理。

硬件机制减少不等于问题消失；它可能变成额外 kernel、padding 和 compilation specialization。

## 6. Tensix 增加了什么

Tensix 不是只做减法。它强化了四类显式机制：

| 机制 | 解决的问题 |
| --- | --- |
| **NoC as a programmable resource** | core、DRAM 与 remote SRAM 之间怎样移动和复用数据 |
| **Circular buffer protocol** | producer/consumer 的容量、顺序、ownership 和 backpressure |
| **Native tile layout** | 计算引擎以什么 physical representation 接收数据 |
| **Core mesh placement** | computation 与 communication 在二维执行空间中怎样分布 |

因此，Tensix 的硬件简化必须和显式 dataflow 能力一起看；否则只会看到缺少的 GPU 机制，看不到替代契约。

## 7. 同一个 MatMul 的责任变化

### GPU

Programmer/compiler 选择 block tile、warp tile、shared-memory staging 和 tensor instruction；runtime 放置 CTA；warp scheduler 在执行时动态选择 ready work；cache 与 memory coalescing 共同影响数据供应。

### Tensix

Programmer/compiler 选择 tensor tiling、sharding、core grid、reader/compute/writer kernel、CB capacity 和 NoC pattern；runtime 启动 device program；各 core 通过 CB 与 NoC 协作。

两边都需要 tiling 和 pipeline。差别是 Tensix 把更多物理布局、数据路径和 producer/consumer protocol 提升为一等编程对象。

## 8. 硬件减法带来的软件加法

1. **Compiler 与 kernel 更难。** Placement、layout、sharding、CB 和 NoC 需要整体协调。
2. **Shape 更敏感。** Padding、partial tile 和 layout conversion 可能直接浪费 compute 或 SRAM。
3. **流水平衡更重要。** 增加 buffer 不能修复持续的 reader、compute 或 writer bottleneck。
4. **动态 workload 代价更显式。** 不规则 shape、控制流或 sparse pattern 可能需要 specialization 与额外 dispatch。
5. **工具生态决定可用性。** 硬件潜力只有在 compiler、library、profiler 和 debug tooling 能表达这些责任时才能兑现。

## 9. 怎样验证

使用[Tensix 流水实验](../labs/tensix_pipeline.md)：

- 分别让 reader、compute、writer 成为 bottleneck；
- 改变 input/output CB capacity；
- 观察 empty/full stall、steady-state throughput 和 makespan；
- 验证“更大 buffer 只能吸收 burst，不能提高瓶颈 stage service rate”。

再与[NVIDIA GPU Tile 流水](./nvidia-gpu-synchronization.md)对照：GPU 用 resident warp 和动态 readiness 管理哪些等待，Tensix 又把哪些等待转化成显式 buffer 与 data movement 问题。

## 10. 结论

相对 GPU SM，Tensix 弱化了以大量 per-thread state、动态 warp scheduling、透明 cache 和 divergence machinery 为中心的执行契约；同时强化 local SRAM、CB、NoC、tile layout 和 core mesh。收益是规则 tensor dataflow 的责任更显式，代价是 compiler、kernel 和系统软件必须承担更多全局规划。

这不是“谁更先进”的结论。只有固定 workload、shape、precision、software、topology 和系统边界，才能判断这种责任迁移是否值得。

共享术语见[术语表](../glossary.md)，证据和官方来源见[资料目录](../sources/catalog.md)。
