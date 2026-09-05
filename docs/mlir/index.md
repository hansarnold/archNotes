---
title: "MLIR Backend 入门"
description: "面向 AI Compiler Backend 的结构化 MLIR 教程，从 IR、Pass 和 Dialect Conversion 走到 accelerator mapping、NVVM 与性能验证。"
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "结构化教程"
topics: ["编译器", "IR", "Lowering", "硬件映射", "性能验证"]
---

# MLIR Backend 入门

所属分区：[AI Compiler](../compiler/index.md) · **MLIR 实现专题**。这里仅组织 IR、Pass、Dialect、Conversion 与 Backend 实践。如果还没有连起模型与 Kernel，先走独立的[概念路线](./bootcamp.md)。

这套教程不按 API 字母表展开。它先用 Triton、IREE、StableHLO 和 TileLang 建立真实项目背景，再围绕一条可验证的主线组织：读懂 IR，运行和调试 Pass，建立 Dialect 与 Conversion contract，最后把一个 MatMul 推进到 tile、buffer、DMA、engine schedule 和 target codegen。

::: tip 学习结果
完成后，你应该能白板讲清楚 AI Compiler pipeline，并能用本地 `llvm-project` 复现最小 lowering 实验。
:::

## 先从真实项目开始

如果你现在还分不清 MLIR、Triton、TileLang、TVM 和 Runtime 各自处在哪一层，先读 [真实项目中的 MLIR](./real-world.md)。它会用一项 BPU INT8 MatMul 任务解释：

- Triton 为什么确实是 MLIR-based compiler；
- TileLang 为什么使用 TVM TIR，却仍适合作为 kernel scheduling 的对照；
- IREE 的 `Flow → Stream → HAL` 为什么能帮助理解完整 accelerator compiler；
- Operation、Dialect、Pass、Conversion 分别对应哪一种工程工作。

读完这页，再进入 IR 结构，会更容易判断一个抽象正在解决什么问题。

## 一条主线

```text
Model / Graph
  → Tensor IR
  → Tiling / Layout / Bufferization
  → Target Legalization
  → DMA / Compute / Barrier Schedule
  → Codegen or Simulator Trace
```

## 阅读路径

| 阶段 | 核心问题 | 实际产出 |
| --- | --- | --- |
| 真实场景 | MLIR 在真实 compiler stack 的什么位置？ | 画出项目与 BPU pipeline 对照图 |
| IR 基础 | Operation、Region、Block、Value 如何组成程序？ | 能逐行拆解 MLIR |
| Pass 与 Rewrite | 编译器如何安全修改 IR？ | 能定位 Pass 未生效 |
| Dialect 与 Conversion | 如何定义抽象边界和合法性？ | MiniBPU target contract |
| Accelerator Mapping | MatMul 如何映射到硬件？ | Tiling、Memory、DMA、Schedule 分析 |
| Target 与验证 | 如何追踪到 NVVM/PTX 并证明正确？ | FileCheck 与性能证据链 |

## 按当前基础进入

- **先补全景：** 去 [AI Compiler 概念路线](./bootcamp.md)连接层级，再回来深入实现。
- **三周工程路线：** 增加 ODS、PatternRewriter、测试和 MiniBPU 结课项目，目标是做出一个完整 compiler slice。

## 边界

- 重点是 AI Compiler Backend，不展开完整 frontend 或训练框架接入。
- GPU / NVVM 是可观察的类比平台，不代表 BPU 的真实内部实现。
- DPX 用于演示 instruction selection，不是教程中心。
- 没有 simulator 校准或真机数据时，不声称 lowering 带来性能提升。

下一步从左侧目录进入各章。每读一章，至少执行一个最小实验。
