---
title: Topic Matrix
description: Cross-index of the six learning tracks, system dimensions, and architecture families.
outline: deep
products: ["Cross-architecture"]
documentType: "Topic index"
topics: ["Model computation", "Mapping", "Architecture", "Optimization", "Co-design", "Validation"]
---

# Topic Matrix

Most documents span computation, memory, scheduling, and the software stack. The [Curriculum](./curriculum.md) defines track ownership; this page indexes the same material by system question.

## Six Learning Tracks

| Track | Primary question | Entry |
| --- | --- | --- |
| Model Computation and Workload | What computation, data, state, and Communication does a model create? | [Model Computation Primitives and Workload Description](./notes/model-computation-primitives.md) |
| Model-to-Hardware Mapping | How does an Operation become device execution? | [Model-to-Hardware Mapping](./notes/model-to-hardware-mapping.md) |
| Hardware Architecture | Which resources exist, and which responsibilities belong to software? | [AI Accelerator Architecture Comparison](./notes/ai-accelerator-architecture-comparison.md) |
| Software Optimization | How can execution, Data Movement, synchronization, and idle time be reduced? | [Cross-Architecture Software Optimization](./notes/software-optimization-methodology.md) |
| Model–Hardware Co-design | When should the model, numerics, or hardware contract change? | [Model–Hardware Co-design](./notes/model-hardware-codesign.md) |
| Performance Modeling and Validation | How can a Bottleneck claim be quantified and falsified? | [Performance Modeling and Validation](./notes/performance-modeling.md) |

## Five Research Dimensions

| Dimension | Primary question |
| --- | --- |
| Compute organization | How does work map to SIMT, Functional Slices, Dataflow cores, or a Systolic Array? |
| Control and Scheduling | Does hardware, the Compiler, the Runtime, or a combination choose the next step? |
| Data Movement | How does a Tile move through registers, SRAM, Cache, NoC, HBM, and chip interconnects? |
| Software stack | Which decisions belong to graph compilation, Kernels, Runtime, Memory Planning, or optimization? |
| System scaling | How does a single-chip mechanism extend to multi-chip, Pod, heterogeneous inference, or online serving? |

## Recommended Entry Points

- Use the [Glossary](./glossary.md) when a shared term such as Core, Tile, Memory, or Completion may have architecture-specific meanings.
- Read the [Architecture Comparison](./notes/ai-accelerator-architecture-comparison.md) before making vendor comparisons.
- Follow the [Learning Roadmap](./notes/learning-roadmap.md) for a sequential path through the repository.
- Use the three labs to test Static Scheduling, Backpressure, and Systolic Wavefront behavior.
