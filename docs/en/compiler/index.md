---
title: "AI Compiler"
description: Connect models, IR, kernels, and hardware in a two-day concept route, then enter the separate MLIR implementation track.
outline: deep
products: ["AI Compiler"]
documentType: "Section entry"
topics: ["Compiler Pipeline", "Learning Route", "MLIR"]
---

# AI Compiler

How does a model's computation become an executable, verifiable device program? Understand the general problem before choosing an implementation technology.

## Concept route: connect the layers

The [two-day AI Compiler route](../mlir/bootcamp.md) follows one MatMul through model, IR, kernel, runtime, and hardware. Eight core hours need no GPU or complete LLVM build.

1. [Model to kernel](../mlir/model-to-kernel.md): each layer's inputs, outputs, and responsibilities.
2. [Read an IR change](../mlir/ir-reading.md): observe a transformation through a small MLIR example.
3. [Tiles, memory, performance](../mlir/mapping-lab.md): movement, resource constraints, and numerics.
4. [Compare real projects](../mlir/real-world.md): the roles of Triton, TileLang, and IREE.
5. [Discussion and exit check](../mlir/discussion.md): explain decisions, trade-offs, and verification.

## MLIR track: learn one implementation technology

[Open the MLIR track](../mlir/index.md) for operations, regions, blocks, dialects, passes, rewriting, conversion, and lowering. MLIR is an implementation track within AI compilers, not the entire field.

Start here if you can already explain graph, IR, and kernel responsibilities. Otherwise take the concept route first. Inside the track, the sidebar lists only MLIR chapters.

## References, not mandatory prerequisite courses

- To inspect device constraints, use [hardware architecture](../architecture/index.md).
- To recover language details while reading source, use [C++ review](../cpp/index.md). Language review remains independent instead of interrupting the compiler reading order.
