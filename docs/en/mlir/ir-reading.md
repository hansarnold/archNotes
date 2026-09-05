---
title: "Reading an IR Change"
description: "Observe canonicalization and CSE in separate examples and build intuition for MLIR operations, values, types, dialects, and passes."
outline: deep
products: ["MLIR", "C++"]
documentType: "Observation Lab"
topics: ["IR", "SSA", "Canonicalization", "CSE", "Lowering"]
---

# Reading an IR Change

Day 1 block 4 takes 90 minutes: structure 20, annotation 20, two observations of 15 each, and explanation 20. Start with [Model to Kernel](./model-to-kernel.md).

## Five building blocks

| Construct | Meaning | Example |
| --- | --- | --- |
| Operation | A node that performs work | Integer addition with `arith.addi` |
| Value | An operation result or block argument | `%x` or `%sum` |
| Type | Interpretation and constraints | `i32`, a 32-bit integer |
| Dialect | Related operations/types and their rules | `arith` and `func` |
| Pass | A bounded analysis or transformation | `canonicalize` and `cse` |

Operations can have zero or several results and may contain regions. Begin with one function and block; consult [IR Foundations](./ir-foundations.md) later for loops and multiple blocks.

## Annotate this function

```mlir
module {
  func.func @add_zero(%x: i32) -> i32 {
    %zero = arith.constant 0 : i32
    %sum = arith.addi %x, %zero : i32
    return %sum : i32
  }
}
```

The module contains the program. `func.func` defines the function; `@add_zero` is a symbol and `%x` is an argument value. The constant defines `%zero`, addition uses two values, and `return` is shorthand for `func.return` here.

An SSA name is not a repeatedly assigned C++ variable. A compiler transforms nodes and references; during program execution, values denote the results of that execution's computation.

## Observation A: Remove addition by zero

Identify users of `%zero` and `%sum`, then predict canonicalization. With an existing installation, run from the repository root:

```sh
mlir-opt --version
mlir-opt labs/compiler_bootcamp/01-canonicalize.mlir -canonicalize
```

::: details Explanatory output, not a record from your installation
```mlir
module {
  func.func @add_zero(%x: i32) -> i32 {
    return %x : i32
  }
}
```
Addition by zero yields `%x`, so the return can use it directly and the unused constant can disappear. Actual printer names and formatting may differ. A cleaner IR does not by itself prove a program speedup.
:::

## Observation B: Share a duplicate computation

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

::: details What to look for
One multiplication remains and both addition operands refer to its result. Run CSE alone here so canonicalization does not hide the structure being studied. Counting operations is insufficient: confirm that uses refer to the right value.
:::

Without `mlir-opt`, rewrite the uses on paper first. The repository includes both input files for later execution with a recorded tool version. Expected output remains an illustration, not executed evidence.

## Optimization and lowering

These two changes keep roughly the same abstraction level. Lowering usually makes an abstraction more concrete: structured loops become branches, or tensor computation gains buffers and target operations.

MLIR supplies common representations, verification, passes, and rewriting. Individual projects choose dialects, algorithms, and legal stage exits. Not every MLIR compiler uses `linalg`, and not every AI compiler uses MLIR.

## Semantics constrain transformations

Without additional overflow flags, `arith.addi` has fixed-width modulo semantics. C++ signed overflow is undefined behavior. Evaluating an arbitrary signed C++ expression is therefore not a general implementation of MLIR integer folding.

The [miniature C++ pass](./cpp-labs.md) explicitly chooses checked signed i64 semantics and rejects overflow. Its lesson is to define semantics before proving a transformation preserves them. Similarly, textual equality alone cannot justify merging arbitrary memory operations, and floating-point reassociation must respect rounding, NaNs, and fast-math constraints.

::: details Does a shorter IR prove correctness or speed?
Neither follows from length alone. Structural checks establish that a transformation happened; semantic reasoning and numerical checks establish behavior; workload measurements or clearly scoped models support performance conclusions.
:::

## Exit criterion

Locate a value's definition and uses, explain both transformations, and name a situation where the same reasoning cannot be applied directly. Continue to [Tile, Memory, and Performance](./mapping-lab.md) on Day 2.

References: [MLIR language specification](https://mlir.llvm.org/docs/LangRef/), [canonicalization design](https://mlir.llvm.org/docs/Canonicalization/), and [integer operation semantics](https://mlir.llvm.org/docs/Dialects/ArithOps/).
