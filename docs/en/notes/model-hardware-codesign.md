---
title: Model–Hardware Co-design
description: A bidirectional method connecting model structure, numerics, software mapping, and hardware capabilities.
outline: deep
products: ["Cross-architecture"]
documentType: "Full-stack backbone"
topics: ["Co-design", "Model", "Hardware", "Numerics"]
---

# Model–Hardware Co-design

## Core Question

How should a model express quantitative hardware requirements, and when should hardware constraints change model structure, numerics, or training?

## Non-goals

- Do not label every Compiler or Kernel Optimization as Co-design.
- Do not claim throughput improvement without quality validation.
- Do not attempt a complete chip product definition.
- Prefer the smallest cross-layer change that removes the dominant constraint.

## Four Layers of Design Knobs

| Layer | Typical knobs | Costs that must be recorded |
| --- | --- | --- |
| Model structure | dimensions, layers, Attention form, experts, Routing | quality, training stability, generalization |
| Algorithm and numerics | Quantization, scaling, sparsity, approximation, recomputation | error, calibration, retraining |
| Compiler and Runtime | Fusion, Tiling, layout, Scheduling, Sharding | Tensor Shape coverage, complexity, portability |
| Hardware and system | Data Types, memory hierarchy, interconnect, array shape, ISA support | area, power, bandwidth, Utilization, generality |

## Decision Process

1. Fix the task objective and quality, Latency, throughput, capacity, energy, or cost constraints.
2. Establish a normal model–software–hardware baseline.
3. Separate a hard resource constraint from a temporary implementation problem.
4. Evaluate local Software Optimization first.
5. Propose the smallest cross-layer change.
6. Predict changes in compute, Data Movement, capacity, Communication, quality, and generality.
7. Validate system metrics and model quality together.

## Constraint–Response Matrix

| Constraint | Model or algorithm response | Software or hardware response | Required risk check |
| --- | --- | --- | --- |
| KV Cache capacity or bandwidth | MQA/GQA, KV Quantization, windowing | paging, low-precision storage, more bandwidth | long-context quality, conversion cost |
| Attention intermediate traffic | change the Attention form | fused Attention, on-chip residency | Tile boundaries, Local SRAM capacity |
| Matrix dimensions underfill an array | adjust hidden, head, or expert dimensions | flexible Tiling, tail handling, array shape | parameter efficiency, model quality |
| MoE Communication and Load Imbalance | Routing constraints, expert granularity | expert Placement, topology-aware collectives | dropped tokens, hotspots, tail Latency |
| Low-precision error | QAT, scaling, sensitive-layer exceptions | accumulation precision and conversion support | overflow, drift, training cost |
| Unstructured sparsity is ineffective | structured sparse training | sparse ISA, metadata path, Scheduling | metadata cost, effective density |

## Co-design Decision Record

Record the task and constraints, baseline mapping, dominant evidence, local options already evaluated, cross-layer changes, resource prediction, quality validation, system validation, and failure boundary.

## Boundary with Software Optimization

Fusion, Tiling, layout, Scheduling, and Kernel selection under unchanged semantics remain [Software Optimization](./software-optimization-methodology.md). A problem enters Co-design when model semantics, training constraints, numerical contracts, or hardware capabilities must change together.

## Completion Criteria

A Co-design claim includes a normal baseline, hard-constraint evidence, evaluated local alternatives, a cross-layer resource prediction, model-quality results, and system measurements. A one-sided benefit is not a complete conclusion.
