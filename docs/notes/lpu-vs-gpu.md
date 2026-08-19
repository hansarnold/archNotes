---
title: LPU/TSP 与 GPU：动态调度和静态时空调度
description: 聚焦比较 GPU 的动态 warp 调度与 Groq LPU/TSP 的编译期时空调度，不重复完整架构总览。
outline: deep
products: ["Groq LPU/TSP", "NVIDIA GPU"]
documentType: "比较研究"
topics: ["执行模型", "调度责任", "存储系统"]
---

# LPU/TSP 与 GPU：动态调度和静态时空调度

本文只回答一个问题：**当 operation 因依赖、memory 或资源竞争暂时不能前进时，谁决定下一步？** 完整的四架构表见[统一对照](./ai-accelerator-architecture-comparison.md)，Groq 和 GPU 内部机制分别见[Groq TSP](./architecture.md)与[NVIDIA GPU](./nvidia-gpu-synchronization.md)。

## 1. 比较边界

GPU 的核心调度单位是 resident warp。编译器生成 kernel，但运行时硬件依据 scoreboard、warp readiness 和 pipeline availability 动态选择可发射指令。

Groq TSP 把更多决定提前到编译期：compiler 为 operation 选择 functional resource，并为跨 slice 的 stream 安排时间和空间。硬件执行已规划的指令流，而不是维护大规模 warp pool 来临场隐藏延迟。

这里的 “LPU” 指 Groq 产品语境；用于解释公开机制时仍以 TSP 论文和公开资料为边界。

## 2. 责任分配

| 问题 | NVIDIA GPU | Groq LPU/TSP |
| --- | --- | --- |
| 下一条工作怎样选择 | warp scheduler 从 ready warp 中动态选择 | compiler 预先生成各 functional slice 的时序 |
| 怎样覆盖 latency | 切换到其他 ready warp、利用 cache 和并发流水 | 提前安排 producer、transport 与 consumer，使不同 tile 在流水中重叠 |
| 资源不足何时暴露 | launch、residency 或运行时 stall | 编译、placement 或 schedule 阶段更早暴露 |
| 不规则控制流 | SIMT、predication、divergence/reconvergence | 需要被编译为可计划的控制和数据流，动态性代价更显式 |
| 性能可预测性 | 受 cache、contention、residency 和动态发射影响 | 对已编译 shape 和 topology 更容易预测，但 specialization 成本更高 |

两者都依赖编译器、runtime 和硬件；差别是责任放置的比例，而不是“一个有软件、另一个只有硬件”。

## 3. 同一个依赖链

假设计算为：

```text
read A, B → matmul → activation → write C
```

GPU compiler 生成 kernel 指令。block resident 后，warp scheduler 在 load、tensor、activation 和 store 相关 warp 之间动态发射；scoreboard 阻止尚未 ready 的依赖。若某个 warp 等待 memory，其他 ready warp 可以占用 pipeline。

Groq compiler 则要为 read、matrix、vector 和 write 选择 functional slices，结合 functional delay、transport delay 和资源占用生成 schedule。下一块数据可以在前一块仍计算时进入上游 slice，但重叠关系主要已经写入编译结果。

这两条路径最终都形成 pipeline。关键差别是 GPU 用 **ready work pool** 吸收部分变化，Groq 用 **预先规划的 time-space pipeline** 限制变化。

## 4. Memory 与调度不能分开看

GPU 依赖 registers、shared memory、cache 与 HBM。透明 cache 能吸收部分局部性变化，但 cache miss、coalescing、bank conflict 和 occupancy 会改变实际时序。

Groq 更强调 compiler-managed SRAM 和显式 stream。数据何时进入哪个 slice、何时被消费，直接进入 schedule 与 memory planning。它减少了部分动态发现，但把 layout、capacity 和 transport 的责任推给 compiler。

因此，不能只比较“有没有 cache”；应比较谁知道数据位置、谁保证容量、谁安排移动、谁在等待时找到替代工作。

## 5. 适用边界

GPU 的动态机制更适合 shape、控制流、访存或并发情况经常变化的工作，也受益于成熟的 kernel、library 和 profiling 生态。

Groq 的时空调度更适合能够被充分编译、shape 和 topology 相对稳定、且确定性流水具有价值的工作。它并不保证端到端服务没有 queue、network 或 host jitter。

## 6. 最小实验

使用[静态时空调度实验](../labs/static_scheduler.md)：

1. 增加 producer latency，观察 compiler-predicted makespan；
2. 增加 transport delay，观察 consumer 的 earliest start；
3. 给两个 operation 指定同一资源，观察结构冲突；
4. 再思考 GPU 会用更多 ready warp 覆盖哪些等待，以及哪些等待仍无法覆盖。

这个实验只说明静态 schedule 的基本约束，不模拟真实 Groq compiler，也不能据此推导芯片性能。

## 7. 结论

- GPU 把更多不确定性留给运行时硬件，用 ready warp 和 memory hierarchy 适应变化。
- Groq 把更多决定前移到 compiler，用全局 time-space schedule 构造确定性流水。
- 两者都需要 specialization、memory planning、runtime 和同步，只是责任分界不同。
- 公平比较必须固定 workload、shape、precision、quality、batch、软件版本和系统边界。

共享术语见[术语表](../glossary.md)，资料与证据边界见[资料目录](../sources/catalog.md)。
