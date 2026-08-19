---
title: AI Accelerator Architecture 多架构学习路线
description: 从体系结构基础出发，依次理解 GPU、Groq TSP、Tenstorrent Tensix、Google TPU、软件栈与多芯片系统。
outline: deep
products: ["跨架构"]
documentType: "学习导览"
topics: ["学习路径", "研究方法"]
---

# AI Accelerator Architecture 多架构学习路线

这是一张阅读顺序表，不重复六条主线的范围定义。仓库目标、文档归属和建设顺序见[课程蓝图](../curriculum.md)，统一架构比较见[四类加速器统一对照](./ai-accelerator-architecture-comparison.md)，共享概念见[术语表](../glossary.md)。

## 选择学习方向

- **模型向下：** 模型计算与状态 → graph/IR → compiler/runtime/kernel → hardware mapping → performance validation。
- **硬件向上：** compute/memory/interconnect → programming contract → software optimization → model/hardware co-design。
- **贯穿案例：** 用同一个 Transformer block 闭合两条路线，而不是分别学习两套术语。

六条主线的 P0 框架均已建立。建议先沿下面的主干顺序形成闭环，再进入厂商专论和机制实验。

## 六条主干的阅读顺序

1. [模型计算原语与 Workload 描述](./model-computation-primitives.md)：把模型拆成 operation、tensor、状态和通信需求。
2. [模型到硬件的完整映射](./model-to-hardware-mapping.md)：追踪图、IR、kernel、运行时和设备执行。
3. [四类加速器统一对照](./ai-accelerator-architecture-comparison.md)：比较硬件资源、执行模型与软件契约。
4. [跨架构软件优化方法](./software-optimization-methodology.md)：按瓶颈选择优化层和手段。
5. [模型—硬件协同设计](./model-hardware-codesign.md)：判断何时需要修改模型、数值或硬件契约。
6. [性能建模与验证](./performance-modeling.md)：用统一单位、预测和实验完成证据闭环。

**完成标志：** 能用同一个 Transformer block 贯穿六篇文档，并产出 workload、mapping、架构约束、优化、协同决策和性能验证六份相互引用的账本。

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
