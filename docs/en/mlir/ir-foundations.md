---
title: "MLIR IR Foundations and Tools"
description: "Build a working MLIR mental model from Operation, Region, Block, Value, and SSA, then use mlir-opt for minimal experiments and debugging."
outline: deep
products: ["MLIR"]
documentType: "Tutorial Chapter"
topics: ["IR", "SSA", "mlir-opt", "Debugging"]
---

# MLIR IR Foundations and Tools

The first concept to master is MLIR's common IR object model, not a specific dialect. `func.func`, `scf.for`, and `arith.addi` look different in text, but each is an Operation.

## A minimal function

```mlir
module {
  func.func @add_one(%arg0: i32) -> i32 {
    %c1 = arith.constant 1 : i32
    %result = arith.addi %arg0, %c1 : i32
    func.return %result : i32
  }
}
```

Read it from the outside in:

- `module` is a top-level Operation with one Region.
- A Region contains Blocks, and a Block contains an ordered list of Operations.
- `func.func` owns another Region and an entry Block.
- `%arg0` is a BlockArgument; `%c1` and `%result` are Operation results.
- `i32` is a Type; the function name and signature participate in the Symbol and Attribute contract.

## The common Operation shape

Every Operation can be described as:

```text
results = operation(operands) attributes/properties : types {
  regions containing blocks containing operations
}
```

Custom assembly forms make common Operations readable. Generic form exposes the uniform structure and helps diagnose parser, printer, and operand-segment issues:

```bash
mlir-opt input.mlir --mlir-print-op-generic
```

## Region, Block, and Value

```text
Operation
  └─ Region (0..N)
       └─ Block (0..N)
            ├─ Block arguments
            └─ Operation (0..N)
```

A Value has exactly two possible origins: an Operation result or a BlockArgument. This reduces def-use analysis to two questions: what defines the Value, and which Operations use it?

Regions provide nesting and scope. Blocks hold linear sequences and may have successors that form a Control Flow Graph. Lower-level dialects such as `cf` make branches between Blocks explicit.

## SSA and loop-carried state

An SSA Value is defined once. A loop carries updated state through Region arguments and `yield`, not by assigning a new value to an existing name:

```mlir
%sum = scf.for %i = %c0 to %n step %c1
    iter_args(%acc = %c0) -> (index) {
  %next = arith.addi %acc, %i : index
  scf.yield %next : index
}
```

`%acc` is a BlockArgument for an iteration. `scf.yield` supplies the next iteration or the loop result. Lowering to `cf` turns this relation into BlockArguments and branch operands.

## Type, Attribute, and Property

| Construct | Primary role | Examples |
| --- | --- | --- |
| Type | Constrains how a Value is interpreted and connected | `tensor<4x8xf32>`, `memref<?xi8>` |
| Attribute | Immutable compile-time data outside SSA flow | tile shape, layout enum, target chip |
| Property | Structured data inherent to an Operation | internal operation configuration |

An accelerator dialect may carry shape, encoding, layout, or memory space in Types. Avoid putting every tuning knob in a Type, because that creates excessive Type variants and conversion complexity.

## Symbol versus SSA Value

```mlir
func.func @callee(%x: i32) -> i32
```

`@callee` is a Symbol managed by a SymbolTable. `%x` is an SSA Value governed by def-use and Region scope. Calls, globals, and modules frequently use both systems.

## Side effects are correctness contracts

Memory Effect Interfaces tell transformations whether an Operation reads or writes memory. If a custom DMA, barrier, or device command is incorrectly marked side-effect-free, DCE or CSE may remove or reorder it and silently miscompile the program.

## Minimal build

From an `llvm-project` checkout:

```bash
cmake -G Ninja -S llvm -B build-mlir \
  -DLLVM_ENABLE_PROJECTS=mlir \
  -DLLVM_TARGETS_TO_BUILD="Native;NVPTX" \
  -DLLVM_ENABLE_ASSERTIONS=ON \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo

cmake --build build-mlir --target \
  mlir-opt mlir-translate mlir-tblgen FileCheck llc
```

| Tool | Role |
| --- | --- |
| `mlir-opt` | Parse, verify, and run pass pipelines |
| `mlir-translate` | Translate between MLIR and external forms such as LLVM IR |
| `mlir-tblgen` | Generate declarations and definitions from ODS/TableGen |
| `FileCheck` | Assert stable properties of textual output |
| `llc` | Compile LLVM IR to target assembly |

## Debugging order

1. Parse and verify without passes.
2. Add one pass at a time.
3. Print IR before and after changes.
4. Confirm the pass anchor.
5. Check dialect registration, pass registration, and pattern preconditions.

```bash
mlir-opt input.mlir \
  --pass-pipeline='builtin.module(func.func(canonicalize,cse))' \
  --mlir-print-ir-before-all \
  --mlir-print-ir-after-all \
  --mlir-print-ir-after-change
```

Continue with the IR structure and SSA control-flow exercises in the [minimal reproducible labs](./labs.md).

## Further reading

- [MLIR Language Reference](https://mlir.llvm.org/docs/LangRef/)
- [Understanding the IR Structure](https://mlir.llvm.org/docs/Tutorials/UnderstandingTheIRStructure/)
- [Using mlir-opt](https://mlir.llvm.org/docs/Tutorials/MlirOpt/)
