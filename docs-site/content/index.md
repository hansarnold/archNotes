---
title: AI Accelerator Architecture
description: A comparative learning map for NVIDIA GPU, Groq TSP, Tenstorrent Tensix, and Google TPU.
outline: deep
products: ["跨架构"]
documentType: "知识入口"
topics: ["统一坐标系", "学习路径", "架构比较"]
---

# AI Accelerator Architecture

This documentation builds one shared mental model for four accelerator families: NVIDIA GPU, Groq LPU/TSP, Tenstorrent Tensix, and Google TPU. Follow the same unit of work—a tile—through compute, memory, compiler scheduling, and interconnects to see where each architecture places responsibility.

内容采用两套互补的组织方法：侧边栏按**文档用途**组织，避免把厂商、抽象层级和文章类型混在一起；[主题矩阵](/topics)则按**系统层级 × 架构家族**进行交叉索引。

![Four execution models for moving a tile through an AI accelerator](/assets/tile-execution-models.png)

## Start with the shared coordinate system

The useful comparison is not a peak-throughput ranking. Ask the same questions of every system:

- Where does computation happen?
- Which memory level feeds it?
- Who schedules the next operation?
- How does a tile move between stages and chips?
- What proves that the result is complete and visible?

## Choose a reading mode

- **按学习顺序：** 从[学习路线](/notes/learning-roadmap)开始，逐步进入架构、机制、软件栈和系统扩展。
- **按架构对象：** 在“架构专论”中分别阅读 NVIDIA GPU、Groq TSP、Tenstorrent Tensix 和 Google TPU。
- **按技术问题：** 使用[主题矩阵](/topics)，横向查找计算组织、调度、数据移动、软件栈或系统扩展。
- **按证据验证：** 进入“实验验证”，用可运行模型观察调度、背压与 systolic wavefront。

## Four execution models

- **NVIDIA GPU:** dynamic warp scheduling feeds tensor and scalar pipelines through registers, shared memory, caches, and HBM.
- **Groq TSP:** the compiler plans when and where tensor streams cross specialized functional slices.
- **Tenstorrent Tensix:** reader, compute, and writer kernels exchange tiles through circular buffers and a programmable mesh.
- **Google TPU:** XLA schedules tiled work for MXU systolic wavefronts, VMEM/HBM movement, and ICI collectives.

Continue with the [learning roadmap](/notes/learning-roadmap), inspect the [topic matrix](/topics), or open the full architecture comparison from the sidebar.
