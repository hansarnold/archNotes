---
title: "ISCA 2020 架构导读"
description: "来源：Dennis Abts 等，Think Fast: A Tensor Streaming Processor TSP for Accelerating Deep Learning Workloads，ISCA 2020。以下数字均为论文对第一代 TSP 的报告，不代表当前 GroqCloud 或后续 LPU 产品规格。"
outline: deep
products: ["Groq TSP"]
documentType: "架构专论"
topics: ["Functional slicing","静态调度","Stream"]
---

# ISCA 2020 架构导读

<Badge type="tip" text="Groq TSP" /> <Badge type="info" text="架构专论" />

来源：Dennis Abts 等，*Think Fast: A Tensor Streaming Processor (TSP) for Accelerating Deep Learning Workloads*，ISCA 2020。以下数字均为论文对第一代 TSP 的报告，不代表当前 GroqCloud 或后续 LPU 产品规格。

## 一句话模型

传统多核处理器把取指、计算、存储和网络放进每个重复的 core；TSP 把全芯片按功能重排成纵向 slices，让数据在固定功能单元之间横向流动，再由编译器安排“数据和指令在第几周期、哪个位置相遇”。

```text
指令：从 ICU 沿 slice 纵向传播
                    ↓
数据：MEM → SXM → MXM → VXM → MEM
                    →

MEM：片上 SRAM 和 Read/Write
SXM：移位、置换、转置和 lane 间数据移动
MXM：矩阵乘加
VXM：逐元素向量运算、量化和激活
ICU：各 slice 的指令控制、同步和取指
```

这只是学习示意。真实 slice 排布和数据方向应以论文 Figure 2、Figure 4、Figure 5 为准。

## 1. Functional slicing

论文将 conventional CMP 描述为“每个 tile 内部异构、全芯片重复同构 core”；TSP 反过来，使同一纵向 slice 内的 tile 执行同一种功能，而全芯片由 MEM、SXM、MXM、VXM、ICU 等不同 slice 组成。

直接结果是：

- 公共取指/解码逻辑可以从每个计算 tile 中抽离；
- 指令流和数据流被分到两个空间维度；
- 数据可以连续经过多个功能 slice，减少中间结果写回 SRAM；
- 编译器必须显式管理位置、周期、bank、stream 和资源冲突。

## 2. Stream 编程模型

TSP 不以传统 GPR load/add/store 循环作为主要抽象。功能 slice 从 stream 消费 operand，再把结果产生到另一个 stream，类似固定工位处理传送带上的数据。

论文把 stream 实现为全芯片可见的 streaming register file。数据在东西方向流经功能 slice；需要 lane 间重排时，由 SXM 在南北方向移动。编译器负责数据类型对齐以及 stream 的方向和到达时间。

理解重点不是“完全没有存储”，而是区分：

- 220 MiB 片上 SRAM：存放模型参数、激活和程序文本；
- streaming registers：在 slice 之间运送 operand/result；
- 编译器：决定何时从 SRAM 读、走哪条 stream、在哪个 slice 消费、何时写回。

## 3. Determinism 从哪里来

论文强调删除数据路径中的 cache、arbiter 等 reactive elements，并把调度复杂度推给编译器。ISA 暴露 instruction functional delay、instruction-operand skew 等时间信息；编译器据此做空间和时间上的二维调度。

因此这里的“确定性”主要指：给定已编译程序和硬件状态，执行周期可以由编译器模型精确推演。它不自动意味着：

- 互联网 API 的端到端延迟恒定；
- 多租户服务没有排队；
- 网络传输没有抖动；
- 所有模型都能达到峰值算力。

## 4. 第一代论文规格速查

| 项目 | 论文报告值 | 来源位置 |
| --- | --- | --- |
| 工艺与芯片尺寸 | 14nm，25 × 29 mm | Abstract |
| 标称频率 | 900 MHz；结论另以 1 GHz 峰值口径讨论 | Abstract / Conclusion |
| 向量长度 | minVL 16，maxVL 320 elements | Section II / VII |
| 指令队列 | 144 independent instruction queues | Section II |
| 片上 SRAM | 220 MiB，88 MEM slices | Section II-B |
| MXM | 4 个 320 × 320 MACC arrays | Section III-D |
| VXM | 320 lanes × 16 vector ALUs = 5,120 ALUs | Conclusion |
| stream register bandwidth | 论文在 1 GHz 假设下推导合计 20 TiB/s | Section II-B |
| SRAM bandwidth | 论文在 1 GHz 假设下推导合计 55 TiB/s | Section II-B |
| 峰值 | 论文结论报告 1 GHz 时 820 TeraOps/s | Conclusion |

900 MHz 与 1 GHz 是两个不同叙述口径，引用时必须带上下文，不能拼成一个“统一实测规格”。

## 5. ResNet50 案例能说明什么

论文报告 batch size 1 的 ResNet50 v2 吞吐约 20.4K images/s，并给出约 49 μs 单样本 latency 的比较。它展示了以下设计意图：

- batch 1 下仍通过宽向量和流水获得高利用率；
- MXM 输出可直接流到 VXM 完成 requantization 与 ReLU；
- 调整 tensor 的 SRAM slice/bank 布局可以让相邻 pipeline 重叠；
- 芯片资源形状会反过来影响模型 channel 设计和利用率。

它不能单独证明当前 LLM 服务相对某款现代 GPU 的倍数优势，因为模型、芯片代际、软件栈、精度、网络和 serving 策略都已经变化。

## 6. 阅读时应追问的问题

1. 模型权重超过片上 SRAM 后，跨芯片分片和通信如何安排？
2. 静态调度如何处理动态 sequence length、MoE routing 和 speculative decoding？
3. 编译时间、可支持算子集合与性能可预测性之间有什么交换？
4. 当前 LPU 的片上 SRAM、数值格式和互联与 2020 TSP 有哪些变化？
5. 编译器的代价模型如何联合考虑计算、数据移动以及 bank/stream/link 冲突？

前两个问题应继续阅读 ISCA 2022；其余问题结合 compiler/ISA 专利、BERT 映射论文和本地 scheduler 实验研究。
