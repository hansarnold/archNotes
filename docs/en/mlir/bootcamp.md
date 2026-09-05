---
title: "Two-Day AI Compiler Concept Route"
description: "Eight core hours connect models, IR, kernels, and hardware; independent C++ review is an optional four-hour companion."
outline: deep
products: ["AI Compiler", "MLIR", "AI Accelerator"]
documentType: "Learning Route"
topics: ["AI Compiler", "Foundations", "Practice", "Discussion"]
---

# Two-Day AI Compiler Concept Route

For readers with some C++, Clang/GCC, or GPU exposure who still find the connections between models, IR, kernels, and hardware unclear. After two days, explain compiler decisions with one concrete example and distinguish assumptions from measured evidence.

**480 core minutes: four focused hours each day, excluding breaks.** Every block includes reading, exercises, and explanation. The optional four-hour C++ route is listed separately below.

## Starting point

The continuous example is `Y = ReLU(X @ W + bias)`. Follow its computation, data movement, transformations, and cases where an optimization stops helping.

- On a computer, use Python 3. A C++17 compiler is only needed for the independent C++ practice. Core labs need no GPU, PyTorch installation, or complete LLVM build.
- On a phone, read the explanations, calculate examples, and reveal answers after predicting. Finish executable tasks on a computer later.
- If `mlir-opt` is already available, run the additional IR observations. Otherwise start from explicitly labeled reference output; installing LLVM is not a prerequisite for the core route.

## Day 1: Model, kernel, and IR · 240 minutes

| Block | Minutes | Reading and activity | Evidence of completion |
| --- | ---: | --- | --- |
| [1. Execution overview](./model-to-kernel.md) | 60 | Model expression, graph, IR, kernel, runtime; compilation versus execution | Explain one call and name each layer's input and output |
| [2. An operator becomes a program](./model-to-kernel.md#block-2) | 90 | MatMul shapes, loops, bias, ReLU, fusion; a CPU comparison | Equal numerical results and an explanation of avoided intermediates |
| [3. Read an IR change](./ir-reading.md) | 90 | Annotated MLIR; canonicalization, CSE, and lowering | Identify definitions and uses and explain transformation legality |

End Day 1 by explaining why one computation has several representations and what semantics each transformation must preserve.

## Day 2: Mapping, systems, and evidence · 240 minutes

| Block | Minutes | Reading and activity | Evidence of completion |
| --- | ---: | --- | --- |
| [4. Execute a tile](./mapping-lab.md) | 90 | Layout, buffers, SRAM, DMA, synchronization; change a tile parameter | Calculate working sets and explain a rejected and a feasible plan |
| [5. Compare real systems](./real-world.md) | 60 | Triton, TileLang, IREE, StableHLO, and PyTorch responsibilities | Locate each project and describe a concrete use |
| [6. Performance and numerics](./mapping-lab.md#block-8-performance-and-numerics-60-minutes) | 60 | FLOPs/bytes, roofline, INT8, shape changes; analysis script | Separate lower bounds, predictions, and measurements; explain quantization error |
| [7. Discussion rehearsal](./discussion.md) | 30 | Five-minute explanation followed by changed-condition questions | State reasoning, cost, verification, and remaining uncertainty |

## Optional companion: C++ review stays separate

If you still want the original twelve-hour combination, add two hours of [C++ review A](./cpp-refresh.md) after Day 1 and two hours of [review B](./cpp-labs.md) after Day 2. This gives **8 + 4 = 12 hours**, without interleaving language lessons into the compiler sequence.

The [C++ section](../cpp/index.md) owns the complete cheat sheets, repairs, and miniature pass. Skip it when language recall is already sufficient; the Compiler exit check does not grade C++.

## How to study

Predict first, record a reason, edit or calculate, run, compare, and then change one condition. Try independently for five to ten minutes before opening a hint. AI can explain an error or review a change; write the initial prediction yourself.

For example, predict what fusion saves, then change a shape and ask which resource pressure increases.

## Deliverables

1. A one-page model-to-device explanation with concrete inputs, outputs, and responsibilities.
2. MatMul, fusion, tile, and INT8 observations separating facts, assumptions, and unmeasured quantities.
3. A five-minute explanation and answers to six core discussion questions.

Reading a chapter is not an exit criterion. Keep executable evidence, your own explanation, and a response to at least one changed assumption.

## After this introduction

Custom dialects, ODS, complete dialect conversion, NVVM/DPX, production BPU code generation, cycle-accurate simulation, and multi-chip systems belong to a later engineering track. Consult them when needed without adding them to the core schedule.

Existing references include [real projects](./real-world.md), [IR foundations](./ir-foundations.md), and [accelerator mapping](./accelerator-mapping.md). The deeper project remains in [testing and the capstone](./testing-study-plan.md).
