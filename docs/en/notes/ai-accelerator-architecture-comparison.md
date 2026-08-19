---
title: AI Accelerator Architecture Comparison
description: A shared coordinate system for NVIDIA GPU, Groq TSP, Tenstorrent Tensix, and Google TPU.
outline: deep
products: ["NVIDIA GPU", "Groq TSP", "Tenstorrent Tensix", "Google TPU"]
documentType: "Architecture comparison"
topics: ["Compute organization", "Scheduling", "Memory hierarchy", "Interconnect", "Software contract"]
---

# AI Accelerator Architecture Comparison

This page compares architecture responsibility rather than peak specification. Every claim must keep the Workload, Data Type, Tensor Shape, software version, topology, generation, and system boundary fixed.

## Shared Questions

1. Where does compute occur?
2. Which memory level feeds it?
3. Who chooses the next Operation?
4. How does a Tile move through the system?
5. How are waiting and Latency covered?
6. What proves Completion and memory visibility?
7. Which decisions belong to the Compiler, Runtime, Kernel, or hardware?
8. How does the execution contract extend across chips?

## Responsibility Matrix

| Dimension | NVIDIA GPU | Groq TSP | Tenstorrent Tensix | Google TPU |
| --- | --- | --- | --- | --- |
| Primary execution style | dynamic SIMT | statically planned spatial pipeline | programmable Dataflow across cores | Compiler-scheduled tensor program with Systolic Array compute |
| Main compute organization | SM, Warp, Tensor Core | Functional Slices | Tensix Cores with tensor/vector compute | TensorCore with MXU and vector units |
| Scheduling center | hardware Warp schedulers plus software launch | Compiler-planned time and Placement | software Dataflow graph plus local processors | XLA program, Runtime, and device execution |
| Local data supply | register, Shared Memory, Cache | Compiler-orchestrated streams and on-chip storage | Local SRAM and Circular Buffers | VMEM and MXU feed paths |
| Latency strategy | Occupancy and Dynamic Scheduling | deterministic Static Scheduling | explicit Pipeline Overlap and buffering | Tiling, Systolic Wavefronts, and Compiler Scheduling |
| On-chip Communication | SM-local paths and chip fabric | planned transport across slices | NoC mesh | on-chip interconnect around TensorCore resources |
| Multi-chip path | NVLink/NVSwitch and network stack | system interconnect and compiled partitioning | mesh/fabric plus software Placement | ICI and Pod-level collectives |
| Software contract | CUDA ecosystem, Compiler, Runtime, Kernels | static program construction | explicit cores, Kernels, buffers, and NoC | XLA, PJRT, and target-specific Kernels |

## Interpretation Rules

- Similar terms do not imply equivalent hardware levels.
- Static Scheduling does not mean there is no Runtime.
- A software-managed Scratchpad is not a transparent Cache.
- Deterministic execution does not automatically imply lower end-to-end Latency.
- Peak compute is not meaningful without Data Movement, Utilization, and quality boundaries.
- Multi-chip scaling depends on Sharding, Collective Communication, topology, and Load Imbalance.

## Mapping Exercise

Map the same Transformer block to all four systems. For each stage, record the Operation, Tile, storage level, Scheduling owner, Data Movement path, synchronization object, and observable evidence. The goal is not to choose a universal winner; it is to identify which responsibility moves between software and hardware.

## Connection to the Curriculum

- [Model Computation Primitives](./model-computation-primitives.md) defines the shared Workload.
- [Model-to-Hardware Mapping](./model-to-hardware-mapping.md) supplies the execution-chain template.
- [Software Optimization](./software-optimization-methodology.md) evaluates architecture-specific mappings without changing model semantics.
- [Model–Hardware Co-design](./model-hardware-codesign.md) evaluates changes to cross-layer contracts.
- [Performance Modeling](./performance-modeling.md) turns architecture claims into predictions and evidence.

## Completion Criteria

A comparison is complete only when it uses the same Workload and metrics, identifies the Scheduling and data-ownership contract for each architecture, preserves generation and software boundaries, and states which conclusions are observed, documented, or inferred.
