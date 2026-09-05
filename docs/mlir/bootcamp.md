---
title: "两天 AI Compiler 概念路线"
description: "两天、8 小时核心路线，用同一个 MatMul 连接模型、IR、Kernel 与硬件；C++ 作为独立的可选复习。"
outline: deep
products: ["AI Compiler", "MLIR", "AI Accelerator"]
documentType: "学习路线"
topics: ["AI Compiler", "入门", "实践", "讨论"]
---

# 两天 AI Compiler 概念路线

适合已经接触 C++、Clang/GCC 或 GPU，但模型、IR、Kernel 和硬件还没有连起来的读者。两天后，你应该能用一个具体例子讨论 Compiler 决策，并区分假设、预测与实测证据。

**核心 480 分钟：每天 4 小时有效学习，休息另计。** 每段时间已包含阅读、练习和复述；可选的 4 小时 C++ 复习单列在后面。

## 从哪里开始

全程使用 `Y = ReLU(X @ W + bias)`。先看它计算什么，再看数据怎样移动、Compiler 怎样改变程序，以及优化为什么可能失败。

- 在电脑上：准备 Python 3。独立 C++ 练习才需要支持 C++17 的 compiler。核心实验不依赖 GPU、PyTorch 或完整 LLVM build。
- 在手机上：阅读正文、手算、看带来源的代码和折叠答案；标记动手任务，之后在电脑完成。
- 已有 `mlir-opt`：可运行附加 IR 实验。尚未安装时，先读明确标注的参考输出；完成环境构建不是核心路线的前置条件。

## Day 1：模型、Kernel 与 IR · 240 分钟

| 单元 | 分钟 | 内容与任务 | 完成证据 |
| --- | ---: | --- | --- |
| [1. 执行全景](./model-to-kernel.md) | 60 | 模型表达式、Graph、IR、Kernel、Runtime；区分编译与执行 | 用自己的话解释一次调用；给每层写出输入和输出 |
| [2. 一个算子到一个程序](./model-to-kernel.md#block-2) | 90 | MatMul shape、循环、Bias/ReLU、Fusion；运行 CPU 对照实验 | 数值相同；解释省掉的中间数据和模型假设 |
| [3. 看懂一处 IR 变化](./ir-reading.md) | 90 | 逐行读 MLIR；区分 Canonicalization、CSE、Lowering | 标出定义与使用；解释变换为什么合法 |

Day 1 的结束问题：**同一个计算为什么会有多种表示？每次变换必须保留哪些语义？**

## Day 2：映射、项目与证据 · 240 分钟

| 单元 | 分钟 | 内容与任务 | 完成证据 |
| --- | ---: | --- | --- |
| [4. Tile 怎样执行](./mapping-lab.md) | 90 | Layout、Buffer、SRAM、DMA、同步；改变一个 tile 参数 | 算出 working set；解释一个容量失败和一个可行方案 |
| [5. 真实项目对照](./real-world.md) | 60 | Triton、TileLang、IREE、StableHLO 与 PyTorch 的职责 | 能解释各自位于哪一层，以及一项实际用途 |
| [6. 性能与数值](./mapping-lab.md#单元-8-性能与数值-60-分钟) | 60 | FLOPs/Bytes、Roofline、INT8、shape 变化；运行分析脚本 | 分清下界、模型预测和实测；说明量化误差来源 |
| [7. 讨论演练](./discussion.md) | 30 | 5 分钟案例讲解，随后回答条件变化的追问 | 给出理由、代价、验证方法和不知道的部分 |

## 可选搭配：C++ 复习独立安排

如果仍按原来的 12 小时组合学习：Day 1 结束后另做 2 小时 [C++ 复习 A](./cpp-refresh.md)，Day 2 结束后另做 2 小时[复习 B](./cpp-labs.md)。合计 **8 + 4 = 12 小时**，但不在 Compiler 正文之间插课。

完整速查、修错和微型 Pass 归 [C++ 分区](../cpp/index.md)。语言手感足够时可跳过；Compiler 的验收不再考 C++ 语言规则。

## 学习方法

每个知识点按“先判断 → 写下理由 → 修改或手算 → 运行验证 → 对照答案 → 改一个条件”进行。先独立尝试 5–10 分钟，再查看提示。AI 可以解释报错或 review 你的改动；练习的第一版判断由你自己完成。

例如，先判断 Fusion 省掉什么，再改变 Shape，追问它增加了什么资源压力。

## 你会交付什么

1. 一页从模型到设备执行的解释，每层都有具体输入、输出和责任。
2. 一份 MatMul/Fusion/Tile/INT8 的实验记录，区分事实、假设和未测量项。
3. 一段 5 分钟讲解，以及 6 个核心讨论题的回答。

“读过章节”不等于完成。实验输出、自己写的解释和能够应对一次条件变化，才是这轮的完成标准。

## 深入内容何时再学

自定义 Dialect、ODS、完整 Dialect Conversion、NVVM/DPX、真实 BPU codegen、cycle-accurate simulator 和多芯片系统属于后续工程路线。需要时通过现有侧栏查阅，不计入核心 8 小时。

当前[真实项目导读](./real-world.md)、[IR 基础](./ir-foundations.md)和[硬件映射](./accelerator-mapping.md)可作为参考。本站的工程计划仍保留在[测试与结课项目](./testing-study-plan.md)。
