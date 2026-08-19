---
title: AI Accelerator Architecture 多架构学习路线
description: 从体系结构基础出发，依次理解 GPU、Groq TSP、Tenstorrent Tensix、Google TPU、软件栈与多芯片系统。
outline: deep
products: ["跨架构"]
documentType: "学习导览"
topics: ["学习路径", "研究方法"]
---

# AI Accelerator Architecture 多架构学习路线

这是一张阅读顺序表，不重复各架构的完整解释。统一比较结论放在[四类加速器统一对照](./ai-accelerator-architecture-comparison.md)，共享概念放在[术语表](../glossary.md)。

## 0. 建立共同语言

先能区分 pipeline、SIMD、SIMT、systolic array、cache、scratchpad、NoC、latency、throughput、occupancy 和 utilization。

**完成标志：** 能解释“计算单元”“调度单位”“数据 tile”和“芯片”为什么不是同一个层级。

## 1. 建立四条架构主线

按以下顺序阅读专论：

1. [NVIDIA GPU：Tile 流水与同步](./nvidia-gpu-synchronization.md)：从动态 warp 调度、shared memory 和 completion contract 建立 GPU baseline。
2. [Groq TSP 架构](./architecture.md)：理解 functional slicing、stream 和确定性时空调度。
3. [Tenstorrent Tensix](./tenstorrent-architecture.md)：理解 core-local SRAM、reader/compute/writer、CB 和 NoC mesh。
4. [Google TPU](./google-tpu-architecture.md)：理解 MXU systolic wavefront、VMEM/HBM、XLA/PJRT 和 ICI Pod。

**完成标志：** 对每种架构都能回答计算在哪里发生、数据从哪里来、谁选择下一项工作、怎样扩展到多芯片。

## 2. 深入调度与软件责任

- Groq：[ISA 与指令流](./instruction-flow.md) → [编译器心智模型](./compiler.md) → [软件优化](./software-optimization.md)。
- 跨架构：[推理框架与运行时边界](./inference-stack.md)。
- 动态与静态调度的聚焦对照：[LPU/TSP 与 GPU](./lpu-vs-gpu.md)。

**完成标志：** 能把一个 graph transformation 分配给 framework、compiler、runtime 或 hardware，并说明为什么。

## 3. 用实验观察机制

| 实验 | 观察问题 | 对应文章 |
| --- | --- | --- |
| [静态时空调度](../labs/static_scheduler.md) | dependency、resource conflict、transport delay 如何决定 makespan | Groq compiler |
| [Tensix 流水与背压](../labs/tensix_pipeline.md) | CB 容量、stage balance 与 backpressure | Tensix architecture |
| [Systolic wavefront](../labs/systolic_array.md) | fill/drain、partial tile 与 utilization | TPU architecture |

**完成标志：** 能改变一个输入参数、预测结果方向，并用 simulator 输出验证预测。

## 4. 做机制级比较

先读[统一对照](./ai-accelerator-architecture-comparison.md)，再按问题进入专题：

- 动态 SIMT 与编译期时空调度：[LPU/TSP 与 GPU](./lpu-vs-gpu.md)。
- Groq 的静态空间流水与 Tensix 的可编程 dataflow：[Groq、Tensix 与 GPU](./groq-tenstorrent-comparison.md)。
- GPU SM 相对 Tensix core 的硬件与软件责任变化：[从 GPU SM 到 Tensix](./tenstorrent-rethinking-gpu-sm.md)。
- Rubin GPU 与 Groq 3 LPX 的系统协作：[异构推理与负载分配](./nvidia-groq3-heterogeneous-inference.md)。

**完成标志：** 比较时始终固定 workload、shape、精度、质量、软件版本、topology、SLO 和系统功耗边界。

## 5. 最终项目

选择同一个 MatMul、Transformer block 或推理请求，交付：

1. 四种架构的计算、存储、调度和通信映射；
2. 一项可运行的简化实验；
3. 对瓶颈、适用范围和证据强度的说明；
4. 不跨代际、不混用指标的比较表。

资料引用和证据分级统一遵循[资料目录](../sources/catalog.md)，不在每篇作业里重新定义。
