---
title: "MLIR Backend Primer"
description: "A structured MLIR tutorial for AI compiler backends, from IR, passes, and dialect conversion to accelerator mapping, NVVM, and performance validation."
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "Structured Tutorial"
topics: ["Compiler", "IR", "Lowering", "Hardware Mapping", "Performance Validation"]
---

# MLIR Backend Primer

**New here? Start with the [12-hour AI Compiler + C++ primer](./bootcamp.md).** One MatMul connects the concepts through annotated code, CPU labs, C++ repairs, and discussion checks. The chapters below are deeper MLIR references, not mandatory sequential reading for the first two days.

This tutorial starts with real context from Triton, IREE, StableHLO, and TileLang, then follows an end-to-end compiler path rather than an API inventory. You will learn to read IR, debug passes, define dialect and conversion contracts, and carry a MatMul toward tiles, buffers, DMA, engine schedules, and target code generation.

::: tip Learning outcome
After completing the tutorial, you should be able to explain an AI compiler pipeline on a whiteboard and reproduce a small lowering experiment with a local `llvm-project` checkout.
:::

## Begin with a real system map

If the boundaries between MLIR, Triton, TileLang, TVM, and a runtime are still unclear, start with [MLIR in Real Projects](./real-world.md). An INT8 MatMul task for a BPU shows:

- why Triton's compiler is genuinely MLIR-based;
- why TileLang uses TVM TIR yet remains a useful scheduling comparison;
- how IREE's `Flow → Stream → HAL` sequence describes more than kernel code generation;
- which engineering jobs correspond to Operation, Dialect, Pass, and Conversion.

Once that map is clear, the IR structures in later chapters have a concrete reason to exist.

## One continuous path

```text
Model / Graph
  → Tensor IR
  → Tiling / Layout / Bufferization
  → Target Legalization
  → DMA / Compute / Barrier Schedule
  → Codegen or Simulator Trace
```

## Reading path

| Stage | Core question | Deliverable |
| --- | --- | --- |
| Real systems | Where does MLIR sit in a working compiler stack? | Map real projects onto a BPU pipeline |
| IR foundations | How do Operation, Region, Block, and Value form a program? | Explain MLIR line by line |
| Passes and rewrites | How does a compiler change IR safely? | Diagnose an inactive pass |
| Dialects and conversion | How are abstraction and legality contracts defined? | Draft a MiniBPU target contract |
| Accelerator mapping | How does MatMul map to hardware? | Analyze tiling, memory, DMA, and scheduling |
| Target and validation | How do we trace lowering to NVVM/PTX and prove correctness? | Build a FileCheck and performance evidence chain |

## Two study modes

- **Two-day introduction:** Follow the [12-hour route](./bootcamp.md) for a discussable overview and C++/CPU exercises; postpone ODS, full conversion, and real-target code generation.
- **Three-week engineering track:** Add ODS, PatternRewriter, tests, and a MiniBPU capstone that demonstrates a complete compiler slice.

## Scope

- The focus is AI compiler backend work, not a complete frontend or training-framework integration.
- GPU and NVVM are observable analogies, not claims about a proprietary BPU implementation.
- DPX is an instruction-selection case study rather than the center of the tutorial.
- A lowering is not declared faster without calibrated simulation or hardware measurements.

Continue with the chapters in the sidebar. Run at least one minimal experiment for every chapter.
