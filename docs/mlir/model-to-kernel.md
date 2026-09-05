---
title: "从模型表达式到 Kernel"
description: "用 MatMul、Bias 和 ReLU 逐层连接模型、Graph、IR、Kernel、Runtime 与硬件，并运行无 GPU 的 Fusion 对照实验。"
outline: deep
products: ["AI Accelerator", "PyTorch", "MLIR"]
documentType: "入门案例"
topics: ["Graph", "Kernel", "Runtime", "Fusion", "MatMul"]
---

# 从模型表达式到 Kernel

[12 小时路线](./bootcamp.md)的 Day 1 单元 1–2，共 150 分钟。前 60 分钟读到“编译与执行”，后 90 分钟完成数值实验、数据量账本和复述。

## 先看用户写了什么

`Y = ReLU(X @ W + bias)` 是神经网络中一种常见的线性层加激活形式。这里不要求先学完整 Transformer。

- **Tensor**：带 shape 和 dtype 的多维数据。`X` 的 shape 是 `M × K`，`W` 是 `K × N`。
- **MatMul**：得到 `M × N` 的结果，每个输出累加 `K` 个乘积。
- **Bias**：本例是长度 `N` 的向量，给每一行加上相同的偏移。
- **ReLU**：逐元素取 `max(value, 0)`。

例如 `X` 为 2×3，`W` 为 3×2，则输出为 2×2。模型定义计算关系，还没有告诉设备该启动多少线程、每块数据放哪里。

## 同一个计算，各层分别看见什么

| 层 | 本例中的具体内容 | 该层要作的决定 |
| --- | --- | --- |
| Model expression | `relu(X @ W + bias)` | 用户定义计算与参数 |
| Graph | MatMul、Add、ReLU 三个节点及依赖 | 是否融合、分解、选择实现或放到不同设备 |
| IR | Compiler 内部可分析、可变换的程序表示 | 保留哪些语义，显式化哪些实现细节 |
| Kernel | 一次设备执行的计算程序，例如 tiled GEMM 加 epilogue | 并行工作划分、数据访问和计算次序 |
| Machine code | 目标设备可以执行的指令 | 使用哪些 load、matrix、vector 等指令 |
| Runtime / Driver | 分配数据、装载程序、提交工作、同步与回收 | 何时执行，使用什么资源，结果何时可读 |

Graph 可以是一种 IR；Kernel 也可以有自己的 IR。IR 是一个类别，并不是这些项目之间强制共享的唯一文件格式。

一个 Graph node 不一定对应一个 Kernel：几个节点可能融合；一个复杂算子也可能拆成多个 Kernel；Compiler 还可能调用已有 library kernel。你要跟踪的是本次具体的实现选择。

## 为什么 Compiler 会介入

先把公式展开成最朴素的实现：

```python
for m in range(M):
    for n in range(N):
        acc = 0
        for k in range(K):
            acc += X[m][k] * W[k][n]
        Y[m][n] = max(acc + bias[n], 0)
```

这个循环已经说明计算顺序，却没有充分利用目标硬件。Compiler 或 Kernel author 会继续问：哪些输出可以并行？能否把反复访问的数据留在快存储里？是否需要转换 Layout？设备支持什么 dtype？

**Graph optimization** 可以把独立的 Bias/ReLU 合到 MatMul 的结尾。这个结尾通常称为 **Epilogue**。**Kernel optimization** 则可能改变 tile、load 顺序和同步方式。这两层都可能影响性能，但作用对象不同。

## 编译与执行要分开理解

编译时，程序被分析、优化并生成目标代码。执行时，Runtime/Driver 准备参数和 buffer，提交工作，设备读写实际数据。JIT 表示部分编译在程序运行期间发生，不代表每次调用都必须重新编译。

因此第一次调用可能含编译和缓存建立成本。讨论性能时，应区分 **cold start** 与已经完成编译后的执行时间，并确认异步设备工作真的完成后再计时。

给熟悉 Clang 的读者：从 source 到 object file 的经验可以帮助理解编译阶段；AI Compiler 常额外面对 graph fusion、tensor shape/layout 和 accelerator memory mapping。模型部署还包含编译之外的 Runtime 工作。

::: details 自测：三次调用同一函数，是编译三次还是执行三次？
通常会执行三次，但是否再次编译取决于系统的缓存和 specialization 条件。shape、dtype、控制流或配置变化可能触发新的编译。不能仅凭“使用 JIT”就判断每次都会重编译。
:::

## 动手：两种实现，计算结果相同吗 {#block-2}

在仓库根目录运行：

```sh
python3 labs/compiler_bootcamp/workload.py model
```

源代码：[workload.py](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/workload.py)。它使用 Python 标准库，在 CPU 上实现两个路径：先分别生成 MatMul 和 Bias 的中间数组，以及直接写入最终结果的 fused 路径。

输入是 `X=[[1,2,-1],[0,1,3]]`、`W=[[2,-1],[1,3],[-2,1]]`、`bias=[-1,2]`。**先手算第一行，预测输出，再运行。**

::: details 参考答案与解释
结果为 `[[5,6],[0,8]]`。例如左上角：`1×2 + 2×1 + (-1)×(-2) = 6`，加 bias 得 5，经过 ReLU 仍是 5。左下角加 bias 后为 -6，因此变成 0。

脚本没有计时，也没有调用 GPU。这一步验证有限输入上两种写法的数值关系。Python 数值行为不能替代 GPU FP16、FMA、溢出或 NaN 语义测试。
:::

然后自己修改一个输入，让另一项也经过 ReLU 变为 0。写下你改了哪个元素、影响哪些输出，再比较两个路径。

## Fusion 为什么可能节省数据移动

取一个更大的分析案例：`M=128, K=256, N=128`，输入、输出和 bias 都按 FP32 的 4 bytes 计。规定一次乘加计 2 operations；下面只计算 MatMul 的运算量，忽略较少的 Bias/ReLU operations。

| 项目 | 计算 | 数量 |
| --- | --- | ---: |
| MatMul operations | `2 × M × N × K` | 8,388,608 |
| X 和 W | `(M×K + K×N) × 4` | 262,144 bytes |
| Bias 与最终 Y | `(N + M×N) × 4` | 66,048 bytes |
| 理想 fused traffic | 每份输入只读一次，Y 写一次 | 328,192 bytes |
| 两份中间结果的额外读写 | MatMul 输出写/读，Bias 输出写/读 | 262,144 bytes |

如果两份中间结果都物化到所分析的存储边界，unfused traffic 为 590,336 bytes。Fusion 的理由来自省去这些读写以及可能的 launch 开销。

这是一份**带假设的数据量账本**，不是测得的 HBM traffic。Cache、tile reload、library epilogue、Layout copy 和实际执行方式都会改变它。脚本明确输出 `timing_measured: false`。

::: details 追问：减少 traffic 就一定更快吗？
不一定。融合可能扩大 live values，增加 register 或 SRAM 压力，降低并行度；也可能放弃更高效的 library implementation。先检查可实现性，再比较实际 workload 下的整体时间和数值误差。
:::

## 结束前用自己的话说出来

用 3 分钟解释：“用户表达了什么计算？Compiler 可以改变什么？哪个阶段开始决定数据如何搬运？设备执行由谁提交？我用什么证据判断改进？”

下一步进入 [C++ 快速回温](./cpp-refresh.md)，然后读 [IR 逐行观察](./ir-reading.md)。真实 PyTorch 的 graph capture、backend 和 Triton 关系参考 [PyTorch Compiler 文档](https://docs.pytorch.org/docs/stable/user_guide/torch_compiler/torch.compiler.html)；Triton 的分块算法可对照[官方 MatMul 教程](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html)。
