---
title: "逐行看懂一处 IR 变化"
description: "用两个独立的 MLIR 例子观察 Canonicalization 和 CSE，建立 Operation、Value、Type、Dialect 和 Pass 的直觉。"
outline: deep
products: ["MLIR", "C++"]
documentType: "观察实验"
topics: ["IR", "SSA", "Canonicalization", "CSE", "Lowering"]
---

# 逐行看懂一处 IR 变化

Day 1 单元 3，90 分钟：结构 20、读代码 20、两个观察各 15、复述 20。先完成[模型到 Kernel](./model-to-kernel.md)，理解 IR 是 Compiler 的程序表示。

## 先认识五个构件

| 构件 | 怎么读 | 本例 |
| --- | --- | --- |
| Operation | 做一件事的节点 | `arith.addi` 做整数加法 |
| Value | 节点结果或 Block 参数 | `%x`、`%sum` |
| Type | Value 的解释和约束 | `i32` 是 32-bit integer |
| Dialect | 一组相关 Operation/Type 及规则 | `arith`、`func` |
| Pass | 遍历并分析或变换 IR 的一次步骤 | `canonicalize`、`cse` |

一个 Operation 可以有零个或多个结果，也可以包含 Region。这里先看只有一个函数、一个 Block 的小例子，循环与多个 Block 留到[IR 基础](./ir-foundations.md)。

## 逐行读这段代码

```mlir
module {
  func.func @add_zero(%x: i32) -> i32 {
    %zero = arith.constant 0 : i32
    %sum = arith.addi %x, %zero : i32
    return %sum : i32
  }
}
```

`module` 容纳这个程序。`func.func` 声明函数；`@add_zero` 是函数 Symbol，`%x` 是参数 Value。`%zero` 由常量 Operation 定义，`%sum` 使用两个已有 Value。`return` 是这里 `func.return` 的简写。

`%sum` 是一个 SSA 名称，不是可以反复赋值的 C++ 变量。想改变计算，Compiler 会改写 IR 的节点和引用关系；执行 IR 时，Value 表示该次计算的数据结果。

### 观察 A：加零可以消失吗

先找出谁使用 `%zero`、谁使用 `%sum`。再预测 `canonicalize` 的作用。

已有工具时，从仓库根目录运行：

```sh
mlir-opt --version
mlir-opt labs/compiler_bootcamp/01-canonicalize.mlir -canonicalize
```

::: details 解释性参考输出；不是你的本地运行记录
```mlir
module {
  func.func @add_zero(%x: i32) -> i32 {
    return %x : i32
  }
}
```
加零结果与 `%x` 相同，因此返回值可以直接使用 `%x`，无用的常量也可删除。实际 printer 的命名和格式可能不同。这个变换改善 IR 形状，并不自动证明整个程序会更快。
:::

### 观察 B：重复计算可以共用吗

```mlir
module {
  func.func @duplicate(%x: i32, %y: i32) -> i32 {
    %a = arith.muli %x, %y : i32
    %b = arith.muli %x, %y : i32
    %sum = arith.addi %a, %b : i32
    return %sum : i32
  }
}
```

```sh
mlir-opt labs/compiler_bootcamp/02-cse.mlir -cse
```

::: details 应观察到什么
两个相同的 `arith.muli` 合并为一个；加法的两个 operand 指向同一个乘法结果。这里单独运行 CSE，避免 Canonicalization 提前消除待观察的结构。只数 Operation 不足以判断正确性，还要看用途是否接到了正确 Value。
:::

没有 `mlir-opt` 时，先在纸上重写返回值和 operand；原始 `.mlir` 文件已随仓库提供，日后运行时附上工具版本。参考输出是概念示例，课程不会把它当成已执行的证据。

## Optimization 和 Lowering 有什么关系

上面的变换保留了基本抽象层。Lowering 则通常让某些抽象变得更具体，例如把结构化循环展开成 branch，或把 tensor 计算推进到 buffer 与 target operation。

MLIR 本身提供通用 IR、验证、Pass 和 Rewrite 基础设施。项目负责决定 Dialect、算法和合法的阶段出口。不是所有 MLIR 项目都经过 `linalg`；也不是每个 AI Compiler 都使用 MLIR。

## 为什么正确性约束会影响优化

`arith.addi` 在没有额外 overflow flag 时具有定宽整数的 modulo 语义；C++ signed overflow 则是未定义行为。不能把任意 C++ 表达式求值直接当成 MLIR constant folding。

本课程的[微型 C++ Pass](./cpp-labs.md)明确选择另一种教学语义：checked signed i64，溢出时拒绝求值。学习的是“先定义语义，再证明变换保持语义”。

类似地，可能读写内存的 Operation 不能仅因文本相同就随意合并。浮点重排也要考虑 rounding、NaN 和 fast-math 约束。

::: details 自测：IR 更短是否证明数值正确、性能更好？
都不能单凭长度证明。结构检查确认目标变换发生；数值验证和语义推理检查计算；性能需要针对 workload 的测量或明确标注假设的模型。三类证据回答不同问题。
:::

## 离开这一节的标准

你能指出一个 Value 的定义与使用，解释上面两个变换的理由，并说出一个不能直接复用相同规则的场景。接下来按路线进入 Day 2 的 [Tile、Memory 与性能实验](./mapping-lab.md)。

参考：[MLIR Language Reference](https://mlir.llvm.org/docs/LangRef/)、[Operation Canonicalization](https://mlir.llvm.org/docs/Canonicalization/)、[arith Dialect](https://mlir.llvm.org/docs/Dialects/ArithOps/)。
