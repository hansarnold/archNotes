---
title: AI Compute Full-Stack Co-design Curriculum
description: Ownership, interfaces, and delivery order for six connected learning tracks.
outline: deep
products: ["Cross-architecture"]
documentType: "Curriculum blueprint"
topics: ["Model computation", "Mapping", "Architecture", "Optimization", "Co-design", "Validation"]
---

# AI Compute Full-Stack Co-design Curriculum

The repository is organized around a bidirectional method. The downward direction starts with a model and derives software and hardware requirements. The upward direction starts with hardware resources and constraints and derives better mappings, numerics, or model choices.

```text
Model structure and Workload
  ↕
Algorithms, numerics, and layout
  ↕
Framework, IR, Compiler, Runtime, and Kernel
  ↕
ISA, Compute Units, memory, NoC, and interconnect
  ↕
Multi-device execution, serving, and SLOs
```

The six tracks form one loop: **describe the Workload → map execution → understand hardware → optimize software → change a model or hardware contract → validate with evidence.**

## Learning Outcomes

For a MatMul, Attention layer, MoE layer, or Transformer block, a reader should be able to:

1. specify Operations, Tensor Shapes, Dependencies, Persistent State, and Data Types;
2. estimate Operation count, Data Movement, Working Set, Reuse, and Communication;
3. trace a graph through IR, Kernels, instruction streams, and device execution;
4. assign compute, memory, Scheduling, synchronization, and Communication responsibilities;
5. classify the dominant Bottleneck;
6. propose changes at the model, Compiler, Kernel, Runtime, or hardware layer;
7. design an Experiment Contract that can falsify the proposal;
8. preserve quality, generation, topology, software, and system boundaries.

## Track Ownership

| Track | Unique responsibility | Ownership document |
| --- | --- | --- |
| Model Computation and Workload | Describe what the model requires before choosing an implementation. | [Model Computation Primitives and Workload Description](./notes/model-computation-primitives.md) |
| Model-to-Hardware Mapping | Connect every lowering and execution layer without hiding decisions behind “the Compiler.” | [Model-to-Hardware Mapping](./notes/model-to-hardware-mapping.md) |
| Hardware Architecture | Compare resources, Execution Models, and software contracts with one coordinate system. | [AI Accelerator Architecture Comparison](./notes/ai-accelerator-architecture-comparison.md) |
| Software Optimization | Select an Optimization from measured Bottleneck evidence. | [Cross-Architecture Software Optimization](./notes/software-optimization-methodology.md) |
| Model–Hardware Co-design | Decide when a model, numerical, software, or hardware contract must change. | [Model–Hardware Co-design](./notes/model-hardware-codesign.md) |
| Performance Modeling and Validation | Provide common units, models, predictions, and experiments. | [Performance Modeling and Validation](./notes/performance-modeling.md) |

Other documents are mechanism studies, vendor monographs, comparisons, or labs. They extend an ownership document but do not redefine its shared concepts.

## Shared Case Study

A Transformer block is the first common case because it combines dense matrix Operations, Reductions, elementwise work, KV Cache state, dynamic Decode behavior, and multi-device Communication.

Each track produces one linked artifact:

1. Workload ledger;
2. Mapping ledger;
3. architecture responsibility comparison;
4. Optimization record;
5. Co-design decision record;
6. Performance Model and Experiment Contract.

## Delivery Order

### P0 — Shared Framework

The six ownership documents and both Glossary pages are present. This phase establishes boundaries, templates, and Completion criteria.

### P1 — Representative Workloads

- Transformer Workload and Training Workload;
- Attention and KV Cache Co-design;
- benchmark methodology;
- Roofline and Data Movement lab.

### P2 — Dynamic and Distributed Systems

- MoE Routing, expert Placement, and Load Imbalance;
- numerics and structured sparsity;
- Collective Communication and topology;
- serving-level Performance Models.

## Documentation Contract

Chinese and English pages are authored directly in Markdown. Paired pages keep the same relative path. Technical terminology follows the [Glossary](./glossary.md) in both locales, and the build performs rendering only.
