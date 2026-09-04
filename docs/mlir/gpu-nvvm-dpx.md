---
title: "MLIR GPU、NVVM 与 DPX"
description: "用 NVIDIA lowering 路径理解 Target Dialect、LLVM instruction selection、Inline PTX 与从 IR 到性能证据的边界。"
outline: deep
products: ["MLIR", "NVIDIA GPU"]
documentType: "Target 专题"
topics: ["GPU Dialect", "NVVM", "DPX", "Instruction Selection", "PTX"]
---

# MLIR GPU、NVVM 与 DPX

NVIDIA 路径提供了一个可观察的 Backend 案例。它适合练习从 High-level semantics 追踪到 Target instruction，但不能直接代表专有 BPU 的内部实现。

## Dialect 层级

```text
linalg / scf / vector
        ↓
gpu                  Target-independent GPU abstraction
        ↓
nvgpu                NVIDIA-specific higher-level features
        ↓
nvvm                  NVIDIA LLVM/NVPTX backend dialect
        ↓
LLVM IR
        ↓
NVPTX backend / compiler
        ↓
PTX / cubin / SASS
```

`nvvm` 适合表达接近 LLVM intrinsic 或公开 ISA 的低层语义。多指令 Convenience abstraction 更适合 `gpu`、`nvgpu` 或项目自定义 Dialect。

## GPU 经验怎样迁移

| CUDA / GPU 经验 | Accelerator Compiler 表达 |
| --- | --- |
| Thread/Block Mapping | Hardware Mapping |
| Shared-memory Tiling | On-chip SRAM Tiling / Bufferization |
| Tensor Core MMA | Matrix/Cube Engine Operation |
| Async Copy / Pipeline | DMA + Compute Overlap |
| Occupancy | Resource Utilization / Concurrent Residency |
| Kernel Fusion | Graph/Operation Fusion |
| PTX / SASS | Target IR / ISA |
| Nsight | Profiler / Performance Simulator |

重点不是罗列 CUDA API，而是说明这些经验如何转化为 Mapping、Memory、Schedule 和 Validation 方法。

## DPX 的两条 Lowering 路径

当前 MLIR NVVM Dialect 并未提供覆盖整套 DPX 语义的高层 Operation family。探索时可以使用两种策略。

### 通用语义优先

```mlir
%max = arith.maxsi %a, %b : i32
%zero = arith.constant 0 : i32
%relu = arith.maxsi %max, %zero : i32
```

`arith` Lowering 到 LLVM Dialect 后形成 signed max intrinsic。LLVM NVPTX Backend 在支持的 Target 上可以把部分 `min/max + relu` Pattern 选择成 `min.relu` 或 `max.relu` 指令。

这条路径保留可移植语义，也允许通用优化理解 IR。风险是中间 Pass 可能改变 Pattern shape，因此必须用 Codegen test 锁住目标指令。

### Inline PTX 作为 Escape Hatch

当 Intrinsic 缺失或必须精确表达新指令时，可以使用 `nvvm.inline_ptx`：

```mlir
%r = nvvm.inline_ptx "..." ro(%a, %b : i32, i32) -> i32
```

Inline PTX 降低可移植性，也让优化器难以理解语义。Register constraint、Predicate、Side Effect、Memory clobber 和 Target feature 都需要明确处理。

选择顺序通常是：Semantic Operation/Intrinsic → 可识别通用 Pattern → Inline PTX。

## Instruction Selection 实验

构建带 NVPTX Target 的 `llc` 后运行：

```bash
mlir-opt dpx-candidate.mlir \
  --pass-pipeline='builtin.module(convert-to-llvm,reconcile-unrealized-casts)' \
| mlir-translate --mlir-to-llvmir \
| llc -mtriple=nvptx64-nvidia-cuda -mcpu=sm_90 -o -
```

期望追踪：

```text
arith.maxsi
  → llvm.intr.smax in LLVM Dialect
  → llvm.smax intrinsic in LLVM IR
  → max.relu.s32 on a matching NVPTX target
```

如果未匹配，逐层保存输出并检查 Operation shape、Constant、Operand 顺序、Target triple 和 `-mcpu`。

## PTX 与 SASS 的证据边界

- PTX 是 Virtual ISA，后续仍会由 ptxas 或 JIT 编译。
- SASS 是具体 GPU Machine instruction。
- 目标 Pattern 在 IR 出现，不等于 Instruction selection 已发生。
- PTX 出现目标指令，也不等于 End-to-end performance 已提升。

完整证据链：

```text
IR semantics
  → LLVM codegen selection
  → PTX
  → cubin / SASS
  → Microbenchmark
  → End-to-end workload
```

每一级结论都需要对应证据。

## 源码阅读路线

- [NVVM Dialect](https://mlir.llvm.org/docs/Dialects/NVVMDialect/)
- [GPU Dialect](https://mlir.llvm.org/docs/Dialects/GPU/)
- [LLVM IR Target](https://mlir.llvm.org/docs/TargetLLVMIR/)
- [`NVVMOps.td`](https://github.com/llvm/llvm-project/blob/main/mlir/include/mlir/Dialect/LLVMIR/NVVMOps.td)
- [`ArithToLLVM.cpp`](https://github.com/llvm/llvm-project/blob/main/mlir/lib/Conversion/ArithToLLVM/ArithToLLVM.cpp)
- [`NVPTXInstrInfo.td`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/NVPTX/NVPTXInstrInfo.td)
- [`combine-min-max.ll`](https://github.com/llvm/llvm-project/blob/main/llvm/test/CodeGen/NVPTX/combine-min-max.ll)
