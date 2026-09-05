---
title: "MLIR Testing, Study Plan, and Capstone"
description: "An engineering reference after the twelve-hour primer: validate a MiniBPU compiler slice with parse/verify, FileCheck, code generation, and end-to-end evidence."
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "Study Plan"
topics: ["Testing", "FileCheck", "Learning Path", "Capstone"]
---

# MLIR Testing, Study Plan, and Capstone

The most dangerous compiler failure is not a crash but a silent miscompile. Treat tests as executable definitions of the IR contract while learning MLIR.

## Four Validation Levels

| Level | What it proves | Method |
| --- | --- | --- |
| Parse/verify | IR satisfies structural and semantic constraints | `mlir-opt input -o /dev/null` |
| Pass | A rewrite or lowering has the intended structure | lit + FileCheck |
| Translation/codegen | Target IR or an instruction is emitted | `mlir-translate`, `llc` |
| End-to-end | Numerical behavior and performance | Runtime, simulator, hardware benchmark |

FileCheck text matching cannot prove numerical correctness, and one end-to-end test cannot replace focused negative tests.

## Minimal FileCheck Example

```mlir
// RUN: mlir-opt %s -canonicalize | FileCheck %s

// Assertions used by the English tutorial example.
// CHECK-LABEL: func.func @add_zero
// CHECK-NOT: arith.addi
func.func @add_zero(%x: i32) -> i32 {
  %c0 = arith.constant 0 : i32
  %r = arith.addi %x, %c0 : i32
  func.return %r : i32
}
```

Avoid matching SSA numbers, irrelevant operation ordering, or default attributes too precisely. Prefer assertions about the target operation, type, critical attributes, boundary conditions, and diagnostics.

## Negative Tests

A custom target operation should cover at least:

- unsupported dtypes;
- illegal tile shapes;
- invalid memory spaces or alignment;
- incompatible layouts;
- missing terminators or event dependencies;
- illegal operations that survive full conversion.

Use `-verify-diagnostics` to lock down actionable error messages.

## Performance Evidence Chain

```text
IR Pattern
  → Target Instruction
  → Simulator Prediction
  → Microbenchmark Measurement
  → End-to-end Workload Impact
```

Any link can fail. The instruction may appear while resource pressure rises; a faster kernel may be offset by layout copies; a simulator may not yet be calibrated against silicon.

## Two-day introduction: use the new twelve-hour route

The previous sprint compressed IR, conversion, hardware mapping, and target engineering without enough context or C++ practice. Start with the [12-hour AI Compiler + C++ primer](./bootcamp.md): eight hours of concepts and observations, plus four of C++ prediction, repairs, and a miniature pass. Its outcome is example-based discussion with verification methods.

FileCheck, custom operations, and the MiniBPU capstone remain advanced material, outside the introductory 720 minutes.

## Three-Week Engineering Route

| Week | Focus | Acceptance criterion |
| --- | --- | --- |
| 1 | IR, SSA, dialects, pass pipelines | Diagnose parse, verify, and anchoring problems |
| 2 | PatternRewriter, ODS, conversion, FileCheck | Define a target contract with positive and negative tests |
| 3 | MiniBPU, mapping, simulator estimate | Demonstrate a complete compiler slice |

Each day uses a 20-minute concept review, a 40-minute experiment, and a 10-minute retrospective. Notes should contain only a bounded question, a minimal experiment, the observed IR change, and one unresolved question.

## MiniBPU Capstone

### Input

Start with a static-shape `linalg.matmul` and one dtype. Add bias or ReLU only as optional extensions.

### Output

```text
minibpu.command_buffer {
  %e0 = minibpu.dma_start ...
  minibpu.wait %e0
  minibpu.matmul_tile ...
  %e1 = minibpu.dma_start ...
  minibpu.wait %e1
}
```

A second consumer produces a simple simulator trace containing engine, dependencies, bytes, and estimated cycles.

### Required Scope

- three to five target operations;
- verifiers and memory effects;
- one lowering pass;
- one dynamic-legality condition;
- a positive FileCheck test, a negative test, and an unsupported-case diagnostic;
- one roofline-style estimate;
- a README and a 20-minute demo.

### Explicitly Out of Scope

- a complete ONNX frontend;
- a complete autotuner;
- real BPU binary encoding;
- a cycle-accurate simulator;
- exhaustive coverage of multiple hardware models.

The project demonstrates a closed loop from a high-level operation through target contracts and scheduling to validation. Its value is not measured by line count.

## Whiteboard Acceptance Questions

1. Why can one module contain several dialects?
2. How are operations, regions, blocks, and values related?
3. How does SSA represent loop-carried values?
4. How do canonicalization, CSE, and dialect conversion differ?
5. Why can pass anchoring make a pass appear not to run?
6. Why is MatMul lowering more than instruction selection?
7. Which compute and memory constraints limit tile size?
8. What does double buffering hide, and what does it cost?
9. Why are legality and profitability separate decisions?
10. How should a performance simulator be calibrated?
11. How should an unsupported operation be handled?
12. What evidence supports the claim that one lowering is faster?

Answer each with a one-sentence conclusion, then expand with one concrete example for one or two minutes.
