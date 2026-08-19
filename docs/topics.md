---
title: 主题矩阵
description: 按系统层级和架构家族交叉检索 AI 加速器学习笔记。
outline: deep
products: ["跨架构"]
documentType: "主题索引"
topics: ["计算组织", "控制与调度", "数据移动", "软件栈", "系统扩展"]
---

# 主题矩阵

一篇架构文章通常同时涉及计算、存储、调度和软件栈，因此不适合被强行塞进唯一的“技术分类”。这里使用多维索引：侧边栏回答“这是什么类型的文档”，本页回答“它研究了哪些系统问题”。

## 五个研究维度

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
| [四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md) | ● | ● | ● | ○ | ○ |
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
