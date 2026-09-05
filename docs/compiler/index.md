---
title: "AI Compiler"
description: AI Compiler 分区：先用两天连接模型、IR、Kernel 与硬件，再进入独立的 MLIR 实现专题。
outline: deep
products: ["AI Compiler"]
documentType: "分区入口"
topics: ["Compiler Pipeline", "Learning Route", "MLIR"]
---

# AI Compiler

这个分区回答：模型里的计算，怎样变成设备上可执行、可验证的程序？先学通用问题，再进入具体实现。

## 概念路线：先把层级连起来

[两天 AI Compiler 路线](../mlir/bootcamp.md)用同一个 MatMul 串起模型、IR、Kernel、Runtime 与硬件。核心内容 8 小时，不要求 GPU 或完整 LLVM Build。

1. [模型到 Kernel](../mlir/model-to-kernel.md)：每一层的输入、输出与职责。
2. [读懂 IR 变化](../mlir/ir-reading.md)：用 MLIR 小例子观察 Compiler 怎样改程序。
3. [Tile、Memory 与性能](../mlir/mapping-lab.md)：数据移动、资源约束与数值。
4. [真实项目对照](../mlir/real-world.md)：Triton、TileLang、IREE 各解决什么问题。
5. [讨论与验收](../mlir/discussion.md)：解释选择、代价和验证方法。

## MLIR 专题：再学习一种实现技术

[进入 MLIR 专题](../mlir/index.md)，深入 Operation / Region / Block、Dialect、Pass、Rewrite、Conversion 与 Lowering。它属于 AI Compiler 的实现路线，不等于整个 AI Compiler 领域。

已经能解释 Graph、IR、Kernel 各自负责什么，就可以直接进入；否则先走概念路线。进入专题后，侧栏只显示 MLIR 章节。

## 相关资料，不是必读前置课

- 想确认硬件约束：[硬件架构分区](../architecture/index.md)。
- 读源码时忘了语言细节：[C++ 复习分区](../cpp/index.md)。C++ 是独立工具知识，不插在 Compiler 正文阅读顺序中。
