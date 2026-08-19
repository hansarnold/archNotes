---
title: Groq TSP、Tenstorrent Tensix 与 GPU：调度责任对照
description: 聚焦比较 Groq 的静态空间流水、Tensix 的可编程 dataflow 与 GPU 的动态 SIMT baseline。
outline: deep
products: ["Groq LPU/TSP", "Tenstorrent Tensix", "NVIDIA GPU"]
documentType: "比较研究"
topics: ["执行模型", "调度责任", "SRAM-first", "多芯片"]
---

# Groq TSP、Tenstorrent Tensix 与 GPU：调度责任对照

三者都能执行 tensor graph，也都需要 compiler、runtime、片上存储和芯片互连。真正不同的是：**调度、数据位置和通信时序由谁显式负责。** 四架构总表见[统一对照](./ai-accelerator-architecture-comparison.md)；本文不重复 GPU、Groq 与 Tensix 的完整结构。

## 1. 三个执行模型

| 维度 | Groq TSP | Tenstorrent Tensix | NVIDIA GPU baseline |
| --- | --- | --- | --- |
| 空间组织 | 专用 functional slices | 带 local SRAM 的可编程 core mesh | 多个 SM 与多类 execution pipeline |
| 主要工作单位 | compiler-planned tensor stream | tile 与 reader/compute/writer kernel | thread、warp、CTA 与 software tile |
| 主要调度者 | compiler 的 time-space schedule | compiler/runtime placement + core 内协作协议 | compiler + runtime + 动态 warp scheduler |
| 片上数据管理 | compiler-managed SRAM 与 stream | local SRAM、CB、NoC 和显式 sharding | register/shared memory 显式管理，cache 动态管理 |
| 延迟隐藏 | 跨 slice、跨 tile 的预排流水 | data movement 与 compute 并行，靠 CB 吸收速率差 | 用 ready warp、并发 kernel 和 memory hierarchy 覆盖等待 |

“静态”和“可编程”不是互斥词。Groq 与 Tensix 都需要静态编译；差别在于 Groq 把全局时空计划推进得更深，Tensix 则保留更明确的 per-core kernel、buffer 和 NoC 编程面。

## 2. 同一个 MatMul + activation

```text
read input/weight → matmul → activation → write output
```

### Groq

Compiler 把 read、matrix、vector 和 write 映射到对应 slice，计算 functional delay 和 transport delay，再生成各 slice 的独立指令流。数据沿已经规划的路径前进。

### Tensix

Reader kernel 把 tile 搬进 input CB，compute kernel 执行 unpack、matrix/vector math 和 pack，writer kernel 消费 output CB。Core placement、CB capacity、NoC route 和 sharding 决定能否稳定重叠。

### GPU

Kernel 把工作划分为 CTA 与 warp。Warp scheduler 依据 readiness 动态发射 load、tensor、activation 和 store 相关指令；shared memory、register、cache 与 HBM 一起影响实际时序。

## 3. SRAM-first 的相似与差别

Groq 和 Tensix 都把片上 SRAM 与显式数据流放在核心位置，但不能合并成同一种架构：

- Groq 强调跨 functional slices 的全局、确定性 stream schedule。
- Tensix 强调 core-local SRAM、bounded CB 和由 NoC 连接的 programmable mesh。
- GPU 也大量使用 registers/shared memory，只是同时保留透明 cache 与动态 warp scheduling。

正确的问题不是“谁没有 cache”，而是：数据位置由谁决定、容量不足在哪里暴露、producer/consumer 如何交接 ownership、等待期间还有什么工作能继续。

## 4. Backpressure 与不确定性

Groq 的目标是让 compiler 在执行前解决大量资源和时序冲突。若 shape、placement 或 topology 不满足计划，问题更可能在 compilation 或 program preparation 阶段显现。

Tensix 的 CB 是有界协议。Reader、compute 或 writer 任一阶段变慢，full/empty condition 会沿 pipeline 传播；增加 buffer 只能吸收短期速率差，不能修复 steady-state bottleneck。

GPU 允许 warp 因 dependency 或 memory 等待，同时从其他 ready warp 中选择工作。这提高了适应性，但 cache、contention、residency 和 scheduler state 也使精确时序更动态。

## 5. 多芯片扩展

| 系统 | 扩展时必须显式处理的核心问题 |
| --- | --- |
| Groq | chip 间 stream、拓扑和确定性时序是否进入 compiler plan |
| Tensix | MeshDevice、tensor sharding、Ethernet/NoC data movement 与 collective |
| GPU | NVLink/NVSwitch 或 network topology、collective、stream/event 与 distributed completion |

三者都不能只凭互连带宽判断扩展效率。还要固定 message size、collective、overlap、host path、topology 和同步边界。

## 6. Workload 选择

- 选择 Groq 研究全图 schedule、确定性流水和 compiler-managed data movement。
- 选择 Tensix 研究 explicit dataflow、kernel pipeline、NoC placement 和 local SRAM pressure。
- 选择 GPU 研究动态 latency hiding、不规则控制流、广泛 kernel/library 生态和成熟 profiling。

这些是研究倾向，不是产品性能排名。具体结果仍取决于模型、shape、precision、quality、batch、软件版本和系统规模。

## 7. 实验映射

- [静态调度实验](../labs/static_scheduler.md)：观察 dependency、resource conflict 与 transport delay。
- [Tensix 流水实验](../labs/tensix_pipeline.md)：观察 CB capacity、stage imbalance 与 backpressure。
- [GPU Tile 流水与同步](./nvidia-gpu-synchronization.md)：追踪动态执行中的 completion、visibility 与 ownership。

三个模型的输出单位不同，不能把各自的“cycle”直接拿来做硬件性能倍数比较。

## 8. 结论

Groq 把更多责任放进全局 compiler schedule；Tensix 把更多责任暴露为 per-core kernel、buffer 和 mesh dataflow；GPU 让动态硬件在更大的 ready-work pool 中适应变化。它们不是“静态、半静态、动态”的简单等级，而是三种不同的软硬件契约。

共享术语见[术语表](../glossary.md)，产品与论文来源统一收录在[资料目录](../sources/catalog.md)。
