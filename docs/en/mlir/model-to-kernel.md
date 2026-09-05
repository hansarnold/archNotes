---
title: "From a Model Expression to a Kernel"
description: "Connect a MatMul, bias, and ReLU to graphs, IR, kernels, runtime, and hardware, then run a CPU-only fusion comparison."
outline: deep
products: ["AI Accelerator", "PyTorch", "MLIR"]
documentType: "Introductory Case"
topics: ["Graph", "Kernel", "Runtime", "Fusion", "MatMul"]
---

# From a Model Expression to a Kernel

Day 1 blocks 1–2 of the [AI Compiler concept route](./bootcamp.md), 150 minutes total. Spend the first 60 minutes through compilation/execution, then 90 minutes on numerical observations, traffic accounting, and explanation.

## Start with the user's computation

`Y = ReLU(X @ W + bias)` describes a common linear layer followed by an activation. Understanding a full Transformer is not a prerequisite.

- A **tensor** is multidimensional data with shape and dtype. Here `X` has shape `M × K` and `W` has shape `K × N`.
- **MatMul** produces `M × N` outputs, each summing `K` products.
- The **bias** is an `N`-element vector broadcast across rows.
- **ReLU** applies `max(value, 0)` to each element.

For a 2×3 input and 3×2 weight, the output is 2×2. This describes computation without deciding thread counts or physical storage.

## What each layer sees

| Layer | Concrete representation | Decision |
| --- | --- | --- |
| Model expression | `relu(X @ W + bias)` | Specify computation and parameters |
| Graph | MatMul, Add, ReLU nodes and dependencies | Fuse, decompose, select implementations, or partition |
| IR | A compiler representation that can be analyzed and changed | Retain semantics and introduce implementation constraints |
| Kernel | Device work such as tiled GEMM with an epilogue | Parallel work, accesses, and computation order |
| Machine code | Executable target instructions | Select loads, matrix, vector, and other instructions |
| Runtime / Driver | Allocation, loading, submission, synchronization, cleanup | Arrange resources and establish when outputs are usable |

A graph can be an IR, and a kernel can have its own IR. IR names a category, not a universally shared file format. Several graph operations may fuse into one kernel; one operation may require several kernels; a compiler may select an existing library kernel instead.

## Why the compiler intervenes

An ordinary loop makes the mathematical computation explicit:

```python
for m in range(M):
    for n in range(N):
        acc = 0
        for k in range(K):
            acc += X[m][k] * W[k][n]
        Y[m][n] = max(acc + bias[n], 0)
```

The next questions are which outputs can run in parallel, which reused values fit in fast memory, whether a layout conversion is needed, and which dtypes the device accepts.

Graph optimization may attach Bias/ReLU to MatMul's ending, or **epilogue**. Kernel optimization may choose a tile, load order, or synchronization scheme. They operate at different levels while both affecting performance.

## Compilation versus execution

Compilation analyzes and transforms a program into target code. During execution, the runtime and driver prepare buffers and parameters, submit work, and manage its completion. JIT means compilation happens during application execution; it does not imply recompiling on every call.

The first invocation can include compilation and cache population. Distinguish cold start from warmed execution, and wait for asynchronous device work before measuring its completion time.

Clang experience provides an analogy for source-to-object compilation. AI compilers additionally face graph fusion, tensor shape/layout decisions, and accelerator memory mapping; deployment still requires runtime work beyond compilation.

::: details Three calls: three compilations or three executions?
The function is executed three times, but compilation reuse depends on caching and specialization. Shape, dtype, control flow, and configuration changes may cause another compilation. The word JIT alone does not determine the count.
:::

## Run a numerical comparison {#block-2}

From the repository root:

```sh
python3 labs/compiler_bootcamp/workload.py model
```

The [reference program](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/workload.py) uses only Python's standard library. One CPU implementation creates separate MatMul and bias intermediates; the fused implementation writes the final output directly.

Use `X=[[1,2,-1],[0,1,3]]`, `W=[[2,-1],[1,3],[-2,1]]`, and `bias=[-1,2]`. Calculate the first output row before running.

::: details Expected values
The result is `[[5,6],[0,8]]`. The upper-left dot product is 6, its bias is -1, and ReLU retains 5. The lower-left biased value is -6, so ReLU produces zero.

No timing or GPU execution occurs. This checks finite-input numerical behavior for these Python implementations; it does not establish GPU FP16, FMA, overflow, or NaN equivalence.
:::

Change one input to make another output clamp to zero. Predict which outputs change, then compare both implementations.

## Account for traffic saved by fusion

Analyze `M=128, K=256, N=128` with FP32 inputs, bias, and output. Count a multiply-add as two operations. The operation count below excludes the smaller Bias/ReLU work.

| Quantity | Calculation | Result |
| --- | --- | ---: |
| MatMul operations | `2 × M × N × K` | 8,388,608 |
| Input and weight bytes | `(M×K + K×N) × 4` | 262,144 |
| Bias read and final output write | `(N + M×N) × 4` | 66,048 |
| Ideal fused traffic | Read each input once; write output once | 328,192 bytes |
| Extra intermediate traffic | Write/read MatMul and bias intermediates | 262,144 bytes |

If both intermediates cross the memory boundary being analyzed, the unfused count is 590,336 bytes. Eliminating these transfers and possibly launch overhead motivates fusion.

This is an analytical ledger with assumptions, not a measured HBM counter. Caches, reloaded tiles, library epilogues, layout copies, and the actual execution path can change it. The program explicitly reports `timing_measured: false`.

::: details Does less traffic guarantee a speedup?
No. Fusion can increase live values, register/SRAM pressure, or reduce parallelism. It may also displace a better library implementation. Check feasibility, whole-workload timing, and numerical error before claiming improvement.
:::

## Explain the path yourself

In three minutes, describe the computation, what the compiler may change, where movement becomes explicit, who submits device work, and which evidence would support an optimization.

Continue directly to [Reading an IR Change](./ir-reading.md). Compare the real graph-capture/backend relationship with the [PyTorch compiler documentation](https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler.html) and the blocked algorithm with [Triton's matrix multiplication tutorial](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html).
