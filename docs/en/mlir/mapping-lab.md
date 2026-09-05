---
title: "Tiles, Data Movement, and Performance Lab"
description: "A reproducible hypothetical accelerator connects layout, SRAM, DMA, double buffering, roofline reasoning, and INT8 without confusing predictions with measurements."
outline: deep
products: ["AI Accelerator", "MLIR"]
documentType: "Practical Tutorial"
topics: ["Tiling", "Layout", "Memory", "Performance", "Quantization"]
---

# Tiles, Data Movement, and Performance Lab

This page covers two blocks of the [twelve-hour route](./bootcamp.md): **spend 90 minutes on Block 5 through its exit check; complete C++ B and the real-project comparison, then return for Block 8's 60 minutes.** Numbers come from the repository's analytical script, not measurements of a commercial GPU or BPU.

## Block 5: A device is not an infinitely large matrix calculator

Budget 30 minutes for concepts and capacity, 25 for DMA and dependencies, 25 for experiments, and 10 for explanation.

The model specifies `C = A @ B`; it does not require every element beside the compute engine simultaneously. Keep one `BM x BN` output tile and repeatedly load `BM x BK` of A and `BK x BN` of B along K, accumulating into the same C.

BM and BN describe the output tile, while BK is the reduction chunk consumed per iteration. **A tile is a work partition, not a new mathematical operation.** Four partial dot products preserve the mathematical result; floating-point regrouping can change rounding and must respect the numerical contract.

### Layout locates a logical element

`A[i, j]` is a logical index. A contiguous row-major matrix uses element offset `i * K + j`; a general strided view uses `i * stride0 + j * stride1`, multiplied by element size and added to the base address.

- Transposing a view may only exchange shape and strides, without copying storage immediately.
- A device can require contiguous blocks, alignment, or a particular lane distribution. A logical transpose may therefore need packing or copying before efficient execution.
- A layout conversion can improve compute throughput while consuming bandwidth, temporary storage, and time. It is not free.

Predict the shape and strides of the transpose of a row-major `2 x 3` array with strides `(3, 1)`.

<details>
<summary>Reveal the answer</summary>

Its shape is `(3, 2)` and strides are `(1, 3)`. View element `[1, 0]` refers to original element `[0, 1]`; both have element offset 1. Creating this view has not physically reordered storage.

</details>

### Establish capacity feasibility before optimizing speed

Define a **hypothetical teaching accelerator** with 32 KiB of SRAM usable by this computation. A and B use FP16, and accumulator C uses FP32. Ignore bias, padding, descriptors, and additional workspace for now; a real capacity budget must include them.

With `BM=32, BN=32, BK=64, K=256`:

| Resident data | Calculation | Bytes |
| --- | --- | ---: |
| One A tile | `32 x 64 x 2` | 4096 |
| One B tile | `64 x 32 x 2` | 4096 |
| One accumulator C tile | `32 x 32 x 4` | 4096 |
| Single buffer | `A + B + C` | 12288 (12 KiB) |
| Double-buffered A/B | `2 x (A + B) + C` | 20480 (20 KiB) |

Double buffering reserves another A/B pair for the next chunk, but retains one C. Increasing both BM and BN to 64 requires **48 KiB**, exceeding capacity. A larger tile may improve reuse, but capacity is a hard feasibility condition, not merely a score penalty.

### DMA and computation perform different jobs

DMA moves device data and can run asynchronously after submission. The compiler/runtime must stop computation from reading data before arrival and stop DMA from overwriting a buffer still in use.

Add explicit assumptions:

- One DMA load channel provides 8 bytes/cycle. Each A+B pair is **one combined request**, costing 80 setup cycles.
- Compute throughput is 256 ops/cycle, counting a multiply-add as two operations.
- Four K chunks update one resident output tile; C is stored only at the end.
- Ignore bank conflicts, synchronization cost, instruction issue, and the epilogue. The final store also costs 80 setup cycles and does not overlap another output tile.

Each load costs `80 + 8192/8 = 1104 cycles`; each compute chunk costs `2*32*32*64/256 = 512 cycles`; the final store costs `80 + 4096/8 = 592 cycles`.

| Schedule | Reason | Predicted cycles for this output tile |
| --- | --- | ---: |
| Single buffer | Wait until computation releases A/B before overwriting | `4*(1104+512)+592 = 7056` |
| Double buffer | Overlap the next load with the current computation | `4*1104+512+592 = 5520` |

Double-buffered loads occupy `[0,1104]`, `[1104,2208]`, `[2208,3312]`, and `[3312,4416]`. The corresponding computations begin at 1104, 2208, 3312, and 4416, each lasting 512 cycles. The last computation ends at 4928; the final store adds 592 cycles.

Overlap does not halve every duration. Loads remain slower than computation, and initial fill and final drain remain. If A and B were separate DMA requests, each would incur setup overhead and the answer would change.

### Run and change one condition

From the repository root, run these commands. Phone readers should predict before revealing the answer.

```sh
python3 -B labs/compiler_bootcamp/workload.py mapping
python3 -B labs/compiler_bootcamp/workload.py mapping --buffers 1
python3 -B labs/compiler_bootcamp/workload.py mapping --tile-m 64 --tile-n 64
```

<details>
<summary>Reveal key results and their meaning</summary>

The default gives `working_set_bytes = 20480`, `feasible = true`, and `estimated_cycles_one_output_tile = 5520`. Single buffering changes these to 12288 bytes and 7056 cycles. The larger tile needs 49152 bytes and reports `feasible = false`; the script does not invent a normal schedule for an infeasible allocation.

Source: [workload.py](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/workload.py). Buffer reuse waits for the previous computation using that slot. Computation waits for its load and the preceding accumulation. This is an analytical model under explicit assumptions, not a cycle-accurate simulator.

</details>

Try `--tile-k 32` and `--tile-k 128`. Predict SRAM use and request count first. The exercise requires K to be divisible by BK. A real kernel must handle tails instead of reading beyond the last partial tile.

### Block 5 exit check

Explain the extra storage used by double buffering, the dependency that prevents premature reads, and why the 48 KiB plan must be rejected.

Continue to [C++ B: a miniature pass](./cpp-labs.md), then [real projects](./real-world.md), before returning below.

## Block 8: Performance and numerics, 60 minutes

Budget 20 minutes for roofline and shapes, 20 for INT8, and 20 for verification and explanation.

### Many FLOPs do not automatically mean compute-bound

Arithmetic intensity is operations divided by bytes moved across a specified storage boundary. DRAM, cache, and SRAM traffic differ. Roofline combines peak compute and bandwidth into an ideal throughput ceiling. The corresponding latency lower bound is `max(ops/peak_ops_per_second, bytes/bandwidth)`; real overhead makes this ideal model incomplete.

Recall the [FP32 MatMul experiment](./model-to-kernel.md), with `M=128, K=256, N=128`. Reading A, B, and bias once and writing C once gives **328192 bytes** of ideal fused traffic and **8388608 ops**, approximately **25.56 ops/byte**. These whole-matrix FP32 quantities belong to a different experiment from the FP16 single-tile model above.

Change only M to 1. Under the same assumptions, there are 65536 ops and 133120 bytes, approximately **0.49 ops/byte**. Almost the same weight matrix now serves just one output row, reducing reuse.

This helps explain why LLM prefill and decode can have different bottlenecks, but it is **not a complete LLM or attention model**. Weight caching, batch size, KV cache, communication, and hardware can change the result. A phase's name alone does not establish its bottleneck.

```sh
python3 -B labs/compiler_bootcamp/workload.py model
```

Exercise: does eliminating two intermediate arrays through fusion guarantee acceleration? Name the avoided transfers, possible register pressure or parallelism costs, and measurements needed to decide.

### INT8 changes both representation and numerical contracts

A simple per-tensor rule is `q = clamp(round(x / scale) + zero_point, -128, 127)`, with approximate reconstruction `(q - zero_point) * scale`. Scale must be positive. The script uses round-to-nearest, ties-to-even; a real target must specify its own rounding and saturation behavior.

```sh
python3 -B labs/compiler_bootcamp/workload.py quant
```

<details>
<summary>Predict before revealing quantization results</summary>

For `scale=0.1, zero_point=0`, inputs `[-20, -0.26, 0.24, 20]` become `[-128, -3, 2, 127]`, reconstructing approximately `[-12.8, -0.3, 0.2, 12.7]`. The middle values show rounding error; the endpoints additionally suffer range clipping. These are distinct error sources.

</details>

INT8 MatMul commonly uses wider INT32 accumulation, but overflow still depends on reduction length, zero-point corrections, and bias. Returning to INT8 also needs rescaling, rounding, and clamping. Compiler fusion and rewrites must preserve the agreed numerical semantics; validation should cover both operator errors and end-task metrics.

### Evidence for correctness and speed

| Evidence | What it addresses | What it cannot establish alone |
| --- | --- | --- |
| CPU reference or functional simulator | Numerical and execution semantics | Real device latency |
| Analytical or calibrated performance model | Likely bottlenecks and candidate ranking | Exact speed on unmodeled hardware |
| Cycle-accurate simulator | Cycle behavior within its modeled scope | Unmodeled physical effects |
| Device benchmark | Performance for specified inputs, versions, and measurement procedure | Improvement for every shape |

Fix shape, dtype, hardware, and software versions. Separate compilation and warmup from steady-state execution, synchronize asynchronous device work before timing completion, repeat measurements, and check outputs. Label this script's cycles as predictions, not measured BPU performance.

### Block 8 exit check

Write one capacity constraint, one performance assumption, and one numerical risk, each with a verification method. Finish with the [30-minute discussion rehearsal](./discussion.md).

Optional primary references: the [Triton MatMul tutorial](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html) demonstrates blocking, reuse, and tuning; [MLIR Quantization](https://mlir.llvm.org/docs/Quantization/) explains quantized representations and types.
