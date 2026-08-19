---
title: Model Computation Primitives and Workload Description
description: Describe model computation, data, state, parallelism, and Communication before discussing a Compiler or hardware target.
outline: deep
products: ["Cross-architecture"]
documentType: "Full-stack backbone"
topics: ["Model", "Workload", "Tensor Shape", "Reuse"]
---

# Model Computation Primitives and Workload Description

## Core Question

What computation, data, state, Dependencies, and Communication does a model create before any implementation is selected?

## Non-goals

- Do not infer hardware requirements from a model family name alone.
- Do not choose a Kernel, Compiler, or accelerator before the Workload is specified.
- Do not treat peak FLOPS or parameter count as a complete Workload description.
- Do not hide Prefill, Decode, training, or dynamic behavior behind one average case.

## Minimum Analysis Unit

| Field | Required description |
| --- | --- |
| Operation | Mathematical semantics and algorithmic variant |
| Tensor Shape | Dimension sizes, meanings, and dynamic ranges |
| Data Type | Storage, compute, and accumulation precision |
| Dependency | Inputs that must be ready before execution |
| Data Movement | Logical reads and writes before mapping to a memory hierarchy |
| Reuse | How often data can be reused and across which dimensions |
| Persistent State | Weights, KV Cache, optimizer state, or other long-lived data |
| Dynamic behavior | Variable sequence length, Routing, sparsity, or control flow |
| Communication | Data exchanged across cores, devices, or hosts |
| Quality contract | Accuracy, loss, or numerical constraints that must be preserved |

## Primitive Families

### Dense compute

GEMM, batched GEMM, convolution, and tensor contractions are dominated by regular multiply-accumulate structure but differ in Tensor Shape, Reuse, and layout.

### Reduction and normalization

Softmax, LayerNorm, RMSNorm, sum, and max introduce cross-element Dependencies and often require multiple passes or an online algorithm.

### Elementwise and transform work

Activation functions, residual additions, casts, transpose, reshape, and layout conversion may have low Operation count but high Data Movement or Kernel Launch cost.

### Irregular and dynamic work

Embedding lookup, Gather/Scatter, sparse Operations, and MoE Routing can introduce unpredictable access, Load Imbalance, and Runtime decisions.

### State and Communication

KV Cache, optimizer state, checkpointing, and Collective Communication are part of the Workload. They must not be treated as secondary implementation details.

## Workload Ledger

| Phase | Operation | Input Shape | Output Shape | Data Type | State | Logical bytes | Communication | Dynamic variables |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Prefill |  |  |  |  |  |  |  |  |
| Decode |  |  |  |  |  |  |  |  |
| Training |  |  |  |  |  |  |  |  |

## Transformer Common Case

For one Transformer block, record QKV projections, Attention score computation, Softmax, value aggregation, output projection, normalization, and FFN. Then evaluate Prefill, Decode, and training separately because their Tensor Shapes, Reuse, Persistent State, and Communication differ.

## Interfaces to Other Tracks

- [Model-to-Hardware Mapping](./model-to-hardware-mapping.md) consumes the Workload ledger.
- [Software Optimization](./software-optimization-methodology.md) changes work, movement, or execution while preserving the stated contract.
- [Model–Hardware Co-design](./model-hardware-codesign.md) changes a cross-layer contract when local Optimization is insufficient.
- [Performance Modeling](./performance-modeling.md) converts the ledger into quantitative bounds and experiments.

## Completion Criteria

A reader can describe one model block without referring to a vendor device, distinguish Prefill, Decode, and training, and produce an auditable ledger of Operations, Tensor Shapes, Data Types, state, Data Movement, and Communication.
