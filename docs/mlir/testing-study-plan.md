---
title: "MLIR 测试、学习计划与结课项目"
description: "12 小时入门后的进阶参考：用 Parse/Verify、FileCheck、Codegen 与 End-to-end evidence 验证 MiniBPU Compiler Slice。"
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "学习计划"
topics: ["测试", "FileCheck", "学习路线", "结课项目"]
---

# MLIR 测试、学习计划与结课项目

Compiler 最危险的失败不是 Crash，而是 Silent miscompile。学习 MLIR 时要把测试看成 IR contract 的可执行定义。

## 四层验证

| 层级 | 证明什么 | 方法 |
| --- | --- | --- |
| Parse/Verify | IR 满足结构与语义约束 | `mlir-opt input -o /dev/null` |
| Pass | Rewrite/Lowering 结构正确 | lit + FileCheck |
| Translation/Codegen | Target IR 或指令出现 | `mlir-translate`、`llc` |
| End-to-end | 数值与性能 | Runtime、Simulator、Hardware benchmark |

FileCheck 文本匹配不能证明数值正确，单个 End-to-end 测试也不能替代细粒度 Negative test。

## 最小 FileCheck

```mlir
// RUN: mlir-opt %s -canonicalize | FileCheck %s

// CHECK-LABEL: func.func @add_zero
// CHECK-NOT: arith.addi
func.func @add_zero(%x: i32) -> i32 {
  %c0 = arith.constant 0 : i32
  %r = arith.addi %x, %c0 : i32
  func.return %r : i32
}
```

避免过度匹配 SSA 编号、无关 Operation 顺序和默认 Attribute。优先断言 Target Operation、Type、关键 Attribute、Boundary condition 与 Diagnostic。

## Negative Test

自定义 Target Operation 至少覆盖：

- Unsupported dtype；
- 非法 Tile shape；
- 错误 Memory Space 或 Alignment；
- Layout 不兼容；
- 缺失 Terminator 或 Event dependency；
- Full Conversion 无法消除 Illegal Operation。

使用 `-verify-diagnostics` 锁定可行动的错误信息。

## 性能证据链

```text
IR Pattern
  → Target Instruction
  → Simulator Prediction
  → Microbenchmark Measurement
  → End-to-end Workload Impact
```

每一级都可能失败：Instruction 出现但 Resource pressure 上升；Kernel 变快但 Layout copy 抵消收益；Simulator 未经过 Silicon calibration。

## 两天入门：使用新的 12 小时路线

旧版把 IR、Conversion、硬件映射和 Target 工程同时压进两天，缺少背景和 C++ 动手铺垫。现在统一从 [12 小时 AI Compiler + C++ 入门](./bootcamp.md)开始：8 小时概念与观察实验，4 小时 C++ 预测、修错和微型 Pass。完成标准是能用例子参与讨论并给出验证方法。

本页的 FileCheck、自定义 Operation 和 MiniBPU 项目保留为进阶内容，不计入入门的 720 分钟。

## 三周工程路线

| 周 | 内容 | 验收 |
| --- | --- | --- |
| 第 1 周 | IR、SSA、Dialect、Pass Pipeline | 能定位 Parse/Verify/Anchor 问题 |
| 第 2 周 | PatternRewriter、ODS、Conversion、FileCheck | Target contract 与正负测试 |
| 第 3 周 | MiniBPU、Mapping、Simulator estimate | 完整 Compiler Slice Demo |

每天采用“概念 20 分钟 + 实验 40 分钟 + 复盘 10 分钟”。学习记录只写 Bounded question、最小实验、观察到的 IR 变化和一个未解问题。

## MiniBPU 结课项目

### 输入

静态 Shape 的 `linalg.matmul`，先支持一种 dtype；Bias/ReLU 作为可选扩展。

### 输出

```text
minibpu.command_buffer {
  %e0 = minibpu.dma_start ...
  minibpu.wait %e0
  minibpu.matmul_tile ...
  %e1 = minibpu.dma_start ...
  minibpu.wait %e1
}
```

第二个 Consumer 生成简单 Simulator trace，记录 Engine、Dependency、Bytes 和 Estimated cycles。

### 必做范围

- 3–5 个 Target Operation；
- Verifier 和 Memory Effect；
- 一个 Lowering Pass；
- 一个 Dynamic Legality 条件；
- FileCheck 正例、Negative test 和 Unsupported Diagnostic；
- 一个 Roofline-style estimate；
- README 和 20 分钟 Demo。

### 明确不做

- 完整 ONNX Frontend；
- 完整 Auto-tuner；
- 真实 BPU Binary Encoding；
- Cycle-accurate Simulator；
- 多型号 Hardware 全覆盖。

项目价值在于展示从 High-level Operation 到 Target contract、Schedule 和 Validation 的完整闭环，而不是代码量。

## 白板验收题

1. 为什么一个 Module 可以混合多个 Dialect？
2. Operation、Region、Block 和 Value 如何关联？
3. SSA Loop-carried value 如何表达？
4. Canonicalization、CSE 与 Dialect Conversion 有何区别？
5. Pass Anchoring 为什么会让 Pass 看似未执行？
6. MatMul Lowering 为什么不只是 Instruction Selection？
7. Tile size 受哪些 Compute/Memory 约束？
8. Double Buffering 隐藏什么，代价是什么？
9. Legality 与 Profitability 为什么分开？
10. Performance Simulator 如何校准？
11. 一个 Unsupported Operation 应如何处理？
12. 什么证据才能支持“这个 Lowering 更快”？

每题先用一句话给出结论，再用一个具体例子展开到 1–2 分钟。
