---
title: "MLIR IR 核心结构与工具"
description: "从 Operation、Region、Block、Value 和 SSA 建立 MLIR 心智模型，并掌握 mlir-opt 的最小实验与调试方法。"
outline: deep
products: ["MLIR"]
documentType: "教程章节"
topics: ["IR", "SSA", "mlir-opt", "调试"]
---

# MLIR IR 核心结构与工具

MLIR 最值得先掌握的不是某个 Dialect，而是统一的 IR object model。`func.func`、`scf.for` 和 `arith.addi` 外观不同，底层都属于 Operation。

## 一个最小函数

```mlir
module {
  func.func @add_one(%arg0: i32) -> i32 {
    %c1 = arith.constant 1 : i32
    %result = arith.addi %arg0, %c1 : i32
    func.return %result : i32
  }
}
```

逐层观察：

- `module` 是顶层 Operation，拥有一个 Region。
- Region 中包含 Block，Block 中顺序存放 Operation。
- `func.func` 自己也拥有 Region 和 entry Block。
- `%arg0` 是 BlockArgument；`%c1` 和 `%result` 是 Operation result。
- `i32` 是 Type；函数名和函数类型属于 Symbol/Attribute contract。

## Operation 的统一形状

所有 Operation 都可以抽象为：

```text
results = operation(operands) attributes/properties : types {
  regions containing blocks containing operations
}
```

Custom assembly form 让常见 Operation 更易读；Generic form 则直接暴露统一结构。排查 parser/printer 或 operand segment 问题时，可以运行：

```bash
mlir-opt input.mlir --mlir-print-op-generic
```

## Region、Block 与 Value

```text
Operation
  └─ Region (0..N)
       └─ Block (0..N)
            ├─ Block arguments
            └─ Operation (0..N)
```

Value 只有两种来源：Operation result 或 BlockArgument。这条规则把所有 def-use 分析统一成两个问题：谁定义这个 Value，哪些 Operation 使用它？

Region 提供嵌套和作用域。Block 是线性的 Operation 序列，可以通过 successor 形成 Control Flow Graph。进入 `cf` 等较低层 Dialect 后，branch 会显式连接 Block。

## SSA 与循环变量

SSA Value 只定义一次。循环中的“更新”不是重新赋值，而是通过 Region 参数和 `yield` 传递：

```mlir
%sum = scf.for %i = %c0 to %n step %c1
    iter_args(%acc = %c0) -> (index) {
  %next = arith.addi %acc, %i : index
  scf.yield %next : index
}
```

`%acc` 是每次迭代的 BlockArgument；`scf.yield` 把 Value 送给下一次迭代或循环 result。Lowering 到 `cf` 后，这种关系会变成 BlockArgument 与 branch operand。

## Type、Attribute 与 Property

| 构件 | 主要作用 | 例子 |
| --- | --- | --- |
| Type | 约束 Value 如何被解释和连接 | `tensor<4x8xf32>`、`memref<?xi8>` |
| Attribute | 不沿 SSA 流动的编译期常量 | tile shape、layout enum、target chip |
| Property | 与 Operation 固有信息绑定的结构化字段 | 内部存储的 op configuration |

Accelerator Dialect 可能在 Type 中携带 shape、encoding、layout 或 memory space，但不应把每个 tuning knob 都塞进 Type；否则 Type 数量和 Conversion 复杂度会迅速增加。

## Symbol 与 SSA Value

```mlir
func.func @callee(%x: i32) -> i32
```

`@callee` 是 Symbol，由 SymbolTable 管理；`%x` 是 SSA Value，遵守 def-use 和 Region scope。调用、Global 和 Module 场景经常同时出现二者。

## Side Effect 是正确性契约

Memory Effect Interface 告诉优化器一个 Operation 是否读写内存。自定义 DMA、Barrier 或 Device Command 如果错误声明为无副作用，DCE/CSE 可能删除或重排它，从而产生 silent miscompile。

## 最小构建

在 `llvm-project` 根目录：

```bash
cmake -G Ninja -S llvm -B build-mlir \
  -DLLVM_ENABLE_PROJECTS=mlir \
  -DLLVM_TARGETS_TO_BUILD="Native;NVPTX" \
  -DLLVM_ENABLE_ASSERTIONS=ON \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo

cmake --build build-mlir --target \
  mlir-opt mlir-translate mlir-tblgen FileCheck llc
```

核心工具：

| 工具 | 作用 |
| --- | --- |
| `mlir-opt` | Parse、Verify、运行 Pass Pipeline |
| `mlir-translate` | MLIR 与 LLVM IR 等外部表示之间翻译 |
| `mlir-tblgen` | 从 ODS/TableGen 生成声明和定义 |
| `FileCheck` | 对文本结果做稳定断言 |
| `llc` | LLVM IR 到目标 Assembly |

## 调试顺序

1. 不加 Pass，先确认 Parse/Verify。
2. 一次只增加一个 Pass。
3. 打印变换前后 IR。
4. 确认 Pass Anchor 是否正确。
5. 检查 Dialect/Pass 注册和 Pattern 前置条件。

常用命令：

```bash
mlir-opt input.mlir \
  --pass-pipeline='builtin.module(func.func(canonicalize,cse))' \
  --mlir-print-ir-before-all \
  --mlir-print-ir-after-all \
  --mlir-print-ir-after-change
```

接下来进入[最小可复现实验](./labs.md)，先完成 IR Structure 和 SSA Control Flow 两个实验。

## 延伸阅读

- [MLIR Language Reference](https://mlir.llvm.org/docs/LangRef/)
- [Understanding the IR Structure](https://mlir.llvm.org/docs/Tutorials/UnderstandingTheIRStructure/)
- [Using mlir-opt](https://mlir.llvm.org/docs/Tutorials/MlirOpt/)
