---
title: "MLIR GPU, NVVM, and DPX"
description: "Use NVIDIA lowering as a concrete case study for target dialects, LLVM instruction selection, inline PTX, and the evidence boundary from IR to performance."
outline: deep
products: ["MLIR", "NVIDIA GPU"]
documentType: "Target Topic"
topics: ["GPU Dialect", "NVVM", "DPX", "Instruction Selection", "PTX"]
---

# MLIR GPU, NVVM, and DPX

The NVIDIA path is an observable backend case study. It is useful for tracing high-level semantics down to target instructions, although it is not a direct model of a proprietary BPU implementation.

## Dialect Layers

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

`nvvm` is appropriate for low-level semantics close to LLVM intrinsics or public ISA constructs. A convenience abstraction that expands to several instructions is usually a better fit for `gpu`, `nvgpu`, or a project-specific dialect.

## How GPU Experience Transfers

| CUDA / GPU experience | Accelerator compiler concept |
| --- | --- |
| Thread/block mapping | Hardware mapping |
| Shared-memory tiling | On-chip SRAM tiling and bufferization |
| Tensor Core MMA | Matrix or cube engine operation |
| Async copy and pipeline | DMA and compute overlap |
| Occupancy | Resource utilization and concurrent residency |
| Kernel fusion | Graph or operation fusion |
| PTX / SASS | Target IR / ISA |
| Nsight | Profiler / performance simulator |

The goal is not to recite CUDA APIs. Explain how the experience becomes a method for mapping, memory planning, scheduling, and validation.

## Two Lowering Paths for DPX

The MLIR NVVM dialect does not currently expose a high-level operation family covering the complete DPX semantics. Two strategies are useful when exploring the path.

### Prefer General Semantics

```mlir
%max = arith.maxsi %a, %b : i32
%zero = arith.constant 0 : i32
%relu = arith.maxsi %max, %zero : i32
```

After `arith` lowers to the LLVM dialect, it forms a signed-max intrinsic. On a compatible target, LLVM's NVPTX backend can select some `min/max + relu` patterns as `min.relu` or `max.relu` instructions.

This path preserves portable meaning and keeps the IR visible to general optimization. Its risk is that an intermediate pass may alter the pattern shape, so a code-generation test must lock down the intended instruction.

### Use Inline PTX as an Escape Hatch

When an intrinsic is unavailable or a new instruction must be expressed exactly, `nvvm.inline_ptx` is an option:

```mlir
%r = nvvm.inline_ptx "..." ro(%a, %b : i32, i32) -> i32
```

Inline PTX reduces portability and hides semantics from optimizers. Register constraints, predicates, side effects, memory clobbers, and target features all need explicit treatment.

A practical preference order is: semantic operation or intrinsic, recognizable general pattern, then inline PTX.

## Instruction-Selection Experiment

With an `llc` build that includes the NVPTX target, run:

```bash
mlir-opt dpx-candidate.mlir \
  --pass-pipeline='builtin.module(convert-to-llvm,reconcile-unrealized-casts)' \
| mlir-translate --mlir-to-llvmir \
| llc -mtriple=nvptx64-nvidia-cuda -mcpu=sm_90 -o -
```

Trace this expected sequence:

```text
arith.maxsi
  → llvm.intr.smax in LLVM Dialect
  → llvm.smax intrinsic in LLVM IR
  → max.relu.s32 on a matching NVPTX target
```

If it does not match, save the output at each boundary and inspect the operation shape, constants, operand order, target triple, and `-mcpu` value.

## Evidence Boundaries: PTX and SASS

- PTX is a virtual ISA and is compiled again by ptxas or JIT compilation.
- SASS is the concrete GPU machine instruction stream.
- Seeing the desired IR pattern does not prove instruction selection happened.
- Seeing the desired PTX instruction does not prove end-to-end performance improved.

Use a complete evidence chain:

```text
IR semantics
  → LLVM codegen selection
  → PTX
  → cubin / SASS
  → Microbenchmark
  → End-to-end workload
```

Each conclusion should be backed by evidence from its own level.

## Source Reading Route

- [NVVM Dialect](https://mlir.llvm.org/docs/Dialects/NVVMDialect/)
- [GPU Dialect](https://mlir.llvm.org/docs/Dialects/GPU/)
- [LLVM IR Target](https://mlir.llvm.org/docs/TargetLLVMIR/)
- [`NVVMOps.td`](https://github.com/llvm/llvm-project/blob/main/mlir/include/mlir/Dialect/LLVMIR/NVVMOps.td)
- [`ArithToLLVM.cpp`](https://github.com/llvm/llvm-project/blob/main/mlir/lib/Conversion/ArithToLLVM/ArithToLLVM.cpp)
- [`NVPTXInstrInfo.td`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/NVPTX/NVPTXInstrInfo.td)
- [`combine-min-max.ll`](https://github.com/llvm/llvm-project/blob/main/llvm/test/CodeGen/NVPTX/combine-min-max.ll)
