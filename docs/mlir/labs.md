---
title: "MLIR 最小可复现实验"
description: "五个渐进实验覆盖 IR Structure、Pass Pipeline、SSA Control Flow、MatMul Mapping 与 NVPTX DPX Instruction Selection。"
outline: deep
products: ["MLIR", "NVIDIA GPU"]
documentType: "实验"
topics: ["mlir-opt", "SSA", "Pass Pipeline", "MatMul", "NVPTX"]
---

# MLIR 最小可复现实验

每次只改变一个变量：Pass、Type、Shape、Target 或 Operand order。记录输入、命令、预期、实际结果和解释。

## Lab 1：IR Structure

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

任务：标出所有 Operation、Result、BlockArgument、Type 和 Attribute，并比较 Custom form 与 Generic form。

## Lab 2：Canonicalization 与 CSE

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

任务：解释哪个 Operation 由 Canonicalization 简化，哪个重复表达式属于 CSE 的范围。交换 Pass 顺序并比较。

## Lab 3：SSA Control Flow

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

任务：找到 `%acc` Lowering 后对应的 BlockArgument 和 Branch operand。

## Lab 4：MatMul Mapping Contract

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

先不找“一键 Tiling Pass”。为 16×16×16 Tile 写出：

1. M/N/K Loop 与 Tail policy；
2. A/B/C Tile 的 Layout 和 Memory Space；
3. Buffer 数量与 SRAM estimate；
4. DMA/Event/Barrier 顺序；
5. Unsupported dtype/shape 的 Fallback。

## Lab 5：DPX Candidate

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

任务：保存每一层输出，追踪 `arith.maxsi` 到 LLVM intrinsic 和 NVPTX instruction。换成早期 `-mcpu`，比较融合与非融合形式。

## 实验记录模板

```text
Bounded question:
Input:
Command:
Expected observation:
Actual observation:
Explanation and remaining uncertainty:
```

如果命令与当前 Checkout 不兼容，以 `mlir-opt --help` 和同一源码版本测试中的 `RUN:` 行校准，不复制旧博客的 Pass Pipeline。
