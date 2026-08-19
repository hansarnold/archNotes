---
title: AI Compute Full-Stack Co-design
description: A learning repository for AI compute full-stack co-design.
outline: deep
products: ["Cross-architecture"]
documentType: "Knowledge entry"
topics: ["Model computation", "Full-stack mapping", "Architecture", "Optimization", "Co-design", "Validation"]
---

# AI Compute Full-Stack Co-design

archNotes studies how model computation becomes hardware execution through a Compiler, Runtime, and Kernel stack. It also studies the reverse direction: how constraints in compute, memory, interconnects, and serving systems should change software, numerics, or model structure.

NVIDIA GPU, Groq LPU/TSP, Tenstorrent Tensix, and Google TPU are architecture case studies rather than the boundary of the curriculum.

![Four execution models for moving a Tile through an AI accelerator](../assets/images/tile-execution-models.png)

## Six Learning Tracks

| Track | Entry | Primary question |
| --- | --- | --- |
| Model Computation and Workload | [Computation Primitives and Workload](./notes/model-computation-primitives.md) | What computation, data, state, and Communication does the model create? |
| Model-to-Hardware Mapping | [End-to-End Mapping](./notes/model-to-hardware-mapping.md) | How does an Operation become real device execution? |
| Hardware Architecture | [AI Accelerator Architecture Comparison](./notes/ai-accelerator-architecture-comparison.md) | Where are resources located, and how is responsibility divided? |
| Software Optimization | [Cross-Architecture Optimization](./notes/software-optimization-methodology.md) | How can Data Movement, waiting, and waste be reduced? |
| Model–Hardware Co-design | [Co-design Framework](./notes/model-hardware-codesign.md) | When should a cross-layer contract change? |
| Performance Modeling and Validation | [Performance Model and Experiment Contract](./notes/performance-modeling.md) | How can a claim be predicted, measured, and falsified? |

## How to Read the Repository

- Start with the [Curriculum Blueprint](./curriculum.md) to understand ownership and boundaries.
- Use the [Glossary](./glossary.md) for canonical English terminology.
- Follow the six tracks with one shared Transformer block rather than learning six disconnected vocabularies.
- Treat vendor monographs as case studies that instantiate the shared framework.
- Write a prediction before running a lab or benchmark.

The Chinese locale currently contains the complete vendor monographs and teaching labs. English translations are being added as committed Markdown; the site build never generates translations.
