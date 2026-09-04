---
title: "MLIR Dialects and Progressive Lowering"
description: "Understand mixed-dialect IR, separate Graph, Tensor, and Machine decisions, and design a minimal AI accelerator target dialect."
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "Tutorial Chapter"
topics: ["Dialect", "Progressive Lowering", "ODS", "Target IR"]
---

# MLIR Dialects and Progressive Lowering

A Dialect is not a separate file format. It is a namespace and semantic boundary for related Operations, Types, Attributes, and Interfaces. Mixing Dialects in one Module is normal and enables progressive lowering.

## Where common Dialects fit

| Dialect | Main semantics | Place in lowering |
| --- | --- | --- |
| `builtin` | Module and fundamental Types | Common containers |
| `func` | Functions and calls | ABI-independent function layer |
| `arith` | Scalar and vector arithmetic | Shared computation across layers |
| `tensor` | Value-semantics tensors | Before bufferization |
| `linalg` | Structured Operations | Entry point for tiling, fusion, and vectorization |
| `scf` | Structured control flow | `for`, `if`, and `while` |
| `affine` | Affine loops and accesses | Static loop optimization |
| `memref` | Buffers, layouts, and memory spaces | Explicit memory layer |
| `vector` | Target-independent SIMD | Before target vector matching |
| `gpu` | Kernels and grid/block/thread structure | Generic GPU mapping |
| `nvgpu` | NVIDIA-specific higher-level capabilities | Between `gpu` and `nvvm` |
| `nvvm` | NVIDIA LLVM and NVPTX semantics | Low-level target dialect |
| `llvm` | MLIR model close to LLVM IR | Before LLVM IR translation |

## Progressive lowering adds constraints

```text
linalg.matmul              English walkthrough
  ↓ Tiling
scf.for + smaller linalg.matmul
  ↓ Bufferization
memref + explicit memory effects
  ↓ Target Mapping
target.dma + target.compute + target.barrier
  ↓ Scheduling and Encoding
target.command / executable
```

At every step, ask what semantics remain, what constraints became explicit, and which Operations and Types are legal at the next boundary. Lowering is controlled loss of abstraction, not a textual rename.

## Tensor and MemRef

- `tensor` favors value semantics for functional rewrites, fusion, and shape reasoning.
- `memref` represents buffers and explicit reads and writes, including aliasing, lifetime, layout, and memory space.

Bufferization decides in-place reuse, allocation, copies, function-boundary ABI, ownership, and deallocation. It is not a mechanical Type substitution.

## Graph, Tensor, and Machine layers

| Layer | Main decisions | Information that should remain visible |
| --- | --- | --- |
| Graph | Fusion, partitioning, high-level rewrites | Operators and global dataflow |
| Tensor | Tiling, layout, bufferization, memory planning | Structured computation and reuse |
| Machine | Engines, DMA, barriers, ISA, scheduling | Encodable resource and timing contracts |

As hardware becomes more specialized, the compiler generally makes more decisions about what executes, where and how it executes, when it executes, where data lives, and how data moves.

## When a target Dialect helps

Assume a BPU has Matrix, Vector, and DMA Engines. Encoding every target decision as a `linalg` Attribute pollutes the generic layer and fails to provide a stable contract for code generation and simulation. A clearer boundary is:

```text
linalg / tensor
  ↓ Target selection and tiling
minibpu.matmul_tile
minibpu.vector
minibpu.dma_start
minibpu.wait
  ↓ Scheduling and encoding
minibpu.command_buffer
```

A new Dialect is justified when semantics are stable, several passes or tools consume them, a Verifier or custom Type is needed, or the IR represents a clear abstraction boundary.

## Start with a semantics table

For `minibpu.dma_start`, define the contract before writing ODS:

| Field | Design question |
| --- | --- |
| Operands | Source and destination buffers, dynamic offsets, and sizes? |
| Results | Should the Operation produce `!minibpu.event`? |
| Attributes | Direction, channel, and burst size? |
| Effects | Reads source, writes destination, and runs asynchronously? |
| Verifier | Which memory spaces, alignments, and sizes are legal? |
| Consumer | Command encoder, runtime, or simulator? |
| Failure | Diagnose, decompose, or fall back? |

## ODS sketch

```tablegen
include "mlir/IR/OpBase.td"

def MiniBPU_Dialect : Dialect {
  let name = "minibpu";
  let cppNamespace = "::mlir::minibpu";
}

class MiniBPU_Op<string mnemonic, list<Trait> traits = []>
    : Op<MiniBPU_Dialect, mnemonic, traits>;

// Minimal target operation used by this tutorial.
def MiniBPU_MatmulTileOp
    : MiniBPU_Op<"matmul_tile", [NoMemoryEffect]> {
  let arguments = (ins AnyType:$lhs, AnyType:$rhs, AnyType:$acc,
                       I64ArrayAttr:$tile_shape);
  let results = (outs AnyType:$result);
}
```

This is a teaching scaffold. Production Operations need precise Type constraints, layouts, shape relations, memory effects, and verification.

## Verifier versus Cost Model

A Verifier rejects illegal dtype, tile granularity, layout, alignment, or SRAM usage. A Cost Model chooses among legal alternatives. A small MatMul may be legal on a Matrix Engine while losing to another implementation because of setup and DMA overhead.

## Trait and Interface

- A Trait expresses a reusable property such as purity, commutativity, or a terminator contract.
- An Interface exposes common behavior across multiple Operation classes, such as memory effects, tiling, scheduling, or target serialization.

Use an Interface when downstream consumers need the same query across several Operations. Avoid scattered string comparisons against operation names.

## Implementation order

1. Parse and print Generic form.
2. Add Verifier and round-trip tests.
3. Stabilize semantics, Types, and fields.
4. Add a custom assembly form last.

## Further reading

- [MLIR tutorial: Creating a Dialect](https://mlir.llvm.org/docs/Tutorials/CreatingADialect/)
- [MLIR reference: Operation Definition Specification](https://mlir.llvm.org/docs/DefiningDialects/Operations/)
- [MLIR reference: Bufferization](https://mlir.llvm.org/docs/Bufferization/)
