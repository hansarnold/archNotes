---
title: "12-Hour AI Compiler Primer + C++ Review"
description: "A two-day route connecting models, IR, kernels, and hardware through one MatMul example, with C++ repair exercises and a miniature compiler pass."
outline: deep
products: ["MLIR", "C++", "AI Accelerator"]
documentType: "Learning Route"
topics: ["AI Compiler", "C++", "Foundations", "Practice", "Discussion"]
---

# 12-Hour AI Compiler Primer + C++ Review

For readers with some C++, Clang/GCC, or GPU exposure who still find the connections between models, IR, kernels, and hardware unclear. After two days, explain compiler decisions through one example and independently read, change, and validate a small C++ program.

**720 minutes total: 480 for AI compilers and 240 for C++. Each day contains six hours of focused work; breaks are additional.** Every block includes reading, exercises, and explanation. Linked reference chapters are optional, not extra assignments.

**C++ is review, not a from-scratch introduction.** The [C++ review cheat sheets](../cpp/index.md) contain seven topics and 84 easily forgotten rules. Prioritize uncertain points during these two days and keep the complete reference for later source reading. Scan, jump to a rule and counterexample, then test your prediction.

## Starting point

The continuous example is `Y = ReLU(X @ W + bias)`. Follow its computation, data movement, transformations, and cases where an optimization stops helping.

- On a computer, use Python 3 and a C++17 compiler. Core labs need no GPU, PyTorch installation, or complete LLVM build.
- On a phone, read the explanations, calculate examples, and reveal answers after predicting. Finish executable tasks on a computer later.
- If `mlir-opt` is already available, run the additional IR observations. Otherwise start from explicitly labeled reference output; installing LLVM is not a prerequisite for these twelve hours.

## Day 1: Connect the layers and recover C++ reasoning

| Block | Minutes | Reading and activity | Evidence of completion |
| --- | ---: | --- | --- |
| [1. Execution overview](./model-to-kernel.md) | 60 | Model expression, graph, IR, kernel, runtime; compilation versus execution | Explain one call and name each layer's input and output |
| [2. An operator becomes a program](./model-to-kernel.md#block-2) | 90 | MatMul shapes, loops, bias, ReLU, fusion; a CPU comparison | Equal numerical results and an explanation of avoided intermediates |
| [3. C++ review A](./cpp-refresh.md) | 120 | Types/deduction 35, lifetime/move 35, predictions and three repairs 50 | Explain decltype, const moves, invalidation, and repair all three tasks |
| [4. Read an IR change](./ir-reading.md) | 90 | Annotated MLIR; canonicalization, CSE, and lowering | Identify definitions and uses and explain transformation legality |

End Day 1 by explaining why one computation has several representations and how a C++ object's lifetime differs from an IR value's dependency relationships.

## Day 2: Explain mapping and implement a transformation

| Block | Minutes | Reading and activity | Evidence of completion |
| --- | ---: | --- | --- |
| [5. Execute a tile](./mapping-lab.md) | 90 | Layout, buffers, SRAM, DMA, synchronization; change a tile parameter | Calculate working sets and explain a rejected and a feasible plan |
| [6. C++ review B](./cpp-labs.md) | 120 | Classes/templates/LLVM utilities 30, STL/error boundaries 25, miniature pass and validation 65 | Fold constants, retain variable paths, and explain boundary checks |
| [7. Compare real systems](./real-world.md) | 60 | Triton, TileLang, IREE, StableHLO, and PyTorch responsibilities | Locate each project and describe a concrete use |
| [8. Performance and numerics](./mapping-lab.md#block-8-performance-and-numerics-60-minutes) | 60 | FLOPs/bytes, roofline, INT8, shape changes; analysis script | Separate lower bounds, predictions, and measurements; explain quantization error |
| [9. Discussion rehearsal](./discussion.md) | 30 | Five-minute explanation followed by changed-condition questions | State reasoning, cost, verification, and remaining uncertainty |

## How to study

Predict first, record a reason, edit or calculate, run, compare, and then change one condition. Try independently for five to ten minutes before opening a hint. AI can explain an error or review a change; write the initial prediction yourself.

For instance, predict whether `std::move` leads to a copy or move, then repeat with a const input. For a compiler decision, identify what fusion saves and then ask which resource pressure it increases.

## Deliverables

1. A one-page model-to-device explanation with concrete inputs, outputs, and responsibilities.
2. MatMul, fusion, tile, and INT8 observations separating facts, assumptions, and unmeasured quantities.
3. Three C++ repairs and a miniature pass with predictions and actual results preserved.
4. A five-minute explanation and answers to eight core discussion questions.

Reading a chapter is not an exit criterion. Keep executable evidence, your own explanation, and a response to at least one changed assumption.

## After this introduction

Custom dialects, ODS, complete dialect conversion, NVVM/DPX, production BPU code generation, cycle-accurate simulation, and multi-chip systems belong to a later engineering track. Consult them when needed without adding them to this twelve-hour schedule.

Existing references include [real projects](./real-world.md), [IR foundations](./ir-foundations.md), and [accelerator mapping](./accelerator-mapping.md). The deeper project remains in [testing and the capstone](./testing-study-plan.md).
