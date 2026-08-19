---
title: Cross-Architecture Software Optimization
description: A shared Bottleneck classification, Optimization loop, and evidence record for GPU, array, and Dataflow architectures.
outline: deep
products: ["Cross-architecture"]
documentType: "Full-stack backbone"
topics: ["Optimization", "Bottleneck", "Compiler", "Runtime"]
---

# Cross-Architecture Software Optimization

## Core Question

How can unnecessary execution, Data Movement, synchronization, and idle time be reduced without violating semantics, quality, or service objectives?

## Non-goals

- Do not organize Optimization as a list of vendor APIs and tuning tricks.
- Do not propose a change before establishing a baseline and Bottleneck evidence.
- Do not substitute a single Kernel result for end-to-end impact.
- A change to model semantics or a hardware contract belongs to [Model–Hardware Co-design](./model-hardware-codesign.md).

## Fixed Optimization Loop

1. **Establish a baseline:** fix the Workload, input distribution, quality, hardware, software, and end-to-end metrics.
2. **Classify the Bottleneck:** compute, bandwidth, capacity, Latency, Communication, synchronization, or Load Imbalance.
3. **Choose the owning layer:** model graph, Compiler, Kernel, Runtime, or distributed execution.
4. **Make a prediction:** estimate the change in Operation count, bytes, capacity, synchronization, or Critical Path time.
5. **Change one mechanism:** preserve a comparable fallback.
6. **Validate jointly:** check local metrics, end-to-end metrics, resource side effects, and quality.
7. **Record boundaries:** state the Tensor Shapes, architectures, and conditions under which the result holds.

## Bottleneck-to-Strategy Map

| Bottleneck | Inspect first | Candidate strategies | Common side effects |
| --- | --- | --- | --- |
| Compute throughput | Operation count, Utilization, instruction mix | algorithm change, lower precision, vectorization, specialized Kernel | quality loss, conversion cost |
| Memory bandwidth | bytes, Reuse distance, transaction efficiency | Fusion, Tiling, layout, compression, prefetch | capacity pressure, edge complexity |
| Capacity | parameters, activations, KV Cache, temporary buffers | recomputation, Quantization, paging, Sharding, lifetime Reuse | more compute or Communication |
| Launch and short-task Latency | Kernel count, submission gaps, batch size | Fusion, graph capture, persistent Kernel, batching | lower flexibility, tail-Latency changes |
| Communication | collective bytes, topology, overlap | better Sharding, compression, Pipeline Overlap | Load Imbalance, numerical effects |
| Synchronization | Barriers, Events, serial Critical Path | smaller synchronization scope, pipelining, asynchronous queues | correctness and debugging complexity |
| Load Imbalance | tail Tiles, Routing, device variance | repartitioning, Dynamic Scheduling, capacity control | scheduling overhead |

## Optimization Record

| Field | Required content |
| --- | --- |
| Baseline | Workload, hardware, software, Data Type, quality, end-to-end metrics |
| Invariants | Semantics, quality, SLO, and resource constraints |
| Bottleneck evidence | profile, counters, model estimate, and Critical Path |
| Change | The mechanism and owning layer |
| Prediction | Expected change in Operations, bytes, capacity, synchronization, or Communication |
| Measurement | Local and end-to-end results with variance |
| Side effects | compile time, memory, tail Latency, quality, portability |
| Validity boundary | Tensor Shapes, batch sizes, architectures, and versions |

## Completion Criteria

An Optimization claim includes a reproducible baseline, Bottleneck evidence, a resource-change prediction, end-to-end measurement, a quality check, and a validity boundary. Without all six, it remains a hypothesis.
