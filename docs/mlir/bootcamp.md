---
title: "12 小时 AI Compiler + C++ 入门"
description: "两天、12 小时，从同一个 MatMul 案例连接模型、IR、Kernel 与硬件，并通过 C++ 修错和微型 Pass 找回代码推理能力。"
outline: deep
products: ["MLIR", "C++", "AI Accelerator"]
documentType: "学习路线"
topics: ["AI Compiler", "C++", "入门", "实践", "讨论"]
---

# 12 小时 AI Compiler + C++ 入门

适合已经接触 C++、Clang/GCC 或 GPU，但模型、IR、Kernel 和硬件还没有连起来的读者。两天后，你应该能用一个具体例子讨论 Compiler 决策，并自己读懂、修改和验证一小段 C++。

**共 720 分钟：AI Compiler 480 分钟，C++ 240 分钟。每天 6 小时有效学习，休息另计。** 下面每段时间已包含阅读、练习和复述，不需要再叠加整篇延伸资料。

## 从哪里开始

全程使用 `Y = ReLU(X @ W + bias)`。先看它计算什么，再看数据怎样移动、Compiler 怎样改变程序，以及优化为什么可能失败。

- 在电脑上：准备 Python 3 和支持 C++17 的 compiler。核心实验不依赖 GPU、PyTorch 或完整 LLVM build。
- 在手机上：阅读正文、手算、看带来源的代码和折叠答案；标记动手任务，之后在电脑完成。
- 已有 `mlir-opt`：可运行附加 IR 实验。尚未安装时，先读明确标注的参考输出；完成环境构建不是这 12 小时的前置条件。

## Day 1：连接层级，找回代码手感

| 单元 | 分钟 | 内容与任务 | 完成证据 |
| --- | ---: | --- | --- |
| [1. 执行全景](./model-to-kernel.md) | 60 | 模型表达式、Graph、IR、Kernel、Runtime；区分编译与执行 | 用自己的话解释一次调用；给每层写出输入和输出 |
| [2. 一个算子到一个程序](./model-to-kernel.md#block-2) | 90 | MatMul shape、循环、Bias/ReLU、Fusion；运行 CPU 对照实验 | 数值相同；解释省掉的中间数据和模型假设 |
| [3. C++ 回温 A](./cpp-refresh.md) | 120 | 值/引用、生命周期、RAII、容器失效、Copy/Move；预测与修错 | 修复三个小任务，并解释每个对象的所有者 |
| [4. 看懂一处 IR 变化](./ir-reading.md) | 90 | 逐行读 MLIR；区分 Canonicalization、CSE、Lowering | 标出定义与使用；解释变换为什么合法 |

Day 1 的结束问题：**同一个计算为什么会有多种表示？C++ 代码里的对象生命周期与 IR 中 Value 的依赖有什么区别？**

## Day 2：讨论映射，实现小变换

| 单元 | 分钟 | 内容与任务 | 完成证据 |
| --- | ---: | --- | --- |
| [5. Tile 怎样执行](./mapping-lab.md) | 90 | Layout、Buffer、SRAM、DMA、同步；改变一个 tile 参数 | 算出 working set；解释一个容量失败和一个可行方案 |
| [6. C++ 回温 B](./cpp-labs.md) | 120 | 类、模板、Lambda、LLVM 类型；实现微型 Constant Folding Pass | 常量被折叠、变量路径保留；正例与边界测试通过 |
| [7. 真实项目对照](./real-world.md) | 60 | Triton、TileLang、IREE、StableHLO 与 PyTorch 的职责 | 能解释各自位于哪一层，以及一项实际用途 |
| [8. 性能与数值](./mapping-lab.md#单元-8-性能与数值-60-分钟) | 60 | FLOPs/Bytes、Roofline、INT8、shape 变化；运行分析脚本 | 分清下界、模型预测和实测；说明量化误差来源 |
| [9. 讨论演练](./discussion.md) | 30 | 5 分钟案例讲解，随后回答条件变化的追问 | 给出理由、代价、验证方法和不知道的部分 |

## 学习方法

每个知识点按“先判断 → 写下理由 → 修改或手算 → 运行验证 → 对照答案 → 改一个条件”进行。先独立尝试 5–10 分钟，再查看提示。AI 可以解释报错或 review 你的改动；练习的第一版判断由你自己完成。

例如，先预测 `std::move` 后调用 Copy 还是 Move；再把输入加上 `const` 重做一次。对于 Compiler，先判断 Fusion 省掉什么，再问它增加了什么资源压力。

## 你会交付什么

1. 一页从模型到设备执行的解释，每层都有具体输入、输出和责任。
2. 一份 MatMul/Fusion/Tile/INT8 的实验记录，区分事实、假设和未测量项。
3. C++ 三个修错任务与一个微型 Pass，保留预测和实际结果。
4. 一段 5 分钟讲解，以及 8 个核心讨论题的回答。

“读过章节”不等于完成。实验输出、自己写的解释和能够应对一次条件变化，才是这轮的完成标准。

## 深入内容何时再学

自定义 Dialect、ODS、完整 Dialect Conversion、NVVM/DPX、真实 BPU codegen、cycle-accurate simulator 和多芯片系统属于后续工程路线。需要时通过现有侧栏查阅，不计入这 12 小时。

当前[真实项目导读](./real-world.md)、[IR 基础](./ir-foundations.md)和[硬件映射](./accelerator-mapping.md)可作为参考。本站的工程计划仍保留在[测试与结课项目](./testing-study-plan.md)。
