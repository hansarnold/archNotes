---
title: AI Compute Full-Stack Co-design
description: 从 Model Computation、Compiler 与 Software Optimization 到 Hardware Architecture、多芯片系统和 Performance Validation 的双向学习体系。
outline: deep
products: ["跨架构"]
documentType: "知识入口"
topics: ["模型计算", "全栈映射", "架构比较", "软件优化", "协同设计", "性能验证"]
---

# AI Compute Full-Stack Co-design

archNotes 研究 Model Computation 怎样经过 Compiler、Runtime 和 Kernel 落到硬件，也研究 Memory、Compute、Interconnect 和系统约束怎样反向塑造模型、数值与 Software Optimization。NVIDIA GPU、Groq LPU/TSP、Tenstorrent Tensix 和 Google TPU 是四组架构案例，而不是内容边界。

内容以[六条主线课程蓝图](./curriculum.md)为骨架，以[主题矩阵](./topics.md)进行交叉索引；侧边栏继续按文档用途组织，避免把厂商、抽象层级和文章类型混在一起。

![四列对比：NVIDIA GPU 由 runtime 和 warp scheduler 动态选工；Groq 由 compiler 的 time-space plan 驱动 SRAM stream；Tensix 由 Reader、Compute、Writer 通过 circular buffer 交接；TPU 由 XLA schedule 和 systolic wave 推进 tile](./assets/diagrams/tile-execution-models.svg "四种架构使用同一组比较轴，但 Tile 的调度者、Memory 路径和 Compute 目的地不同。")

## 从统一分析坐标系开始

有意义的比较不是 peak throughput 排名。分析每一种架构时，都先回答同一组问题：

- 计算在哪里发生？
- 哪一级 Memory 为 Compute Unit 提供数据？
- 谁负责 Scheduling 下一项 Operation？
- 一个 Tile 怎样在 Pipeline Stage 和 chip 之间移动？
- 什么证据能够证明该项工作已经 Completion，而且结果已经可见？

## 选择阅读方式

- **先用两天连接概念：** [12 小时 AI Compiler 入门 + C++ 复习](./mlir/bootcamp.md)，用 MatMul 串起模型、IR、Kernel 和硬件，配套 C++ 修错与微型 Pass；不要求 GPU。
- **写过 C++，需要查漏：** [C++ 复习速查](./cpp/index.md)，7 个专题、84 条易忘要点，配短例子、边界提醒和自测。
- **按六条主线：** 从[课程蓝图](./curriculum.md)进入 Model Computation and Workload、Model-to-Hardware Mapping、Hardware Architecture、Software Optimization、Model–Hardware Co-design 和 Performance Modeling and Validation。
- **按学习顺序：** 从[学习路线](./notes/learning-roadmap.md)开始，逐步进入架构、机制、软件栈和系统扩展。
- **按架构对象：** 在“架构专论”中分别阅读 NVIDIA GPU、Groq TSP、Tenstorrent Tensix 和 Google TPU。
- **按技术问题：** 使用[主题矩阵](./topics.md)，横向查找计算组织、调度、数据移动、软件栈或系统扩展。
- **按概念查阅：** 使用 [Glossary](./glossary.md)，统一跨文章反复出现的 canonical English terminology。
- **按证据验证：** 进入“实验验证”，用可运行模型观察调度、背压与 systolic wavefront。

## 六条学习主线

| 主线 | 入口 | 首要问题 |
| --- | --- | --- |
| Model Computation and Workload | [Model Computation Primitives and Workload Description](./notes/model-computation-primitives.md) | 模型产生了哪些 Operation、数据、状态和 Communication？ |
| Model-to-Hardware Mapping | [Model-to-Hardware Mapping](./notes/model-to-hardware-mapping.md) | Operation 怎样变成真实的硬件执行？ |
| Hardware Architecture | [AI Accelerator Architecture Comparison](./notes/ai-accelerator-architecture-comparison.md) | 资源在哪里，Ownership 怎样划分？ |
| Software Optimization | [Cross-Architecture Software Optimization](./notes/software-optimization-methodology.md) | 怎样减少 Data Movement、等待和无效工作？ |
| Model–Hardware Co-design | [Model–Hardware Co-design](./notes/model-hardware-codesign.md) | 何时需要改变 Cross-layer Contract？ |
| Performance Modeling and Validation | [Performance Modeling and Validation](./notes/performance-modeling.md) | 怎样预测、测量并证伪结论？ |

## 四种 Execution Model

- **NVIDIA GPU：** Dynamic Scheduling 经由 register、Shared Memory、Cache 和 HBM，为 tensor 与 scalar Execution Pipeline 持续提供可执行的工作。
- **Groq TSP：** Compiler 规划 tensor stream 何时、在何处经过各个 Functional Slice。
- **Tenstorrent Tensix：** Reader、Compute 与 Writer Kernel 通过 Circular Buffer 和 programmable mesh 交换 Tile。
- **Google TPU：** XLA 为 MXU Systolic Array 的 Wavefront、VMEM/HBM Data Movement 和 ICI Collective Communication 安排分块工作。

接下来可以阅读[学习路线](./notes/learning-roadmap.md)、查看[主题矩阵](./topics.md)，或从侧边栏进入完整的架构比较。
