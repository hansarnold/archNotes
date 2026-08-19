---
title: 主题矩阵
description: 按六条学习主线、系统层级和架构家族交叉检索 AI 计算全栈协同设计文档。
outline: deep
products: ["跨架构"]
documentType: "主题索引"
topics: ["模型计算", "全栈映射", "硬件架构", "软件优化", "协同设计", "性能验证"]
---

# 主题矩阵

一篇文章通常同时涉及模型、计算、存储、调度和软件栈，因此不适合被强行塞进唯一分类。这里使用多维索引：侧边栏回答“这是什么类型的文档”，[课程蓝图](./curriculum.md)回答“它属于哪条学习主线”，本页回答“它研究了哪些系统问题”。

## 六条主线

| 主线 | 核心问题 | 当前入口 |
| --- | --- | --- |
| 模型计算与 Workload | 模型产生什么计算、数据、状态和通信？ | [计算原语与 Workload](./notes/model-computation-primitives.md) |
| 模型到硬件的完整映射 | Operation 怎样逐层变成设备执行？ | [完整映射链](./notes/model-to-hardware-mapping.md)、[推理框架与运行时](./notes/inference-stack.md) |
| 硬件架构 | 硬件提供什么资源，把什么责任交给软件？ | [四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md) |
| 软件优化 | 怎样减少执行、数据移动、同步和空闲？ | [跨架构优化方法](./notes/software-optimization-methodology.md)、[Groq 优化案例](./notes/software-optimization.md) |
| 模型—硬件协同设计 | 什么时候应该改变模型、数值或硬件契约？ | [协同设计框架](./notes/model-hardware-codesign.md)、[GPU + LPX 案例](./notes/nvidia-groq3-heterogeneous-inference.md) |
| 性能建模与验证 | 怎样定量判断瓶颈并证伪结论？ | [性能模型与实验契约](./notes/performance-modeling.md)、三个现有实验 |

## 五个研究维度

以下五个维度用于横向检查每篇文档覆盖了哪些系统问题，它们与六条学习主线互补。

| 维度 | 核心问题 |
| --- | --- |
| **计算组织** | 工作怎样映射到 SIMT、functional slices、dataflow cores 或 systolic array？ |
| **控制与调度** | 下一步由硬件、编译器、runtime，还是三者协同决定？ |
| **数据移动** | Tile 如何穿过 registers、SRAM、cache、NoC、HBM 和芯片互连？ |
| **软件栈** | 图编译、kernel、runtime、memory planning 和优化分别负责什么？ |
| **系统扩展** | 单芯片机制如何扩展到多芯片、Pod、异构推理和在线服务？ |

## 文档 × 主题

**●** 表示主问题，**○** 表示文章覆盖但不是主线。

| 文档 | 计算组织 | 控制与调度 | 数据移动 | 软件栈 | 系统扩展 |
| --- | :---: | :---: | :---: | :---: | :---: |
| [模型计算原语与 Workload](./notes/model-computation-primitives.md) | ● | ○ | ● |  | ○ |
| [模型到硬件的完整映射](./notes/model-to-hardware-mapping.md) | ○ | ● | ● | ● | ○ |
| [四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md) | ● | ● | ● | ○ | ○ |
| [跨架构软件优化方法](./notes/software-optimization-methodology.md) | ○ | ○ | ● | ● | ○ |
| [模型—硬件协同设计](./notes/model-hardware-codesign.md) | ○ | ○ | ● | ● | ● |
| [性能建模与验证](./notes/performance-modeling.md) | ○ | ○ | ● | ○ | ● |
| [NVIDIA GPU：Tile 流水与同步](./notes/nvidia-gpu-synchronization.md) | ○ | ● | ● | ○ | ○ |
| [Groq TSP：ISCA 架构导读](./notes/architecture.md) | ● | ● | ● | ○ | ○ |
| [Tenstorrent：Tensix 与软件栈](./notes/tenstorrent-architecture.md) | ● | ● | ● | ● | ○ |
| [Google TPU：Systolic Array 与 Pod](./notes/google-tpu-architecture.md) | ● | ○ | ● | ● | ● |
| [ISA 与指令流](./notes/instruction-flow.md) | ○ | ● | ○ | ○ |  |
| [静态编译与调度](./notes/compiler.md) | ○ | ● | ○ | ● |  |
| [推理框架与运行时边界](./notes/inference-stack.md) |  | ○ | ○ | ● | ○ |
| [软件优化方法](./notes/software-optimization.md) | ○ | ○ | ● | ● | ○ |
| [LPU/TSP 与 GPU](./notes/lpu-vs-gpu.md) | ● | ● | ● | ○ |  |
| [Groq、Tensix 与 GPU](./notes/groq-tenstorrent-comparison.md) | ● | ● | ● | ○ | ○ |
| [从 GPU SM 到 Tensix](./notes/tenstorrent-rethinking-gpu-sm.md) | ● | ● | ● | ○ |  |
| [GPU + LPX 异构推理](./notes/nvidia-groq3-heterogeneous-inference.md) | ○ | ○ | ● | ● | ● |

## 实验 × 可观察机制

| 实验 | 主要观察量 | 对应研究维度 |
| --- | --- | --- |
| [静态时空调度](./labs/static_scheduler.md) | 指令排程、资源冲突、确定性 | 控制与调度 |
| [Tensix 流水与背压](./labs/tensix_pipeline.md) | reader/compute/writer 队列、吞吐与 stall | 数据移动、控制与调度 |
| [Systolic Array 波前](./labs/systolic_array.md) | wavefront、利用率、边界效应 | 计算组织、数据移动 |

## 推荐入口

- 遇到同名不同义的 core、tile、memory 或 completion：先查[共享术语表](./glossary.md)。
- 想建立全局坐标系：先读[四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md)。
- 想理解“谁负责调度”：依次读 [GPU 同步](./notes/nvidia-gpu-synchronization.md)、[Groq 编译器](./notes/compiler.md)和[Tensix 架构](./notes/tenstorrent-architecture.md)。
- 想研究数据移动：对照 [LPU/TSP 与 GPU](./notes/lpu-vs-gpu.md)、[Google TPU](./notes/google-tpu-architecture.md)和[Tensix 流水实验](./labs/tensix_pipeline.md)。
- 想进入部署层：读[推理框架与运行时边界](./notes/inference-stack.md)及[GPU + LPX 异构推理](./notes/nvidia-groq3-heterogeneous-inference.md)。
