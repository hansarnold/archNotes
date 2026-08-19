---
title: Performance Modeling and Validation
description: Common units, layered models, and Experiment Contracts for predictions that can be measured and falsified.
outline: deep
products: ["Cross-architecture"]
documentType: "Full-stack backbone"
topics: ["Performance", "Roofline Model", "Profiling", "Validation"]
---

# Performance Modeling and Validation

## Core Question

How can the dominant resource limit be predicted before implementation and validated afterward with consistent units and experimental conditions?

## Non-goals

- Do not replace a cycle-accurate simulator or chip power model.
- Do not treat vendor peak specifications as application performance.
- Do not infer a system result from one run or one Kernel.
- Do not force every layer into one universal formula.

## Common Units and Metrics

| Category | Base quantities | Derived metrics |
| --- | --- | --- |
| Compute | Operations, instructions, Tensor Shape | effective throughput, Utilization, Operations per token |
| Data Movement | bytes, transactions, memory level | Effective Bandwidth, Arithmetic Intensity, Reuse |
| Capacity | parameters, activations, KV Cache, temporary buffers | peak Working Set, supported batch or context |
| Time | launch, compute, waiting, synchronization, queueing | Latency, Critical Path, overlap ratio |
| Communication | message bytes, hops, collective | link Utilization, Communication fraction, scaling efficiency |
| Serving | request rate, batch, tokens, queue depth | TTFT, ITL, throughput, P95/P99, SLO attainment |
| Energy | joules, watts, elapsed time | energy per token, performance per watt |

Every number requires a unit, counting convention, and measurement boundary. For example, state whether a multiply-accumulate counts as one or two Operations.

## Minimum Estimates

```text
Arithmetic Intensity = Operations / Bytes
Compute Lower Bound  = Operations / Effective Compute Rate
Memory Lower Bound   = Bytes / Effective Bandwidth
Simple Runtime Bound = max(Compute Lower Bound, Memory Lower Bound)
```

Use effective rates derived from comparable microbenchmarks, previous measurements, or a documented conservative assumption—not theoretical peak rates.

### Capacity

```text
Working Set = Parameters + Activations + Persistent State + Temporary Buffers
Working Set <= Available Capacity × Safety Factor
```

When capacity fails, the system must introduce paging, Sharding, recomputation, Quantization, or offload. The Performance Model must then change as well.

### Overlap and Critical Path

Compute, Data Movement, and Communication overlap only when Dependencies and resources allow it. Model serialized, ideal-overlap, and trace-calibrated cases separately.

## Five Modeling Levels

| Level | Inputs | Outputs | Common error source |
| --- | --- | --- | --- |
| Operation | Tensor Shape, Data Type, algorithm | Operations, logical bytes | ignoring Fusion and transactions |
| Kernel | Tile, layout, memory hierarchy | throughput, bandwidth, Occupancy | Compiler behavior, boundary Tiles |
| Device | Kernel graph, Dependencies, capacity | Critical Path, Utilization | launch, synchronization, contention |
| Distributed | Sharding, collectives, topology | Communication time, scaling efficiency | hotspots, Load Imbalance, shared links |
| Serving | request distribution, batching, queue | TTFT, ITL, throughput, tail Latency | queueing, dynamic Tensor Shapes, cache hits |

## Experiment Contract

Before execution, record the question, fixed conditions, quantitative prediction, control, collected metrics, statistical method, and falsification criterion.

Keep three columns for every result: theoretical bound, assumption-based prediction, and actual measurement. A gap is evidence of omitted cost such as cache behavior, synchronization, Scheduling holes, conversion, or Communication contention.

## Completion Criteria

Every performance conclusion is traceable to explicit units, assumptions, formulas, predictions, experimental conditions, and a falsification criterion. When the model disagrees with measurement, explain the gap or lower the confidence of the claim.
