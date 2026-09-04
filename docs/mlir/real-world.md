---
title: "真实项目中的 MLIR"
description: "从 Triton、IREE、StableHLO 与 TileLang 理解 MLIR 在真实 AI Compiler 中的位置，并把这些经验映射到 BPU backend。"
outline: deep
products: ["MLIR", "Triton", "IREE", "TileLang"]
documentType: "场景导读"
topics: ["真实项目", "Compiler Pipeline", "Kernel DSL", "BPU Backend", "Lowering"]
---

# 真实项目中的 MLIR：从 Triton、IREE 到 TileLang

如果一上来就学习 Operation、Dialect 和 PatternRewriter，很容易知道每个名词，却不知道它们为什么存在。

先建立一个更实用的认识：**MLIR 不是一个完整的 AI Compiler，也不是一种固定格式。它是一套用来搭建多层编译器的基础设施。** 真实项目会选择不同的 Dialect、Pass 和 Runtime，把同一个程序逐步改写成越来越贴近目标硬件的形式。

::: info 先回答最容易混淆的问题
- **Triton 确实使用 MLIR。** 它的编译器用多层 MLIR Dialect 表达 kernel 语义、GPU layout 与 target lowering。
- **TileLang 当前不是 MLIR 项目。** 官方文档说明它的 kernel 是 TVM 的 TIR function。它仍然很值得对照学习，因为它解决的也是 tile、memory、pipeline 和硬件映射问题。
:::

## 从一个 BPU MatMul 看懂多层 IR

假设你要给一块 BPU 支持 INT8 MatMul。用户只写了矩阵乘法，但 backend 必须回答完全不同层次的问题：

```text
PyTorch / JAX model          用户要算什么？
  → StableHLO / Torch IR     shape、dtype、算子语义是什么？
  → Linalg / Tensor IR       迭代空间与数据复用是什么？
  → SCF / Vector / MemRef    loop、vector、buffer 如何组织？
  → BPU target dialect       DMA、SRAM、compute engine 如何协作？
  → ISA + runtime commands   设备最终执行哪些指令？
```

如果只有一层 IR，前端语义、优化计划和设备细节会挤在一起：改一个 tensor layout 可能破坏 DMA 约束，换一个硬件版本又可能污染所有高层优化。MLIR 的价值是允许项目保留这些层次，并为每一层定义独立的合法性和验证规则。

| 层次 | 它保留的信息 | 典型失败表现 |
| --- | --- | --- |
| 算子语义 | shape、dtype、broadcast、数值行为 | 结果错误或 dynamic shape 无法推导 |
| 结构化计算 | iteration space、reduction、tiling 机会 | 算法正确，但没有形成可复用的 tile |
| 调度与内存 | loop order、buffer、layout、copy | SRAM 超限、bank conflict、DMA 等待 |
| Target contract | engine、barrier、合法 tile 与地址空间 | IR 无法 legalize 到设备操作 |
| 指令与 Runtime | command stream、binary、launch ABI | simulator 或设备拒绝执行 |

这里的箭头不是一次“翻译完成”，而是一串可以检查、测试、回退定位的变换边界。

## 一次真实 backend 任务会怎样推进

继续用“为 BPU 增加 INT8 MatMul”做例子。一位 compiler engineer 通常不是直接生成汇编，而是依次完成下面这些工作。

### 1. 接住上游语义

先确认输入 contract：是否允许 dynamic shape，量化是 per-tensor 还是 per-channel，accumulator 是 `i32` 还是更窄，bias 和 activation 是否融合。

这一阶段常落在 StableHLO、Torch 或项目自己的 graph/tensor Dialect。Dialect 在这里不是语法皮肤，而是“哪些程序算合法”的协议。

### 2. 把通用算子变成可映射的结构

MatMul 会被规范化为明确的 iteration space 和 reduction。然后根据 SRAM 容量与 compute array 形状选择 `M × N × K` tile。

这正是 Tiling、Rewrite 和 Transform 类机制出现的地方：它们把一个数学算子改写成硬件可以逐块处理的程序，同时保留等价性。

### 3. 决定数据放在哪里

Tensor 不能永远停留在“逻辑值”。backend 要决定 global memory、SRAM 和 register 中分别放什么，何时分配 buffer，layout 如何满足 vector lane 或 systolic array。

此时你会真正理解 Bufferization、MemRef、address space 和 layout attribute：它们都在回答“这个值以什么物理形式存在”。

### 4. 显式化 DMA 与同步

为了隐藏访存延迟，编译器可能生成 double buffering：engine 计算 tile 0 时，DMA 预取 tile 1。随后还要插入 dependency、barrier 或 event。

如果 target Dialect 有 `bpu.dma_async`、`bpu.matmul`、`bpu.barrier`，这些 Operation 就构成硬件与编译器共同认可的 contract。Verifier 可以在生成指令之前拦住越界 SRAM、错误对齐或缺失同步。

### 5. 生成设备命令并建立证据链

最后才是 instruction selection、command encoding、Runtime ABI 和 simulator/device execution。每个关键 Pass 都应保留输入输出样例、negative test 和性能指标。

::: tip 把抽象名词换成工程问题
`Dialect` 是边界协议，`Pass` 是一次批量变换，`Rewrite Pattern` 是局部等价规则，`Dialect Conversion` 是带合法性检查的迁移，`Verifier` 是尽早暴露错误的防线。
:::

## 哪些真实项目在使用 MLIR？

| 项目 | 是否基于 MLIR | 它在解决什么问题 | 最值得学习的部分 |
| --- | --- | --- | --- |
| **Triton** | 是 | 把 Python kernel DSL 编译到 NVIDIA、AMD 等后端 | 自定义 Dialect、layout、GPU target lowering、kernel autotuning |
| **IREE** | 是 | 把 ML model 编译、部署并运行在多种设备上 | 端到端 pipeline、async scheduling、HAL 与 Runtime 边界 |
| **StableHLO / OpenXLA** | 是（StableHLO 是 MLIR-based representation） | 在 framework 与 compiler 之间提供可移植、可版本化的算子协议 | 前后端 contract、兼容性、序列化 |
| **Torch-MLIR** | 是 | 把 PyTorch 程序导入 Torch Dialect 并接入 MLIR ecosystem | frontend import、语义保真、progressive lowering |
| **CIRCT** | 是 | 将 MLIR/LLVM 方法用于硬件设计工具 | 用 Dialect 表达硬件层次、时序与数据流 |
| **TileLang** | 否；当前建立在 TVM TIR 上 | 用 tile-centric DSL 编写高性能 GPU/accelerator kernel | 显式 tile、memory、pipeline 与 scheduling 设计 |

这张表也说明：**项目是否使用 MLIR，和它是否值得 MLIR 学习者研究，是两个问题。** MLIR 是基础设施选择；tiling、layout、memory hierarchy、synchronization 则是所有 accelerator compiler 都要面对的领域问题。

## Triton：MLIR 怎样服务一个 Kernel DSL

Triton 给用户的是 Python 风格的 kernel 编程体验，给 compiler 的却是分层的 IR。一个典型过程可以理解为：

```text
Python kernel
  → kernel semantics
  → GPU layout and blocked computation
  → target-specific GPU operations
  → LLVM / device code
```

在当前 Triton 代码与调试界面中，你会看到 TTIR、TritonGPU IR 等名称；具体 Pass 和中间层会随 backend 与版本变化。关键不是背诵完整 pipeline，而是观察同一个 kernel 的信息如何变化：

- 高层阶段保留 pointer arithmetic、mask、program instance 等 kernel 语义。
- GPU 阶段加入 thread/warp/CTA 的 layout 与数据分布信息。
- target 阶段选择具体 memory、matrix instruction 和 synchronization 形式。

这对 BPU backend 的启发很直接：你也可以让前一层描述“要处理哪个 tile”，下一层再描述“tile 分到哪个 engine、驻留在哪块 SRAM、使用哪条指令”。不用让一个 Operation 同时承担所有决策。

Triton 还提供 `MLIR_ENABLE_DUMP=1` 来输出每个 MLIR Pass 之前的 IR，并能生成 MLIR reproducer。对初学者来说，**跟踪一个真实 kernel 的 IR 变化，往往比先写一个新 Pass 更容易建立直觉。**

## TileLang：不是 MLIR，为什么仍值得看

TileLang 官方文档将 kernel 定义为由 `@T.prim_func` 产生的 **TIR function**，这里的 TIR 来自 TVM，而不是 MLIR。

它和 Triton 仍然可以解决相似的 kernel 优化问题，只是选择了不同的 compiler infrastructure：

| 对比 | Triton | TileLang |
| --- | --- | --- |
| 基础 IR | MLIR-based Triton compiler | TVM TIR |
| 用户入口 | Python kernel DSL | Python tile-centric DSL |
| 核心关注 | program instance、layout、GPU lowering | tile operation、memory scope、pipeline、scheduling |
| 对 BPU 的价值 | 学习多层 Dialect 与 target lowering | 学习哪些调度决策应该让用户显式表达 |

TileLang 能帮助你反问一个重要的产品问题：某个 tiling 或 pipeline 决策，应该由 compiler 自动推导，还是应该通过 DSL 暴露给 kernel author？这个问题与底层是不是 MLIR 无关，却会直接决定你的 Dialect 设计。

## IREE：MLIR 不只是 Kernel Codegen

Triton 更像“如何把一个 kernel 做快”，IREE 则展示“如何把一个 model 变成可部署程序”。它的内部 pipeline 使用多种 MLIR Dialect，官方文档中特别重要的一段是：

```text
Flow → Stream → HAL
```

- **Flow** 处理 tensor program 的 dispatch region 与高层数据流。
- **Stream** 把 tensor program 变成显式调度的 asynchronous program，处理资源、并发与 affinity。
- **HAL** 把执行映射到具体 device/runtime interface。

这与 BPU 工程中常见的分层非常接近：graph partition → command scheduling → device abstraction。它提醒我们，kernel lowering 只是完整系统的一部分；编译器还必须决定 dispatch 边界、资源生命周期、异步执行与 Runtime contract。

## “Lowering”其实有三种含义

初学时容易把所有箭头都叫 lowering，结果讨论很快混乱。更清晰的分法是：

1. **Semantic lowering：** 把 framework 算子语义变成更通用、更明确的计算语义，例如 Torch/StableHLO 到 structured operations。
2. **Scheduling lowering：** 决定 tile、loop order、parallelism、layout、buffer 与数据搬运。
3. **Encoding/codegen：** 把合法的 target operations 变成 ISA、binary 和 Runtime commands。

一个 Pass 可能跨越其中两个边界，但在设计文档和调试记录里最好明确它正在消除哪类抽象、引入哪类约束。

## 针对你的学习路线

如果目标是 AI accelerator / BPU backend，可以按下面顺序把真实项目与本站教程结合起来：

1. **先看本页与 IREE**：建立 model、kernel、schedule、Runtime 的全景，不再把 MLIR 等同于某种语法。
2. **再看 Triton**：理解一个 kernel DSL 如何用多层 IR 表达 layout 和 target mapping。
3. **用 TileLang 做对照**：研究 tile、memory 和 pipeline 哪些是显式的，哪些由 compiler 推导。
4. **回到本站动手**：学习 Operation、Dialect、Rewrite、Conversion，再完成 MiniBPU MatMul slice。

### 第一个真实观察实验

选一个很小的 Triton vector-add 或 softmax kernel：

1. 设置 `MLIR_ENABLE_DUMP=1` 并编译一次。
2. 不急着读懂所有 IR；只记录每次 dump 中出现和消失的 Dialect/Operation。
3. 找到 layout、memory access 和 target-specific operation 第一次变得显式的位置。
4. 把这三个边界画成自己的 pipeline，再与本站的 [Dialect](./dialects.md)、[Dialect Conversion](./dialect-conversion.md) 和 [Accelerator Mapping](./accelerator-mapping.md) 对照。

不同 Triton 版本和 target 的 dump 名称会变化，所以实验目标不是复刻某一份固定输出，而是训练“追踪信息在何处被引入”的能力。

## 官方资料入口

- [Triton repository](https://github.com/triton-lang/triton)：项目定位、构建方式与 MLIR debug options。
- [MLIR: Users](https://mlir.llvm.org/users/)：MLIR 官方维护的真实用户项目列表，包括 Triton、IREE、Torch-MLIR 与 CIRCT。
- [IREE developer overview](https://iree.dev/developers/general/developer-overview/) 与 [Stream Dialect](https://iree.dev/reference/mlir-dialects/Stream/)：端到端 compiler 与 asynchronous scheduling。
- [StableHLO repository](https://github.com/openxla/stablehlo)：framework/compiler 之间的可移植 MLIR-based operation set。
- [TileLang language basics](https://github.com/tile-ai/tilelang/blob/main/docs/programming_guides/language_basics.md)：`@T.prim_func` 与 TIR function 的官方说明。

下一章进入 [IR 核心结构与工具](./ir-foundations.md)，再把这里的工程问题映射到具体 MLIR 结构。
