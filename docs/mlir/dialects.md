---
title: "MLIR Dialect 与 Progressive Lowering"
description: "理解 MLIR 为什么允许混合 Dialect，怎样划分 Graph、Tensor 与 Machine 层，并设计一个最小 AI accelerator target Dialect。"
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "教程章节"
topics: ["Dialect", "Progressive Lowering", "ODS", "Target IR"]
---

# MLIR Dialect 与 Progressive Lowering

Dialect 不是另一种文件格式，而是一组共享语义边界的 Operation、Type、Attribute 和 Interface。一个 Module 同时混合多个 Dialect 是正常状态，也是 Progressive Lowering 的基础。

## 常见 Dialect 的位置

| Dialect | 主要语义 | Lowering 位置 |
| --- | --- | --- |
| `builtin` | Module 与基础 Type | 公共容器 |
| `func` | Function 与 Call | ABI 无关的 Function 层 |
| `arith` | Scalar/Vector Arithmetic | 多层通用计算 |
| `tensor` | Value-semantics Tensor | Bufferization 之前 |
| `linalg` | Structured Operation | Tiling/Fusion/Vectorization 入口 |
| `scf` | Structured Control Flow | `for`、`if`、`while` |
| `affine` | Affine Loop 与 Access | 静态 Loop 优化 |
| `memref` | Buffer、Layout、Memory Space | 显式 Memory 阶段 |
| `vector` | Target-independent SIMD | 硬件匹配前的 Vector 层 |
| `gpu` | Kernel 与 Grid/Block/Thread | 通用 GPU 映射 |
| `nvgpu` | NVIDIA-specific 高层能力 | `gpu` 与 `nvvm` 之间 |
| `nvvm` | NVIDIA LLVM/NVPTX 语义 | 低层 Target Dialect |
| `llvm` | 接近 LLVM IR 的 MLIR Dialect | 翻译到 LLVM IR 之前 |

## Progressive Lowering 逐步增加约束

```text
linalg.matmul
  ↓ Tiling
scf.for + smaller linalg.matmul
  ↓ Bufferization
memref + explicit memory effects
  ↓ Target Mapping
target.dma + target.compute + target.barrier
  ↓ Scheduling and Encoding
target.command / executable
```

每一步都应回答：保留了什么语义，新增了什么约束，下一层允许哪些 Operation/Type？Lowering 不是把名称 A 改成名称 B，而是有控制地丢弃抽象并显式化硬件决策。

## Tensor 与 MemRef

- `tensor` 倾向 Value Semantics，适合 Functional Rewrite、Fusion 和 Shape reasoning。
- `memref` 表达 Buffer 与显式读写，需要处理 Alias、Lifetime、Layout 和 Memory Space。

Bufferization 必须决定 in-place reuse、Allocation、Copy、Function boundary ABI、Ownership 和 Deallocation。它不是一次字符串层面的 Type 替换。

## Graph、Tensor 与 Machine 三层

| 层级 | 主要决策 | 仍应保留的信息 |
| --- | --- | --- |
| Graph | Fusion、Partition、High-level Rewrite | Operator 与全局 Dataflow |
| Tensor | Tiling、Layout、Bufferization、Memory Planning | Structured computation 与 Data reuse |
| Machine | Engine、DMA、Barrier、ISA、Schedule | 可编码的 Resource/Timing contract |

Hardware specialization 越强，Compiler 往往承担越多 WHAT、WHERE、HOW、WHEN、WHERE DATA 和 HOW MOVE 决策。

## 何时需要 Target Dialect

假设一个 BPU 有 Matrix、Vector 和 DMA Engine。把所有目标细节作为 `linalg` Attribute 会污染通用层，也无法为 Codegen/Simulator 提供稳定 contract。一个较清晰的边界可能是：

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

新建 Dialect 的信号包括：语义稳定、由多个 Pass 或工具消费、需要 Verifier、自定义 Type/Attribute，或者代表清晰的 abstraction boundary。

## 从语义表开始设计

以 `minibpu.dma_start` 为例：

| 项目 | 需要回答的问题 |
| --- | --- |
| Operands | Source/Destination Buffer、动态 Offset/Size？ |
| Results | 是否产生 `!minibpu.event`？ |
| Attributes | Direction、Channel、Burst Size？ |
| Effects | 读 Source、写 Destination，是否异步？ |
| Verifier | Memory Space、Alignment、Size 是否合法？ |
| Consumer | Command Encoder、Runtime 还是 Simulator？ |
| Failure | Diagnose、Decompose 还是 Fallback？ |

先稳定这张表，再写 ODS。

## ODS 草图

```tablegen
include "mlir/IR/OpBase.td"

def MiniBPU_Dialect : Dialect {
  let name = "minibpu";
  let cppNamespace = "::mlir::minibpu";
}

class MiniBPU_Op<string mnemonic, list<Trait> traits = []>
    : Op<MiniBPU_Dialect, mnemonic, traits>;

def MiniBPU_MatmulTileOp
    : MiniBPU_Op<"matmul_tile", [NoMemoryEffect]> {
  let arguments = (ins AnyType:$lhs, AnyType:$rhs, AnyType:$acc,
                       I64ArrayAttr:$tile_shape);
  let results = (outs AnyType:$result);
}
```

这是教学骨架。真实 Operation 需要更精确的 Type constraint、Layout、Shape relation、Memory effect 和 Verifier。

## Verifier 与 Cost Model 分工

Verifier 判断一个 IR 是否合法，例如 dtype、Tile 粒度、Layout、Alignment 和 SRAM 上限。Cost Model 判断合法方案中哪个更好。一个很小的 MatMul 可能在 Matrix Engine 上合法，但 DMA/Setup Cost 使 CPU 或 Vector Engine 更快。

## Trait 与 Interface

- Trait 表示可复用性质，例如 Pure、Commutative 或 Terminator contract。
- Interface 为多类 Operation 提供统一能力，例如 Memory Effect、Tiling、Scheduling 或 Target Serialization。

如果下游需要对多种 Operation 做相同查询，优先考虑 Interface，不要散落字符串名称判断。

## 实现顺序

1. 让 Generic form 能 Parse/Print。
2. 写 Verifier 与 Round-trip test。
3. 稳定语义、Type 和字段。
4. 再增加 Custom assembly form。

## 延伸阅读

- [Creating a Dialect](https://mlir.llvm.org/docs/Tutorials/CreatingADialect/)
- [Operation Definition Specification](https://mlir.llvm.org/docs/DefiningDialects/Operations/)
- [Bufferization](https://mlir.llvm.org/docs/Bufferization/)
