---
title: "MLIR and AI Accelerator Mapping"
description: "Start from the hardware contract and reason systematically about engine selection, tiling, layout, memory planning, DMA scheduling, and performance models for MatMul."
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "Backend Topic"
topics: ["Hardware Mapping", "Tiling", "Memory Planning", "DMA", "Performance Model"]
---

# MLIR and AI Accelerator Mapping

Lowering a MatMul for a backend is much more than replacing it with a hardware instruction. The compiler must turn computation, storage, data movement, synchronization, and resource allocation into one executable plan.

## Establish the Hardware Contract First

Before targeting a new accelerator, answer these questions:

- Which compute engines exist, and which dtypes and tile shapes does each support?
- What are the capacity, bandwidth, alignment, bank, and layout constraints of the memory hierarchy?
- Which transfer directions, strides, transposes, and concurrent channels does DMA support?
- How do engines synchronize, and what are the limits and costs of events or barriers?
- Are instructions synchronous, submitted asynchronously, or placed in a command queue?
- Which decisions belong to the runtime, and which must be fixed statically?

The answers define the operations, types, attributes, and interfaces required by the target dialect.

## Six Steps for Mapping MatMul

### 1. Select the Operator Implementation

Resolve the complete semantics first: transpose, batch, broadcast, bias, activation, quantization, and accumulator type. Looking only at the `matmul` name while ignoring its epilogue and layout can select an invalid implementation.

### 2. Select Tiles

```text
for m0 in tiles(M):
  for n0 in tiles(N):
    acc = 0
    for k0 in tiles(K):
      acc += A[m0, k0] × B[k0, n0]
```

A tile must satisfy matrix-engine granularity, tail handling, parallelism, and on-chip memory capacity at the same time.

### 3. Select Layouts

A layout maps a logical tensor to physical storage. Check:

- packing or swizzling required by the matrix engine;
- whether DMA can produce the layout directly;
- layout compatibility with adjacent operations;
- traffic and latency introduced by layout transforms.

The fastest layout for one operation is not necessarily the fastest layout for the graph.

### 4. Plan Memory

The working set for one tile includes at least:

```text
bytes(A_tile) + bytes(B_tile) + bytes(C_tile)
+ double-buffer copies
+ padding / alignment / temporary buffers
≤ usable SRAM
```

Usable SRAM is smaller than nominal capacity because concurrent work, metadata, banks, and alignment also consume space. The memory planner must additionally analyze lifetimes, reuse buffers, and decide when to spill.

### 5. Schedule DMA and Compute

```text
time ─────────────────────────────────→

DMA:      load A0/B0 | load A1/B1 | load A2/B2
Matrix:                compute 0  | compute 1  | compute 2
Store:                             | store C0  | store C1
```

Double buffering can hide part of transfer latency, but it consumes more SRAM and complicates synchronization. A real schedule must also represent dependencies, channel contention, barriers, and buffer ownership.

### 6. Generate Code and Simulate

```text
scheduled target IR
      ├─ Encoder / Runtime → Executable
      └─ Simulator         → Cycles / Utilization / Stalls
```

The compiler and simulator need a stable target-IR contract so that mapping errors can be distinguished from performance-model errors.

## Roofline Is the First Filter

```text
T_compute ≈ Operations / Effective Throughput
T_memory  ≈ Bytes / Effective Bandwidth
```

With sufficient overlap:

```text
T ≈ max(T_compute, T_memory)
```

Without overlap, add the terms and then account for setup, dependency stalls, synchronization, and resource contention.

Arithmetic intensity is:

```text
AI = Operations / Bytes Transferred
```

Roofline quickly suggests whether a workload is compute-bound or memory-bound. It does not automatically model DMA setup, bank conflicts, tail loss, or dependencies between engines.

## Avoid Local-Only Optimization

```text
Implementation A
MatMul: 1.0 ms
Layout transform: 0.7 ms
Total: 1.7 ms

Implementation B
MatMul: 1.2 ms
Reuse upstream layout: 0 ms
Total: 1.2 ms
```

A useful cost model considers graph-wide layout compatibility, intermediate traffic, fusion opportunities, and engine overlap, not just the latency of an isolated operation.

## The Backend Contract for Quantization

```text
x ≈ scale × (q - zero_point)
q = clamp(round(x / scale) + zero_point)
```

A common path is:

```text
INT8 × INT8
  → INT32 accumulator
  → Requantize + Clamp
  → INT8
```

The compiler must align scale, zero point, accumulator type, rounding, saturation, and target-instruction semantics. Calculations with rounding or saturation cannot be reordered freely.

## Three Simulator Levels

- A functional simulator checks numerical results.
- A performance simulator estimates latency, cycles, utilization, and bottlenecks.
- A cycle-accurate simulator attempts to model pipelines and resource contention one cycle at a time.

An explainable performance simulator needs at least:

```text
Operation or Command Trace
  → Dependency DAG
  → Engine Queues and Event Scheduler
  → Latency / Throughput / Bandwidth / Contention
  → Cycles / Utilization / Stall Breakdown
```

Calibrate the model with microbenchmarks and silicon measurements, and track prediction error.

## A Good Interview Answer Order

1. State the operation semantics, shape, dtype, and layout.
2. Check target legality and define fallback behavior.
3. Choose an engine and implementation.
4. Tile according to compute granularity and SRAM limits.
5. Plan buffer lifetimes, placement, and reuse.
6. Insert DMA, events or barriers, and double buffering.
7. Generate target IR or ISA, then validate with a simulator and microbenchmarks.
8. Compare end-to-end cost instead of isolated peak throughput.

## Exercise

Design two implementations for a `64×64 × 64×64` MatMul: one using 16×16×16 matrix-engine tiles and one fallback with lower setup cost. For each, list legality, memory traffic, synchronization, and the shapes where it is appropriate. Do not invent unavailable latency numbers.
