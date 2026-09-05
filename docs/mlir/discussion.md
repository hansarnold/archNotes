---
title: "30 分钟讨论演练与验收"
description: "用六个带追问的 Compiler 讨论题检验模型、IR、Kernel 与硬件是否真正连起来。"
outline: deep
products: ["AI Compiler", "MLIR", "AI Accelerator"]
documentType: "学习验收"
topics: ["Discussion", "Compiler Pipeline", "Verification"]
---

# 30 分钟讨论演练与验收

这是 [AI Compiler 概念路线](./bootcamp.md)最后 30 分钟。目标不是背六段答案，而是能说出一个具体例子、适用条件与验证办法。先用 5 分钟写提纲，再讲 5 分钟，抽三道题追问 15 分钟，最后 5 分钟记录薄弱处。

## 五分钟，讲清一个计算

| 时间 | 你要讲什么 | 避免跳过的问题 |
| --- | --- | --- |
| 0–1 分钟 | `ReLU(X@W+b)` 的输入、输出、Shape 与数值语义 | “算什么”与“怎么执行”有什么区别？ |
| 1–2 分钟 | 为什么需要 Graph/IR，Fusion 改掉什么 | 一个 Operator 是否必然对应一个 Kernel？ |
| 2–3 分钟 | Tile、Layout、SRAM 与数据搬运 | 容量是否可行？哪项是假设？ |
| 3–4 分钟 | Compiler、设备代码与 Runtime 各自负责什么 | Compile time 和运行时谁提交任务、等待完成？ |
| 4–5 分钟 | 一次性能权衡，加上一个 CPU 实验 | 你如何验证正确？哪些结论尚未实测？ |

尽量用“因为……所以选择……代价是……可以用……验证”，而不是连续列出术语。可以对着手机录音；重新听时，删掉自己无法解释的名词。

## 六个核心题：先说，再展开

### 1. 模型、IR、Kernel 和 Runtime 是什么关系？

<details>
<summary>参考答案、追问与误区</summary>

模型表达计算语义；IR 是编译器用来分析和变换程序的表示；Kernel 是一段设备计算工作；Runtime 组织内存、加载、提交与同步。`MatMul+Bias+ReLU` 可能形成一个融合 Kernel，也可能分成几个，或调用现成 Library。IR 不只一种，Kernel 也不一定来自 MLIR。

追问：如果第一次调用很慢，第二次快，可能是什么？可以提出 JIT 编译、缓存、初始化、Warmup 等假设，再通过分阶段计时验证；不能仅凭现象确定原因。

误区：把模型 Graph 当作 GPU 指令，或认为每个 Operator 恰好对应一个 Kernel。

</details>

### 2. 为什么需要 MLIR？Triton 和 TileLang 都用它吗？

<details>
<summary>参考答案、追问与误区</summary>

MLIR 提供可扩展 IR、Pass、Rewrite、Verifier 等基础设施，帮助不同抽象层表达自己的约束；它不会自动补齐所有目标硬件的 Compiler。Triton 使用 MLIR；TileLang 当前基于 TVM TIR，它们仍都要解决 Tile、Layout 和 Memory 的问题。

追问：StableHLO 能直接替你运行模型吗？它主要提供可移植的算子表示与兼容性约定，仍需要接收它的 Compiler 和 Runtime。

误区：把 MLIR 看作单一 Dialect，或认为使用 MLIR 就必须经过同一条 Linalg Pipeline。出处见 [真实项目](./real-world.md)。

</details>

### 3. Fusion 为什么可能变快，又为什么可能变慢？

<details>
<summary>参考答案、追问与误区</summary>

它可能消除中间结果的写回与重读，减少 Launch。我们的 FP32 示例假设两个中间矩阵真正落到外部存储，因而省去 `4×M×N×4` bytes。与此同时，融合可能增加寄存器与共享存储压力、降低并行度，或者挡住更快的 Library Kernel。

追问：中间结果本来就被 Cache 命中时呢？物理 DRAM 节省量可能小于逻辑流量估算，应该看实际内存指标和端到端时间。

误区：把源码中少一次数组分配直接等同于 GPU 加速倍数。

</details>

### 4. Tile 越大越好吗？Double Buffer 是否总有用？

<details>
<summary>参考答案、追问与误区</summary>

大 Tile 可能提高数据复用，但会消耗更多本地存储并影响并行调度。教学模型中 32×32 输出 Tile 的 Double Buffer 是 20 KiB，可放入 32 KiB；64×64 则需要 48 KiB，直接不可行。Double Buffer 通过额外空间换取 Load/Compute 重叠，仍受通道、依赖和瓶颈限制。

追问：如果 Compute 比 DMA 更慢？重叠可能隐藏更多 Load，但 Compute 本身与首尾开销还在；要重新计算调度，不能沿用另一个配置的时间。

误区：只算 A/B 不算 Accumulator，或认为异步提交意味着数据已经到达。

</details>

### 5. 一个 Rewrite 怎样证明合法？

<details>
<summary>参考答案、追问与误区</summary>

先明确 Operation 语义和前置条件，再说明变换保持可观察行为。例如教学 Pass 只折叠两个已知常量的 Add，并先检查 signed i64 溢出；无法安全表示时保留 Add。测试包含变量路径、链式折叠、负数、溢出边界、非法引用和固定点。

追问：能否把同样的 checked-i64 规则当成 `arith.addi` 的定义？不能。MLIR 固定位宽整数加法的语义与本练习的拒绝溢出策略不同，C++ signed overflow 又是另一回事。浮点变换还要考虑舍入、NaN、signed zero 与允许的 Fast-math 条件。

误区：几个正例通过就等于对任意输入证明等价。

</details>

### 6. 怎样讨论“INT8 更快”或“Decode 是 Memory-bound”？

<details>
<summary>参考答案、追问与误区</summary>

把它们作为有条件的判断。INT8 可以减少数据量并利用专用指令，但还要看转换、校准、支持的 Shape、Accumulator 和输出误差。Decode 常有较低权重复用，但实际瓶颈与 Batch、缓存、KV、通信和设备有关。

追问：没有目标硬件怎么推进？先建立正确性 Reference、明确资源约束、用分析模型筛方案，并标注预测的适用范围；拿到设备后再用有同步与 Warmup 控制的 Benchmark 校准。不要把 CPU 脚本的运行耗时当作 BPU 性能。

误区：把 Roofline 下界、模型预测与真实测量混写成同一种数字。

</details>

## 评分与下一步

每题 0–2 分：0 分是只认得名词；1 分是能解释并举例；2 分是还能回答一次条件变化，给出代价与验证方法。**9/12 是本教程自设的复盘线，不是行业认证；第 1、5 题至少各 1 分。** 同时保留 CPU 数值与映射实验结果。C++ 另有独立的[练习验收](./cpp-labs.md#review-discussion)。

- 低于复盘线：只重做最弱的两个单元，不要立刻进入完整 LLVM Build。
- 达到复盘线：挑一个方向继续。想读 Compiler 源码，进 [Rewrite](./passes-rewrites.md)与 Toy；想做性能映射，进 [Accelerator Mapping](./accelerator-mapping.md)；想做工程闭环，进 [测试与结课项目](./testing-study-plan.md)。

两天的结果是有证据地参与讨论并知道下一步问什么，不是已经具备生产级 AI Compiler 开发能力。
