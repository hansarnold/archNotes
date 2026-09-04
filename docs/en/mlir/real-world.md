---
title: "MLIR in Real Projects"
description: "Understand where MLIR sits in real AI compilers through Triton, IREE, StableHLO, and a comparison with TileLang, then map the lessons to a BPU backend."
outline: deep
products: ["MLIR", "Triton", "IREE", "TileLang"]
documentType: "Scenario Primer"
topics: ["Real Projects", "Compiler Pipeline", "Kernel DSL", "BPU Backend", "Lowering"]
---

# MLIR in Real Projects: Triton, IREE, and TileLang

Starting with Operation, Dialect, and PatternRewriter often leaves a learner knowing the vocabulary but not why the abstractions exist.

Use this mental model first: **MLIR is neither a complete AI compiler nor one fixed IR format. It is infrastructure for building a compiler with several levels of representation.** Each project chooses its own dialects, passes, and runtime boundary so that a program becomes progressively more specific to its target.

::: info The short answer
- **Triton does use MLIR.** Its compiler represents kernel semantics, GPU layouts, and target lowering through multiple MLIR dialects.
- **TileLang is not currently an MLIR project.** Its documentation defines kernels as TVM TIR functions. It remains an excellent comparison because it exposes the same tiling, memory, pipeline, and hardware-mapping decisions.
:::

## Why a BPU MatMul needs multiple IR levels

Suppose a backend must support an INT8 MatMul. The model contains one mathematical operation, but the compiler must answer questions at several very different levels:

```text
PyTorch or JAX model       What should be computed?
  → StableHLO or Torch IR  Which shapes, types, and operator semantics?
  → Linalg and Tensor IR   Which iteration space and reuse pattern?
  → SCF, Vector, MemRef    Which loops, vectors, and buffers?
  → BPU target dialect     Which DMA, SRAM, engine, and barrier?
  → ISA and runtime        Which commands will the device execute?
```

With only one IR, frontend meaning, optimization choices, and device restrictions become entangled. A layout change can accidentally violate DMA constraints, while a new hardware revision can leak into every high-level optimization. MLIR lets a project keep those levels separate and validate the contract at each boundary.

| Level | Information retained | Typical failure signal |
| --- | --- | --- |
| Operator semantics | Shape, dtype, broadcasting, numerical behavior | Wrong results or unresolved dynamic shapes |
| Structured compute | Iteration spaces, reductions, reuse opportunities | Correct algorithm, but no useful tiles |
| Schedule and memory | Loop order, buffers, layouts, copies | SRAM overflow, bank conflicts, DMA stalls |
| Target contract | Engines, barriers, legal tiles, address spaces | IR cannot be legalized to device operations |
| Instructions and runtime | Command stream, binary, launch ABI | Simulator or hardware rejects the program |

Every arrow is a testable transformation boundary, not a single opaque translation step.

## What a real backend task looks like

Continue with “add INT8 MatMul to a BPU.” A compiler engineer normally moves through the following work rather than emitting assembly immediately.

### 1. Receive the upstream semantics

First define the input contract: whether dynamic shapes are accepted, whether quantization is per-tensor or per-channel, which accumulator type is required, and whether bias or activation is fused.

This stage may use StableHLO, Torch, or a project-specific graph/tensor dialect. A dialect is not merely syntax here; it specifies the set of programs that are legal at this boundary.

### 2. Expose a mappable computation

MatMul is normalized into explicit iteration and reduction spaces. The compiler then selects an `M × N × K` tile from SRAM capacity and compute-array geometry.

Tiling, rewriting, and transform mechanisms exist to turn the mathematical operation into work that the device can process block by block while preserving equivalence.

### 3. Give values a physical home

A tensor cannot remain an abstract value forever. The backend decides what belongs in global memory, SRAM, and registers, when buffers are allocated, and which layout satisfies vector lanes or a systolic array.

Bufferization, MemRef, address spaces, and layout attributes all answer one practical question: “In what physical form does this value exist?”

### 4. Make DMA and synchronization explicit

To hide memory latency, the compiler may double-buffer: while the engine computes tile 0, DMA prefetches tile 1. Dependencies, barriers, or events must then be inserted correctly.

If a target dialect contains operations such as `bpu.dma_async`, `bpu.matmul`, and `bpu.barrier`, those operations form a shared compiler/hardware contract. A verifier can reject SRAM overflow, bad alignment, or missing synchronization before command encoding.

### 5. Produce device commands and evidence

Instruction selection, command encoding, the runtime ABI, and simulator/device execution come last. Important passes need input/output examples, negative tests, and measurable performance evidence.

::: tip Translate the vocabulary into engineering roles
A `Dialect` is a boundary contract, a `Pass` is a bulk transformation, a `Rewrite Pattern` is a local equivalence rule, `Dialect Conversion` is a legality-checked migration, and a `Verifier` catches invalid states early.
:::

## Which projects actually use MLIR?

| Project | MLIR-based? | Main problem | Best lesson to extract |
| --- | --- | --- | --- |
| **Triton** | Yes | Compile a Python kernel DSL to NVIDIA, AMD, and other backends | Custom dialects, layouts, GPU target lowering, kernel autotuning |
| **IREE** | Yes | Compile, deploy, and execute ML models across devices | End-to-end pipelines, async scheduling, HAL/runtime boundaries |
| **StableHLO / OpenXLA** | Yes; StableHLO is an MLIR-based representation | Provide a portable and versioned contract between frameworks and compilers | Compatibility, serialization, frontend/backend contracts |
| **Torch-MLIR** | Yes | Import PyTorch programs into the Torch dialect and MLIR ecosystem | Frontend import, semantic fidelity, progressive lowering |
| **CIRCT** | Yes | Apply the MLIR/LLVM approach to hardware design tools | Dialects for hierarchy, timing, and dataflow |
| **TileLang** | No; currently built on TVM TIR | Express high-performance GPU and accelerator kernels with a tile-centric DSL | Explicit tiles, memory, pipelines, and schedule design |

Whether a project selected MLIR is separate from whether it teaches useful compiler ideas. MLIR is an infrastructure choice; layout, memory hierarchy, synchronization, and tiling are domain problems shared by accelerator compilers.

## Triton: MLIR underneath a kernel DSL

Triton presents a Python-style kernel language to its users and a layered representation to its compiler. A representative—not version-locked—view is:

```text
Python kernel
  → kernel semantics
  → blocked computation and GPU layout
  → target-specific GPU operations
  → LLVM and device code
```

Current Triton source and debug output use names such as TTIR and TritonGPU IR; exact intermediate passes differ by backend and release. The durable lesson is to track how information changes:

- Early stages retain pointer arithmetic, masks, program instances, and other kernel semantics.
- GPU-oriented stages introduce thread/warp/CTA layouts and data distribution.
- Target stages select concrete memory, matrix-instruction, and synchronization forms.

The same separation is useful for a BPU: one level can say which tile to compute, while the next assigns it to an engine, an SRAM region, and a device instruction. One operation does not need to carry every decision.

Triton also exposes `MLIR_ENABLE_DUMP=1` for dumping IR before MLIR passes and an MLIR reproducer mechanism. Following the transformations of one real kernel usually builds intuition faster than writing a new pass immediately.

## TileLang: relevant even though it is not MLIR

TileLang's official language guide defines a kernel as a **TIR function** created by `@T.prim_func`; TIR is part of TVM, not MLIR.

It still addresses many of the same optimization choices as Triton through different compiler infrastructure:

| Dimension | Triton | TileLang |
| --- | --- | --- |
| Foundation | MLIR-based Triton compiler | TVM TIR |
| User interface | Python kernel DSL | Python tile-centric DSL |
| Primary focus | Program instances, layouts, GPU lowering | Tile operations, memory scopes, pipelines, schedules |
| BPU lesson | Layer custom dialects and target lowering | Decide which scheduling choices users should express |

TileLang raises a useful product question: should a tiling or pipeline decision be inferred by the compiler, or exposed to the kernel author? That decision shapes a dialect or DSL design regardless of the underlying IR framework.

## IREE: MLIR beyond kernel code generation

Triton emphasizes making a kernel fast. IREE demonstrates how a model becomes a deployable program. Its documented internal pipeline includes this important sequence:

```text
Flow → Stream → HAL
```

- **Flow** forms dispatch regions and represents high-level tensor dataflow.
- **Stream** converts tensor programs into explicitly scheduled asynchronous programs with resources, concurrency, and affinity.
- **HAL** maps execution onto a concrete device/runtime interface.

This resembles a common BPU stack: graph partitioning → command scheduling → device abstraction. Kernel lowering is only one piece; a full compiler also owns dispatch boundaries, resource lifetimes, asynchronous execution, and the runtime contract.

## Three meanings hidden inside “lowering”

Calling every arrow “lowering” makes design and debugging discussions ambiguous. Separate the work into three categories:

1. **Semantic lowering:** Translate framework operators into more general and explicit computation semantics, such as Torch or StableHLO into structured operations.
2. **Scheduling lowering:** Choose tiles, loop order, parallelism, layouts, buffers, and data movement.
3. **Encoding and code generation:** Convert legal target operations into ISA, binaries, and runtime commands.

A pass may cross two categories, but a design note should still state which abstraction it removes and which constraint it introduces.

## A project-oriented learning route

For an AI accelerator or BPU backend goal, combine real systems with this tutorial in the following order:

1. **Start here and with IREE** to see the complete model–kernel–schedule–runtime picture.
2. **Study Triton next** to see how a kernel DSL represents layouts and target mapping through layered IR.
3. **Use TileLang as a comparison** for which tile, memory, and pipeline choices are explicit versus inferred.
4. **Return to hands-on MLIR** for Operation, Dialect, Rewrite, Conversion, and the MiniBPU MatMul slice.

### First observation exercise

Choose a small Triton vector-add or softmax kernel:

1. Set `MLIR_ENABLE_DUMP=1` and compile the kernel once.
2. Do not try to understand every line. Record only which dialects or operations appear and disappear at each dump.
3. Locate where layout, memory access, and target-specific operations first become explicit.
4. Draw those three boundaries, then compare them with [Dialects](./dialects.md), [Dialect Conversion](./dialect-conversion.md), and [Accelerator Mapping](./accelerator-mapping.md).

Dump names vary across Triton releases and targets. The objective is to practice finding where information enters the pipeline, not to reproduce one frozen output.

## Official starting points

- [Triton development repository](https://github.com/triton-lang/triton) for project scope, builds, and MLIR debugging controls.
- [Official MLIR users directory](https://mlir.llvm.org/users/) for Triton, IREE, Torch-MLIR, CIRCT, and other production users.
- [IREE developer overview](https://iree.dev/developers/general/developer-overview/) and [Stream dialect reference](https://iree.dev/reference/mlir-dialects/Stream/) for the deployment pipeline and asynchronous scheduling.
- [StableHLO source repository](https://github.com/openxla/stablehlo) for a portable MLIR-based operation set between frameworks and compilers.
- [TileLang programming guide](https://github.com/tile-ai/tilelang/blob/main/docs/programming_guides/language_basics.md) for the official `@T.prim_func` and TIR definition.

Continue with [IR Foundations and Tools](./ir-foundations.md) and map the engineering questions on this page to concrete MLIR structures.
