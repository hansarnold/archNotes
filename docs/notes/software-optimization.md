---
title: "Groq 风格的软件优化"
description: "这里的“软件优化”不是 REST API 调参，而是让 graph、tensor layout、numerics 和 schedule 适配 streaming architecture。"
outline: deep
products: ["Groq TSP"]
documentType: "机制专题"
topics: ["Fusion","Memory planning","量化"]
---

# Groq 风格的软件优化

这里的“软件优化”不是 REST API 调参，而是让 graph、tensor layout、numerics 和 schedule 适配 streaming architecture。

## 1. 优化目标

单看峰值 TOPS 不够。对 TSP/LPU 映射更直接的目标是：

- MXM/VXM/SXM/MEM 的有效利用率；
- producer-consumer pipeline 的 steady-state throughput；
- intermediate SRAM traffic；
- scratchpad 和 constants 容量；
- bank/stream/link conflict；
- end-to-end cycles 和 tail predictability；
- 多芯片 data movement 与 compute balance。

## 2. Chaining 与 fusion

如果 `MXM → VXM → MEM` 的 consumer 可以直接读取 producer stream，就不必把 MXM 结果完整写回 SRAM 再读出。

收益包括：

- 减少 SRAM read/write；
- 缩短 intermediate lifetime；
- 降低 scratchpad 容量；
- 让不同 functional units 重叠工作；
- 避免 MXM 等待非线性算子。

限制是 producer/consumer throughput、stream 数量、ALU chain 深度和路由必须匹配。

## 3. BERT 案例：GEMM + GELU

ASAP 2022 论文把 GELU 映射为 VXM ALU chain，并把 dequantize、GELU、quantize 串成流水。MXM 每产生一个结果 vector，直接送到 VXM；这样 GELU 的大部分延迟隐藏在 GEMM 之后的流式执行中。

学习要点：fusion 不只是合并 graph nodes，而是要形成硬件上可持续供数的 producer-consumer pipeline。

## 4. LayerNorm 与 Softmax

这类 reduction/nonlinear 操作通常需要多 pass。论文中的优化包括：

- 在生成输入时同时计算部分统计量；
- 保存并复用 `Z - E(Z)` 等中间值；
- 用多个并行 ALU chains 提高 vector throughput；
- 第一 pass 与上游 GEMM 重叠；
- 同时产生 fp32 residual path 和 int8 downstream path；
- 让 Softmax 与独立 GEMM 重叠。

这种优化同时涉及算法变换、数值格式、ALU allocation、memory lifetime 和 schedule。

## 5. SXM 中的 on-the-fly layout

attention heads 常需要 reshape/transpose。BERT 论文没有总是 materialize 完整 transpose，而是让 SXM 在数据从 MEM 流向 MXM 时完成 reorder/mask。

一般原则：

- layout transform 尽可能靠近 consumer；
- 如果 transform 能在数据路径上完成，就避免单独 kernel 和 buffer；
- 但必须比较 SXM 资源占用是否会阻塞其他 streams。

## 6. Weight preloading 与 double buffering

当一个 GEMM 需要多次 MXM passes，可在执行 pass `i-1` 时装载 pass `i` 的 weights，从而隐藏 install latency。这个模式要求：

- 独立或交替的 weight storage；
- MEM bandwidth 充足；
- load 与 compute schedule 不冲突；
- 编译器知道下一 pass 的确定时间。

## 7. 量化与混合精度

论文的 BERT 映射使用 int8 matrix operands、int32 accumulation 和 fp32 nonlinear。优化问题不是简单“全部 int8”，而是：

- 哪些 operator 对精度敏感；
- quantize/dequantize 是否能融入 VXM pipeline；
- embedding、weights、bias、activation 各用什么格式；
- 较宽 dtype 会占用多少 streams 和 SRAM；
- scale 是 per-tensor、per-channel 还是其他粒度。

## 8. Memory planning

优化顺序建议：

1. 先减少需要 materialize 的 intermediates；
2. 再缩短剩余 buffer lifetime；
3. 做 address reuse；
4. 分配到不同 MEM slices/banks 以获得并发；
5. 把高频 consumers 的数据放在更合适的位置；
6. 最后检查 instruction text、constants 和 scratchpad 总容量。

## 9. Shape 与硬件协同设计

论文讨论过 320-element vector/MXM 形状与标准模型维度不完全匹配。软件可以 padding/tiling；模型也可以选择更适合硬件的 hidden/head/channel dimensions。

这属于 algorithm-hardware co-design：可能提高利用率，但必须重新验证模型精度、参数量和可迁移性。

## 10. 多芯片优化

ISCA 2022 表明，只平衡 FLOPs 可能留下大量 data movement 开销。编译器还应考虑：

- weights/activations 位于哪个芯片；
- pipeline stage 的 compute 与 communication 是否平衡；
- collective 使用最短路径还是多条非最短路径；
- link bandwidth、hop latency 与 intermediate buffering；
- model parallel、tensor parallel、pipeline parallel 的组合。

## 11. 建议实验

对同一小 graph 构造两个 schedule：

```text
unfused:
  GEMM → Write → Read → GELU → Write

fused:
  GEMM ─stream→ GELU → Write
```

比较：

- makespan；
- MEM reads/writes；
- intermediate buffer lifetime；
- MXM idle cycles；
- VXM occupancy；
- 所需 streams。

这些指标比调用云 API 测 tokens/s 更接近你要学习的硬件-软件协同知识。
