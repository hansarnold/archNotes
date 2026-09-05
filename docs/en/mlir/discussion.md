---
title: "30-Minute Discussion and Exit Check"
description: "Six compiler questions with follow-ups test connections between models, IR, kernels, and hardware."
outline: deep
products: ["AI Compiler", "MLIR", "AI Accelerator"]
documentType: "Learning Assessment"
topics: ["Discussion", "Compiler Pipeline", "Verification"]
---

# 30-Minute Discussion and Exit Check

Use the final 30 minutes of the [AI Compiler concept route](./bootcamp.md) to explain examples, conditions, and verification methods rather than memorize answers. Spend five minutes outlining, five presenting, fifteen answering follow-ups on three chosen questions, and five recording weak spots.

## Explain one computation in five minutes

| Time | Explain | Do not skip |
| --- | --- | --- |
| Minute 0–1 | Inputs, outputs, shapes, and semantics of `ReLU(X@W+b)` | Computation versus execution strategy |
| Minute 1–2 | Why graph/IR exists and what fusion changes | Whether one operator implies one kernel |
| Minute 2–3 | Tiles, layout, SRAM, and movement | Capacity feasibility and assumptions |
| Minute 3–4 | Compiler, device code, and runtime responsibilities | Compilation versus submission and synchronization |
| Minute 4–5 | A performance tradeoff and one CPU experiment | Correctness evidence and unmeasured claims |

Use this structure: because of a constraint, choose an approach, state its cost, and propose verification. A phone recording can reveal terms you cannot yet explain.

## Six questions: answer before revealing

### 1. How do models, IR, kernels, and runtime relate?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

A model expresses computation; IR represents programs for compiler analysis and transformation; a kernel performs a unit of device computation; the runtime handles memory, loading, submission, and synchronization. MatMul, bias, and ReLU may become one fused kernel, several kernels, or library calls. There are multiple IRs, and kernels need not originate in MLIR.

Follow-up: why might the first call be slower? JIT compilation, caching, initialization, and warmup are hypotheses to test through phase-specific timing, not conclusions established by the symptom alone.

Misconception: a model graph is GPU instructions, or each operator maps to exactly one kernel.

</details>

### 2. Why MLIR, and do Triton and TileLang both use it?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

MLIR supplies extensible IR, passes, rewrites, and verification so abstraction levels can express their constraints. It does not automatically implement every hardware target. Triton uses MLIR; TileLang currently uses TVM TIR. Both still address tiles, layouts, and memory.

Follow-up: can StableHLO execute a model by itself? Its principal role is portable operator representation and compatibility; execution still requires a consuming compiler and runtime.

Misconception: MLIR is one dialect, or every MLIR project follows one linalg pipeline. See [real projects](./real-world.md) for sources.

</details>

### 3. Why can fusion help or hurt?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

Fusion can avoid writing and rereading intermediates and reduce launches. With two intermediates physically materialized at the chosen external-memory boundary, our FP32 example avoids `4*M*N*4` bytes. Fusion can also increase register or shared-memory pressure, reduce parallelism, or prevent using a faster library kernel.

Follow-up: what if the intermediates already hit cache? Physical DRAM savings may be lower than logical traffic estimates; inspect actual memory metrics and end-to-end time.

Misconception: fewer source-level allocations directly predict a GPU speedup factor.

</details>

### 4. Are larger tiles and double buffering always better?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

Larger tiles can improve reuse while increasing local storage and changing parallel scheduling. The teaching model's 32-by-32 output tile needs 20 KiB with double buffering, fitting 32 KiB; a 64-by-64 version needs 48 KiB and is infeasible. Double buffering spends space to overlap load and compute, subject to channels, dependencies, and bottlenecks.

Follow-up: what if computation is slower than DMA? More load time may be hidden, but compute and fill/drain costs remain. Recalculate the schedule instead of reusing another configuration's timing.

Misconception: count A/B but omit the accumulator, or equate asynchronous submission with data arrival.

</details>

### 5. How do you establish rewrite legality?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

Define operation semantics and preconditions, then explain preservation of observable behavior. The teaching pass folds add only for two known constants after checking signed-i64 overflow; otherwise it retains the operation. Tests cover variables, chains, negatives, overflow boundaries, invalid references, and fixed points.

Follow-up: does this checked-i64 contract define `arith.addi`? No. MLIR's fixed-width integer semantics differ from the exercise's rejection policy, and C++ signed overflow is another contract. Floating-point transformations additionally require attention to rounding, NaNs, signed zero, and permitted fast-math conditions.

Misconception: a few passing positive examples prove equivalence for all inputs.

</details>

### 6. How should you discuss INT8 speed or memory-bound decode?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

Treat both as conditional claims. INT8 can reduce bytes and use specialized instructions, but conversion, calibration, supported shapes, accumulation, and output errors matter. Decode often has less weight reuse, while batch size, caches, KV state, communication, and the device influence the bottleneck.

Follow-up: how can work proceed without target hardware? Build a correctness reference, state resource constraints, and use analytical models to filter candidates within an explicit scope. Later calibrate against synchronized, warmed-up device benchmarks. CPU script duration is not BPU performance.

Misconception: roofline bounds, predictions, and measurements are interchangeable evidence.

</details>

## Score and continue

Score each question from zero to two: zero for recognizing terms only, one for explaining with an example, two for answering a changed condition with costs and verification. **9/12 is this tutorial's self-review threshold, not an industry certification; questions 1 and 5 should each score at least one.** Keep the CPU numerical and mapping experiment results as evidence. C++ has its own [practice assessment](./cpp-labs.md#review-discussion).

- Below the threshold, repeat the two weakest blocks instead of immediately building all of LLVM.
- Above it, choose one next direction: [rewrites](./passes-rewrites.md) and Toy for source reading, [accelerator mapping](./accelerator-mapping.md) for performance, or [testing and the capstone](./testing-study-plan.md) for an engineering slice.

Two days should enable evidence-based discussion and better next questions, not imply production-level compiler expertise.
