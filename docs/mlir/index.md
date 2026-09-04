---
title: "MLIR Backend 入门"
description: "面向 AI Compiler Backend 的结构化 MLIR 教程，从 IR、Pass 和 Dialect Conversion 走到 accelerator mapping、NVVM 与性能验证。"
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "结构化教程"
topics: ["编译器", "IR", "Lowering", "硬件映射", "性能验证"]
---

# MLIR Backend 入门

这套教程不按 API 字母表展开。它围绕一条可验证的主线组织：读懂 IR，运行和调试 Pass，建立 Dialect 与 Conversion contract，再把一个 MatMul 推进到 tile、buffer、DMA、engine schedule 和 target codegen。

::: tip 学习结果
完成后，你应该能白板讲清楚 AI Compiler pipeline，并能用本地 `llvm-project` 复现最小 lowering 实验。
:::

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
| IR 基础 | Operation、Region、Block、Value 如何组成程序？ | 能逐行拆解 MLIR |
| Pass 与 Rewrite | 编译器如何安全修改 IR？ | 能定位 Pass 未生效 |
| Dialect 与 Conversion | 如何定义抽象边界和合法性？ | MiniBPU target contract |
| Accelerator Mapping | MatMul 如何映射到硬件？ | Tiling、Memory、DMA、Schedule 分析 |
| Target 与验证 | 如何追踪到 NVVM/PTX 并证明正确？ | FileCheck 与性能证据链 |

## 两种节奏

- **两天冲刺：** 先掌握 IR、Progressive Lowering、Dialect Conversion 和 MatMul mapping，目标是面试可讲清楚。
- **三周工程路线：** 增加 ODS、PatternRewriter、测试和 MiniBPU 结课项目，目标是做出一个完整 compiler slice。

## 边界

- 重点是 AI Compiler Backend，不展开完整 frontend 或训练框架接入。
- GPU / NVVM 是可观察的类比平台，不代表 BPU 的真实内部实现。
- DPX 用于演示 instruction selection，不是教程中心。
- 没有 simulator 校准或真机数据时，不声称 lowering 带来性能提升。

下一步从左侧目录进入各章。每读一章，至少执行一个最小实验。
