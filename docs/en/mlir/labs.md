---
title: "Minimal Reproducible MLIR Labs"
description: "Five progressive experiments covering IR structure, pass pipelines, SSA control flow, MatMul mapping, and NVPTX DPX instruction selection."
outline: deep
products: ["MLIR", "NVIDIA GPU"]
documentType: "Labs"
topics: ["mlir-opt", "SSA", "Pass Pipeline", "MatMul", "NVPTX"]
---

# Minimal Reproducible MLIR Labs

Change one variable at a time: a pass, type, shape, target, or operand order. Record the input, command, expectation, observed result, and explanation.

## Lab 1: IR Structure

```mlir
module attributes {guide_chapter = 1 : i32} {
  func.func @add_one(%arg0: i32) -> i32 {
    %c1 = arith.constant 1 : i32
    %result = arith.addi %arg0, %c1 : i32
    func.return %result : i32
  }
}
```

```bash
mlir-opt 01-ir.mlir
mlir-opt 01-ir.mlir --mlir-print-op-generic
```

Task: identify every operation, result, block argument, type, and attribute. Compare the custom form with the generic form.

## Lab 2: Canonicalization and CSE

```mlir
module {
  func.func @redundant(%x: i32) -> i32 {
    %c0 = arith.constant 0 : i32
    %a = arith.addi %x, %c0 : i32
    %b = arith.addi %x, %c0 : i32
    %sum = arith.addi %a, %b : i32
    func.return %sum : i32
  }
}
```

```bash
mlir-opt 02-pass-pipeline.mlir \
  --pass-pipeline='builtin.module(func.func(canonicalize,cse))' \
  --mlir-print-ir-after-all
```

Task: explain which operation canonicalization simplifies and which duplicate expression belongs to CSE. Reverse the pass order and compare the output.

## Lab 3: SSA Control Flow

```mlir
module {
  func.func @sum_to(%n: index) -> index {
    %c0 = arith.constant 0 : index
    %c1 = arith.constant 1 : index
    %sum = scf.for %i = %c0 to %n step %c1
        iter_args(%acc = %c0) -> (index) {
      %next = arith.addi %acc, %i : index
      scf.yield %next : index
    }
    func.return %sum : index
  }
}
```

```bash
mlir-opt 03-control-flow.mlir \
  --pass-pipeline='builtin.module(func.func(convert-scf-to-cf),convert-cf-to-llvm,convert-arith-to-llvm,convert-func-to-llvm,reconcile-unrealized-casts)'
```

Task: find the block argument and branch operand that represent `%acc` after lowering.

## Lab 4: MatMul Mapping Contract

```mlir
module {
  func.func @matmul_64(
      %lhs: tensor<64x64xf32>,
      %rhs: tensor<64x64xf32>,
      %init: tensor<64x64xf32>) -> tensor<64x64xf32> {
    %result = linalg.matmul
        ins(%lhs, %rhs : tensor<64x64xf32>, tensor<64x64xf32>)
        outs(%init : tensor<64x64xf32>) -> tensor<64x64xf32>
    func.return %result : tensor<64x64xf32>
  }
}
```

Do not start by searching for a one-command tiling pass. For 16×16×16 tiles, write down:

1. M/N/K loops and the tail policy;
2. layouts and memory spaces for A, B, and C tiles;
3. buffer counts and an SRAM estimate;
4. DMA, event, and barrier order;
5. fallback behavior for unsupported dtypes or shapes.

## Lab 5: DPX Candidate

```mlir
module {
  func.func @max_relu_s32(%a: i32, %b: i32) -> i32 {
    %max = arith.maxsi %a, %b : i32
    %zero = arith.constant 0 : i32
    %relu = arith.maxsi %max, %zero : i32
    func.return %relu : i32
  }
}
```

```bash
mlir-opt 05-dpx-candidate.mlir \
  --pass-pipeline='builtin.module(convert-to-llvm,reconcile-unrealized-casts)' \
| mlir-translate --mlir-to-llvmir \
| llc -mtriple=nvptx64-nvidia-cuda -mcpu=sm_90 -o -
```

Task: preserve output from every stage and trace `arith.maxsi` through the LLVM intrinsic to the NVPTX instruction. Switch to an earlier `-mcpu` and compare fused and unfused forms.

## Experiment Record Template

```text
Bounded question:
Input:
Command:
Expected observation:
Actual observation:
Explanation and remaining uncertainty:
```

If a command is incompatible with the current checkout, calibrate it against `mlir-opt --help` and the `RUN:` lines in tests from the same source revision instead of copying a pipeline from an old blog post.
