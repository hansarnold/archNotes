---
title: "Tile、数据搬运与性能实验"
description: "用可复算的假想加速器连接 Layout、SRAM、DMA、Double Buffering、Roofline 和 INT8，区分模型预测与真实测量。"
outline: deep
products: ["AI Accelerator", "MLIR"]
documentType: "实践教程"
topics: ["Tiling", "Layout", "Memory", "Performance", "Quantization"]
---

# Tile、数据搬运与性能实验

属于 [AI Compiler 概念路线](./bootcamp.md)的两个单元：**单元 4 用 90 分钟读到“单元 4 验收”；完成真实项目对照后，回来用 60 分钟完成单元 6。** 本页数字来自仓库中的分析脚本，不是某款 GPU/BPU 的实测。

## 单元 4：计算设备不是无限大的矩阵计算器 {#单元-5-计算设备不是无限大的矩阵计算器}

建议分配：概念与容量 30 分钟，DMA 与同步 25 分钟，运行与改参 25 分钟，复述 10 分钟。

模型说 `C = A @ B`，没有要求把整个矩阵同时放到计算单元旁边。设备上的快速存储有限，所以我们分块：一次保留一个 `BM × BN` 的输出 Tile，每轮沿 K 读入 `BM × BK` 的 A 和 `BK × BN` 的 B，把结果累加到同一个 C。

这里 BM、BN 是输出块的宽高，BK 是每次消费的 Reduction 长度。**Tile 是一份分工计划，不是一种新数学运算。** 把 K 分四次累加，数学上仍是同一个点积；浮点重新分组则可能改变舍入行为，需要符合数值约定。

### Layout：同一个逻辑元素到底在哪里

`A[i, j]` 是逻辑索引。连续 Row-major 的二维数组用元素偏移 `i * K + j` 找到它；一般 Strided View 用 `i * stride0 + j * stride1`，再乘元素字节数并加基址。

- Transpose 可以只交换 Shape 与 Stride；这改变访问解释，不必立刻复制数据。
- 设备可能要求连续块、特定对齐或分布到不同 Lane。此时逻辑 Transpose 不等于硬件能直接高效消费，可能还需要 Pack/Copy。
- Layout 转换可能提高计算吞吐，也会消耗读写带宽、临时 Buffer 和时间。不能把它算作免费。

**先判断：** 一个 `2 × 3` Row-major 数组的 Stride 是 `(3, 1)`。其 Transpose View 的 Shape 和 Stride 是什么？

<details>
<summary>查看答案</summary>

Shape `(3, 2)`，Stride `(1, 3)`。View 中的 `[1, 0]` 对应原数组 `[0, 1]`，元素偏移都是 1。底层存储顺序没有因为创建 View 自动重排。

</details>

### 容量：先证明能放下，再讨论快不快

下面定义一台**教学用假想加速器**：可用于本计算的 SRAM 为 32 KiB；A/B 使用 FP16，Accumulator C 使用 FP32。暂不计 Bias、Padding、描述符和额外 Workspace。真实设备要把这些开销补进预算。

默认 `BM=32, BN=32, BK=64, K=256`：

| 驻留数据 | 算式 | 字节 |
| --- | --- | ---: |
| 一份 A Tile | `32 × 64 × 2` | 4096 |
| 一份 B Tile | `64 × 32 × 2` | 4096 |
| 一份累加 C Tile | `32 × 32 × 4` | 4096 |
| Single Buffer | `A + B + C` | 12288（12 KiB） |
| Double Buffer A/B | `2 × (A + B) + C` | 20480（20 KiB） |

Double Buffer 为下一轮 A/B 留出另一组空间，C 仍只保留一份。若把 BM、BN 同时改成 64，Double Buffer 需要 **48 KiB**，超过 32 KiB，方案不可行。更大的 Tile 可能增强复用，但容量是先决条件，不是性能分数里的一个软惩罚。

### DMA：搬运与计算是不同的工作

DMA 可以理解为设备侧的数据搬运机制。它被提交后可能异步运行，Compiler/Runtime 必须确保 Compute 不会提前读取尚未到达的数据，也不会让 DMA 覆盖仍在计算中使用的 Buffer。

继续增加明确的模型假设：

- 只有一个 DMA Load 通道，带宽 8 bytes/cycle；每轮把 A+B 看作**一次合并请求**，启动开销 80 cycles。
- Compute 吞吐为 256 ops/cycle；一次 Multiply-Add 按 2 ops 计。
- 同一个输出 Tile 的 K 方向分四轮；C 留在 SRAM，最后才 Store 一次。
- 忽略 Bank Conflict、同步开销、指令发射与 Epilogue。最后 Store 也有 80-cycle 启动开销，不与下一输出 Tile 重叠。

因此每轮 Load 为 `80 + 8192/8 = 1104 cycles`，Compute 为 `2×32×32×64/256 = 512 cycles`，最终 Store 为 `80 + 4096/8 = 592 cycles`。

| 调度方案 | 为什么 | 该输出 Tile 的预测 |
| --- | --- | ---: |
| Single Buffer | 本轮 Compute 用完 A/B 后才能覆盖 | `4×(1104+512)+592 = 7056 cycles` |
| Double Buffer | 下一轮 Load 可以与本轮 Compute 重叠 | `4×1104+512+592 = 5520 cycles` |

Double Buffer 的逐轮 Load 区间为 `[0,1104]`、`[1104,2208]`、`[2208,3312]`、`[3312,4416]`；对应 Compute 在 1104、2208、3312、4416 开始，每段 512 cycles。最后 Compute 在 4928 结束，再 Store 592 cycles。

这不是把所有时间简单除以二。Load 比 Compute 慢，重叠后主要瓶颈仍然是搬运；初始填充与末尾排空也无法消失。如果分成 A、B 两次 DMA 请求，启动开销就应算两次，答案会不同。

### 在电脑上验证并改一个条件

在仓库根目录运行。手机读者先预测结果，再展开答案。

```sh
python3 -B labs/compiler_bootcamp/workload.py mapping
python3 -B labs/compiler_bootcamp/workload.py mapping --buffers 1
python3 -B labs/compiler_bootcamp/workload.py mapping --tile-m 64 --tile-n 64
```

<details>
<summary>查看关键输出和解释</summary>

默认配置 `working_set_bytes = 20480`、`feasible = true`、`estimated_cycles_one_output_tile = 5520`。Single Buffer 改为 12288 bytes 与 7056 cycles。大 Tile 需要 49152 bytes，`feasible = false`；脚本不为放不下的方案假装生成正常调度时间。

源代码：[workload.py](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/workload.py)。其中 Buffer 复用规则是先等该 Buffer 上一次 Compute 结束，再允许覆盖；Compute 同时等待本轮 Load 完成和前一轮累加结束。它是显式假设下的分析模型，不是 Cycle-accurate Simulator。

</details>

再试 `--tile-k 32` 与 `--tile-k 128`。先预测 SRAM 和请求次数如何变化，再运行。此练习要求 K 被 BK 整除；真实 Kernel 还要处理 Tail，不能把最后不足一块的元素越界读进来。

### 单元 4 验收 {#单元-5-验收}

用自己的话解释：Double Buffer 多花了什么空间？哪条依赖保证 Compute 不会读到未到达的数据？为什么 48 KiB 的方案必须先被拒绝？

下一步读 [真实项目](./real-world.md)，再回到下半页完成性能与数值。

## 单元 6：性能与数值，60 分钟 {#单元-8-性能与数值-60-分钟}

建议分配：Roofline 与 Shape 20 分钟，INT8 实验 20 分钟，验证策略和复述 20 分钟。

### FLOPs 多，不代表一定 Compute-bound

Arithmetic Intensity 是某个明确存储边界上的 `运算量 / 搬运字节数`。分析性能前要说清边界：DRAM、Cache 和 SRAM 的 Bytes 不同。Roofline 用峰值算力和带宽给出理想上界，等价的耗时下界是 `max(ops/peak_ops_per_second, bytes/bandwidth)`；真实开销只会让这一理想模型不够完整。

回忆 [MatMul 实验](./model-to-kernel.md)的 FP32 `M=128, K=256, N=128`：假设 A、B、Bias 各从外部存储读一次，C 写一次，理想融合流量为 **328192 bytes**，计算量为 **8388608 ops**，约 **25.56 ops/byte**。这组 FP32 全矩阵数字与上半页 FP16 单 Tile 模型是两个明确不同的实验，不能混用。

现在只把 M 改成 1。相同读写假设下，计算量为 65536 ops，流量为 133120 bytes，约 **0.49 ops/byte**。权重 B 几乎一样大，却只服务一行输出，复用机会下降。

这有助于理解为什么 LLM Prefill 和 Decode 可能遇到不同瓶颈，但它**不是完整 LLM/Attention 模型**。权重缓存、Batch、KV Cache、并行通信与硬件都会改变结论；不能只凭“Decode”这个名字宣布瓶颈。

```sh
python3 -B labs/compiler_bootcamp/workload.py model
```

**练习：** Fusion 消掉两个中间数组后，是否一定更快？先说省掉的读写，再列出寄存器压力、较差的并行度或不合适的 Kernel 选择可能带来的代价，最后说明你要测什么。

### INT8：改变表示，也改变数值约定

简单的 Per-tensor 量化可写成 `q = clamp(round(x / scale) + zero_point, -128, 127)`，近似还原是 `(q - zero_point) * scale`。Scale 必须大于 0；本脚本用 Round-to-nearest, ties-to-even。真实目标需要明确自己的舍入与饱和规则。

```sh
python3 -B labs/compiler_bootcamp/workload.py quant
```

<details>
<summary>先预测，再看量化结果</summary>

`scale=0.1, zero_point=0` 时，输入 `[-20, -0.26, 0.24, 20]` 得到 `[-128, -3, 2, 127]`，还原约为 `[-12.8, -0.3, 0.2, 12.7]`。中间两个值表现为舍入误差，首尾还有范围截断导致的 Clipping 误差。不能把所有误差都叫精度位数少造成的同一种误差。

</details>

INT8 MatMul 常用更宽的 INT32 Accumulator，但这不是“从此永不溢出”：范围还与 Reduction 长度、Zero-point 校正和 Bias 有关。Accumulator 转成输出 INT8 时，还需要 Rescale、Round 和 Clamp。Compiler 的 Fusion/Rewrite 必须保留约定的数值语义；验证要同时检查逐算子误差与最终任务指标。

### 用什么证据支持“更快且正确”

| 证据 | 能回答 | 不能单独证明 |
| --- | --- | --- |
| CPU Reference / Functional Simulator | 数值与执行语义是否符合约定 | 真实设备 latency |
| 分析或校准过的 Performance Model | 哪个资源可能成为瓶颈，候选方案如何排序 | 未建模硬件上的精确速度 |
| Cycle-accurate Simulator | 建模范围内的逐周期行为 | 模型之外的真实硬件效应 |
| Device Benchmark | 这组输入、软件版本、测量方法下的表现 | 所有 Shape 都更快 |

真实 Benchmark 至少固定 Shape、dtype、软硬件版本，分清 Compile/Warmup 与稳态执行，等待异步设备完成后计时，重复测量并核对结果。教学脚本打印的 cycles 应写成“模型预测”，不能贴成某款 BPU 的实测。

### 单元 6 验收 {#单元-8-验收}

留下三句话：一个容量限制、一个性能假设、一个数值风险。每句话再补上验证方法。最后进入 [30 分钟讨论演练](./discussion.md)。

进一步查阅：[Triton MatMul tutorial](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html)展示真实的分块、数据复用和调优；[MLIR Quantization](https://mlir.llvm.org/docs/Quantization/)解释量化类型与表示。这些是后续参考，不是本单元额外作业。
