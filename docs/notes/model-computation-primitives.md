---
title: Model Computation Primitives and Workload Description
description: 在讨论 Compiler 和 Hardware 之前，用统一 ledger 描述 model 产生的 compute、data、state、parallelism 和 Communication requirement。
outline: deep
products: ["跨架构"]
documentType: "全栈主干"
topics: ["模型计算", "Workload", "Tensor shape", "数据复用"]
---

# Model Computation Primitives and Workload Description

## 核心问题

模型名称不能直接映射到硬件。首先要回答：模型由哪些 operation 构成，每个 operation 处理什么 shape 和 dtype，读写多少数据，保存什么状态，具有怎样的并行性、复用、同步和通信需求？

本篇是六条主线的 workload 所有权文档。其他文章可以使用这里的描述结果，但不重新定义 FLOPs、tensor lifetime 或 operation 分类。

## 非目标

- 不直接判断哪种 accelerator 最快；
- 不解释特定 compiler 的完整 lowering；
- 不把理论 FLOPs 当成实际执行时间；
- 不用模型参数量代替 activation、state 和 communication 分析。

## 1. 最小分析单位

一个可映射的 workload unit 至少包含：

| 字段 | 要回答的问题 |
| --- | --- |
| Operation | 执行的是 GEMM、reduction、gather、elementwise，还是通信？ |
| Tensor shape | 输入、输出和中间 tensor 的维度是什么？哪些维度会变化？ |
| Dtype | 输入、weight、accumulator 和输出分别使用什么数值格式？ |
| Dependency | 哪些结果必须先完成？哪些 operation 可以并行或流水？ |
| Data movement | 数据从哪里读、写到哪里、理论最少移动多少 bytes？ |
| Reuse | weight、activation 或 state 在哪个维度可以复用？ |
| State | 是否存在 KV cache、optimizer state、running statistics 等持久状态？ |
| Dynamic behavior | sequence、routing、sparsity 或 control flow 是否依赖运行时数据？ |
| Communication | 是否需要 collective、point-to-point 或 host/device exchange？ |
| Quality contract | 哪些数值误差、近似或模型变化是允许的？ |

## 2. 计算原语分类

### 2.1 Dense tensor compute

- GEMM、batched GEMM；
- convolution；
- tensor contraction；
- dense projection 和 FFN。

分析重点是矩阵维度、reuse、tiling、accumulation 和 matrix-engine shape。

### 2.2 Reduction 与 normalization

- sum、max、mean；
- Softmax；
- LayerNorm、RMSNorm；
- loss 和统计量计算。

分析重点是跨 element 依赖、数值稳定性、同步和多阶段数据遍历。

### 2.3 Elementwise 与 data transform

- activation、bias、residual；
- cast、scale、clamp；
- transpose、reshape、layout conversion；
- pack/unpack 和 quantize/dequantize。

单个 element 的计算量可能很低，但 intermediate traffic 和 fusion boundary 经常决定成本。

### 2.4 Irregular access 与 dynamic work

- embedding lookup；
- gather/scatter；
- sparse operation；
- MoE routing；
- variable-length sequence 和 data-dependent control flow。

分析重点是 locality、load balance、metadata、branching 和 runtime specialization。

### 2.5 State 与 communication

- KV cache 读取和追加；
- optimizer state 更新；
- all-reduce、all-gather、reduce-scatter、all-to-all；
- pipeline send/receive；
- heterogeneous activation transfer。

这些操作可能没有大量 FLOPs，却可能主导 capacity、latency 或 scale-out efficiency。

## 3. Workload 账本

每个代表性 workload 使用同一张表：

| Stage | Operation | Input shape/dtype | Output/state | FLOPs | Read bytes | Write bytes | Reuse | Dependency/communication |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| 示例 | 待填写 | 待填写 | 待填写 | 待计算 | 待计算 | 待计算 | 待分析 | 待分析 |

账本必须区分三种量：

1. **算法量：** 数学定义要求的 operation 和数据；
2. **实现下界：** 在理想 reuse 下至少需要的 movement；
3. **实际实现量：** 受 layout、tiling、fusion、padding 和 communication 影响的量。

## 4. Transformer 贯穿案例

后续内容统一用一个 Transformer block 串联六条主线：

```text
Norm
→ Q/K/V projections
→ Attention score and Softmax
→ Attention value aggregation
→ Output projection and residual
→ Norm
→ FFN or MoE
→ Residual
```

必须分别分析：

- training、prefill 和 decode；
- batch、sequence length、hidden size、head count 和 dtype；
- weight、activation、KV cache 与 temporary workspace；
- dense FFN 与 MoE；
- 单设备和多设备状态。

同一个 block 在这些阶段可能呈现完全不同的 compute、memory、capacity 和 communication 需求。

## 5. 与其他主线的接口

- 输出给[模型到硬件映射](./model-to-hardware-mapping.md)：operation、shape、dependency 和 state；
- 输出给[软件优化方法](./software-optimization-methodology.md)：baseline traffic、reuse opportunity 和 quality contract；
- 输出给[模型—硬件协同设计](./model-hardware-codesign.md)：无法通过普通 mapping 消除的根本需求；
- 输出给[性能建模](./performance-modeling.md)：FLOPs、bytes、capacity 和 communication ledger；
- 硬件差异由[四类架构统一对照](./ai-accelerator-architecture-comparison.md)负责解释。

## 6. 内容扩展顺序

1. 补齐 GEMM、reduction、elementwise、gather/scatter 的符号化计算表；
2. 建立 Transformer training/prefill/decode 三份账本；
3. 加入 MoE、embedding 和 structured sparsity；
4. 用脚本生成 shape sweep，而不是在正文堆固定数字；
5. 将账本输入 performance model 和后续实验。

## 完成标准

给定一个模型片段，读者能够在不知道目标硬件的前提下，写出足够完整的 workload specification；换一组 batch、sequence、dtype 或 parallel strategy 后，也能指出哪些需求随之变化。
