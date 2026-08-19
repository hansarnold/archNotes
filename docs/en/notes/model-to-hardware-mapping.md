---
title: Model-to-Hardware Mapping
description: Trace a model graph through IR, Kernels, Runtime tasks, instruction streams, Data Movement, and hardware execution.
outline: deep
products: ["Cross-architecture"]
documentType: "Full-stack backbone"
topics: ["Mapping", "Compiler", "Runtime", "Execution"]
---

# Model-to-Hardware Mapping

## Core Question

How does a model Operation become compute, memory access, Communication, and synchronization on real hardware?

## Non-goals

- Workload semantics belong to [Model Computation Primitives](./model-computation-primitives.md).
- This page does not reproduce every vendor Compiler implementation.
- “The Compiler handles it” is not an explanation; each decision needs an owner, timing, and observable artifact.
- Performance claims belong to [Performance Modeling and Validation](./performance-modeling.md).

## End-to-End Execution Chain

| Stage | Main decisions | Observable artifacts |
| --- | --- | --- |
| Model and framework graph | Operation semantics, Dependencies, dynamic dimensions | exported graph, Operation list, Tensor Shapes |
| Graph or portable IR | normalization, rewrites, Fusion candidates | IR and rewrite logs |
| Tensor mapping | layout, Tiling, Sharding, replication | tensor map and Sharding specification |
| Memory Planning | buffer lifetime, Reuse, and Placement | buffer plan and peak-capacity estimate |
| Kernel selection or generation | implementation, Tile, parallel granularity | Kernel IR, generated code, binary |
| Device Scheduling | Placement, order, Pipeline Overlap, synchronization | task graph and command stream |
| Runtime and instruction stream | submission, Dependencies, Events, Communication | queue, instruction stream, trace |
| Hardware execution | issue, datapath use, memory hierarchy | counters, timeline, bandwidth, Utilization |

Decisions may feed back to earlier stages. A Tile constraint can change Fusion and Memory Planning; a dynamic Tensor Shape can postpone a choice until Runtime.

## Mapping Ledger

| Field | Question |
| --- | --- |
| Inputs and outputs | Which tensors, Tensor Shapes, Data Types, and Dependencies cross this stage? |
| Decision | Which layout, Tile, Placement, or execution order was chosen? |
| Owner | Framework, Compiler, Runtime, Kernel library, or hardware? |
| Decision time | Model construction, compile, load, or every execution? |
| Constraint | Semantics, capacity, bandwidth, ISA, or topology? |
| Evidence | Which IR, log, trace, or counter verifies the decision? |
| Failure mode | What Bottleneck or correctness issue appears when the choice is wrong? |

## Common Mapping Exercise

For `MatMul → activation → residual add`, answer:

1. What are the Tensor Shapes, Data Types, broadcast rules, and Dependencies?
2. Must the intermediate result reach HBM, or can it remain on chip?
3. Does Fusion increase register or Local SRAM pressure?
4. Who selects the Tile, and how are boundary Tiles handled?
5. After multi-device Sharding, which device owns the residual and where does Communication occur?
6. What evidence appears in IR, Kernel code, and a device trace?

## Interfaces to Other Tracks

- The [Workload ledger](./model-computation-primitives.md) defines the input.
- [Architecture Comparison](./ai-accelerator-architecture-comparison.md) defines available resources and execution contracts.
- [Software Optimization](./software-optimization-methodology.md) selects the layer at which to change the mapping.
- [Model–Hardware Co-design](./model-hardware-codesign.md) handles changes to model or hardware contracts.
- [Performance Modeling](./performance-modeling.md) verifies that a mapping achieved the predicted result.

## Completion Criteria

A reader can trace one subgraph from a framework representation to hardware execution, name the owner and timing of each important decision, and verify the trace with at least one intermediate artifact and one Runtime or hardware observation.
