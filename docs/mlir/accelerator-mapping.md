---
title: "MLIR 与 AI Accelerator 映射"
description: "从硬件 Contract 出发，系统分析 MatMul 的 Engine selection、Tiling、Layout、Memory Planning、DMA Schedule 与 Performance Model。"
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "Backend 专题"
topics: ["硬件映射", "Tiling", "Memory Planning", "DMA", "性能模型"]
---

# MLIR 与 AI Accelerator 映射

一个 MatMul 的 Backend 工作远不止“换成硬件指令”。Compiler 必须把计算、存储、数据移动、同步和资源调度组织成一个可执行的计划。

## 先建立 Hardware Contract

面对新 Accelerator，先问清楚：

- 有哪些 Compute Engine，分别支持哪些 dtype 和 tile shape？
- Memory hierarchy 的容量、带宽、Alignment、Bank 和 Layout 约束是什么？
- DMA 支持哪些方向、Stride、Transpose 和并发 Channel？
- Engine 之间如何同步，Event/Barrier 有什么数量和成本限制？
- Instruction 是同步执行、异步提交还是进入 Command Queue？
- 哪些决策由 Runtime 完成，哪些必须静态确定？

这些答案决定 Target Dialect 应提供什么 Operation、Type、Attribute 与 Interface。

## MatMul Mapping 的六步

### 1. Operator Selection

先确定完整语义：Transpose、Batch、Broadcast、Bias、Activation、Quantization 和 Accumulator type。只看到 `matmul` 名称而忽略 Epilogue 和 Layout，容易选错实现。

### 2. Tile Selection

```text
for m0 in tiles(M):
  for n0 in tiles(N):
    acc = 0
    for k0 in tiles(K):
      acc += A[m0, k0] × B[k0, n0]
```

Tile 必须同时满足 Matrix Engine 粒度、Tail handling、Parallelism 和 On-chip memory 容量。

### 3. Layout Selection

Layout 把 Logical Tensor 映射到 Physical Storage。需要检查：

- Matrix Engine 需要的 Packing 或 Swizzle；
- DMA 能否直接产生该 Layout；
- 前后相邻 Operation 的 Layout compatibility；
- 额外 Layout transform 的 Traffic 与 Latency。

单个 Operation 最快的 Layout 不一定使整个 Graph 最快。

### 4. Memory Planning

一个 Tile 的 Working Set 至少包括：

```text
bytes(A_tile) + bytes(B_tile) + bytes(C_tile)
+ double-buffer copies
+ padding / alignment / temporary buffers
≤ usable SRAM
```

可用 SRAM 小于理论总容量，因为其他并发任务、Metadata、Bank 与 Alignment 也需要空间。Memory Planner 还要做 Lifetime analysis、Buffer reuse 和 Spill 决策。

### 5. DMA 与 Compute Schedule

```text
time ─────────────────────────────────→

DMA:      load A0/B0 | load A1/B1 | load A2/B2
Matrix:                compute 0  | compute 1  | compute 2
Store:                             | store C0  | store C1
```

Double Buffering 可以隐藏部分 Transfer latency，但会增加 SRAM 占用和同步复杂度。真正的 Schedule 还需要表达 Dependency、Channel contention、Barrier 和 Buffer ownership。

### 6. Codegen 与 Simulation

```text
scheduled target IR
      ├─ Encoder / Runtime → Executable
      └─ Simulator         → Cycles / Utilization / Stalls
```

Compiler 与 Simulator 共享稳定的 Target IR contract，才能区分 Mapping 问题与 Performance Model 偏差。

## Roofline 是第一层筛选

```text
T_compute ≈ Operations / Effective Throughput
T_memory  ≈ Bytes / Effective Bandwidth
```

充分 Overlap 时：

```text
T ≈ max(T_compute, T_memory)
```

不能 Overlap 时需要加和，并进一步考虑 Setup、Dependency stall、Synchronization 和 Resource contention。

Arithmetic Intensity：

```text
AI = Operations / Bytes Transferred
```

Roofline 能快速判断 Compute-bound 或 Memory-bound，但不会自动建模 DMA setup、Bank conflict、Tail loss 和 Engine dependency。

## 不能只做局部最优

```text
Implementation A
MatMul: 1.0 ms
Layout transform: 0.7 ms
Total: 1.7 ms

Implementation B
MatMul: 1.2 ms
Reuse upstream layout: 0 ms
Total: 1.2 ms
```

Cost Model 需要考虑 Graph 范围内的 Layout compatibility、Intermediate traffic、Fusion opportunity 和 Engine overlap，而不只是单个 Operation latency。

## Quantization 的 Backend Contract

```text
x ≈ scale × (q - zero_point)
q = clamp(round(x / scale) + zero_point)
```

典型路径：

```text
INT8 × INT8
  → INT32 accumulator
  → Requantize + Clamp
  → INT8
```

Compiler 必须对齐 Scale、Zero Point、Accumulator type、Rounding、Saturation 与 Target instruction semantics。带 Rounding/Saturation 的计算不能随意重排。

## Simulator 的三个层级

- Functional Simulator 验证结果是否正确。
- Performance Simulator 估算 Latency、Cycles、Utilization 和 Bottleneck。
- Cycle-accurate Simulator 尽可能逐 Cycle 建模 Pipeline 与 Resource contention。

一个可解释的 Performance Simulator 至少包含：

```text
Operation or Command Trace
  → Dependency DAG
  → Engine Queues and Event Scheduler
  → Latency / Throughput / Bandwidth / Contention
  → Cycles / Utilization / Stall Breakdown
```

模型必须用 Microbenchmark 和 Silicon measurement 校准，并记录预测误差。

## 面试回答顺序

1. 明确 Operation semantics、Shape、dtype 和 Layout。
2. 检查 Target legality 与 Fallback。
3. 选择 Engine 和 Implementation。
4. 根据 Compute tile 与 SRAM 做 Tiling。
5. 规划 Buffer Lifetime、Placement 和 Reuse。
6. 插入 DMA、Event/Barrier 和 Double Buffering。
7. 生成 Target IR/ISA，并用 Simulator 与 Microbenchmark 验证。
8. 比较 End-to-end Cost，而不是局部峰值。

## 练习

对一个 `64×64 × 64×64` MatMul 写两套方案：Matrix Engine 的 16×16×16 Tile 与低 Setup Cost 的 Fallback。分别列出 Legality、Memory traffic、Synchronization 和适用 Shape，不编造未知的具体 Latency。
