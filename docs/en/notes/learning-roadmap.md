---
title: AI Accelerator Architecture Learning Roadmap
description: A reading sequence from shared concepts through four accelerator architectures, software, systems, and experiments.
outline: deep
products: ["Cross-architecture"]
documentType: "Learning guide"
topics: ["Learning path", "Research method"]
---

# AI Accelerator Architecture Learning Roadmap

This roadmap gives a reading sequence. The [Curriculum](../curriculum.md) owns track scope, the [Architecture Comparison](./ai-accelerator-architecture-comparison.md) owns the shared comparison model, and the [Glossary](../glossary.md) owns terminology.

## Choose a Direction

**Only two days available?** Start with the [12-hour AI Compiler + C++ route](../mlir/bootcamp.md), explaining one MatMul and completing repair, IR, and tile exercises. The multi-architecture material below is subsequent reference, not additional required reading for those two days.

- **Model downward:** Model Computation and Workload → graph and IR → Compiler, Runtime, and Kernel → Hardware Mapping → Performance Validation.
- **Hardware upward:** compute, memory, and interconnect → programming contract → Software Optimization → Model–Hardware Co-design.
- **End-to-end case:** use one Transformer block to connect both directions with one vocabulary.

## Read the Six Tracks in Order

1. [Model Computation and Workload](./model-computation-primitives.md): decompose a model into Operations, Tensors, state, and Communication.
2. [Model-to-Hardware Mapping](./model-to-hardware-mapping.md): trace graphs, IR, Kernels, Runtime, and device execution.
3. [Hardware Architecture](./ai-accelerator-architecture-comparison.md): compare resources, Execution Models, and software contracts.
4. [Software Optimization](./software-optimization-methodology.md): choose the optimization layer from the observed Bottleneck.
5. [Model–Hardware Co-design](./model-hardware-codesign.md): decide when a model, numerical, or hardware contract should change.
6. [Performance Modeling and Validation](./performance-modeling.md): close the evidence loop with shared units, predictions, and experiments.

Completion means producing six linked ledgers for one Transformer block: Workload, Mapping, architecture constraints, Software Optimization, Co-design decisions, and validation.

## Study the Four Architectures

1. [NVIDIA GPU](./nvidia-gpu-synchronization.md): Dynamic Scheduling, Shared Memory, async Pipelines, and Completion contracts.
2. [Groq TSP](./architecture.md): Functional Slicing, streams, and deterministic time-space Scheduling.
3. [Tenstorrent Tensix](./tenstorrent-architecture.md): Local SRAM, reader/compute/writer Kernels, Circular Buffers, and NoC.
4. [Google TPU](./google-tpu-architecture.md): MXU Systolic Wavefronts, VMEM/HBM, XLA/PJRT, and ICI Pods.

## Observe Mechanisms in Labs

| Lab | Question |
| --- | --- |
| [Static Time-Space Scheduling](../labs/static_scheduler.md) | How do Dependencies, resource conflicts, and transport delays determine makespan? |
| [Tensix Pipeline and Backpressure](../labs/tensix_pipeline.md) | How do Circular Buffer capacity and stage balance affect throughput? |
| [Systolic Array Wavefront](../labs/systolic_array.md) | How do fill, drain, and partial Tiles affect Utilization? |

Before running a lab, change one input and predict the direction of the result. The simulator output should test that prediction rather than replace it.
