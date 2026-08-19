---
title: AI Compute Full-Stack Co-design Curriculum
description: 以六条主线组织 Model Computation、Software Mapping、Hardware Architecture、Software Optimization、Model–Hardware Co-design 和 Performance Validation。
outline: deep
products: ["跨架构"]
documentType: "课程蓝图"
topics: ["模型计算", "全栈映射", "硬件架构", "软件优化", "协同设计", "性能验证"]
---

# AI Compute Full-Stack Co-design Curriculum

archNotes 的目标不是收集厂商资料，而是建立一套可以双向使用的分析方法：从模型计算出发，经过 compiler、runtime 和 kernel 推导硬件需求；也从硬件资源和约束出发，判断软件与模型应怎样优化。

```text
模型结构与计算需求
  ↕
算法、数值表示与数据布局
  ↕
Framework、IR、Compiler、Runtime、Kernel
  ↕
ISA、计算单元、Memory、NoC、Interconnect
  ↕
多芯片训练、推理服务与系统 SLO
```

六条主线不是六套互不相关的文章。它们围绕同一个 workload 形成闭环：**描述计算 → 映射执行 → 理解硬件 → 优化软件 → 反向修改模型或硬件 → 用测量验证。**

## 一、统一学习结果

完成六条主线后，读者应能够对一个 MatMul、Attention、MoE layer 或完整 Transformer block 完成以下工作：

1. 写出 operation、tensor shape、依赖、状态和数值格式；
2. 估算 FLOPs、memory traffic、working set、数据复用和通信量；
3. 追踪 graph 如何变成 IR、kernel、instruction 和 device execution；
4. 说明计算、存储、调度、同步和互连分别由谁负责；
5. 判断 compute、memory、latency、communication、capacity 或 synchronization bottleneck；
6. 提出 model、compiler、kernel、runtime 或 hardware 层的改进方案；
7. 设计一个能够证伪自己判断的实验；
8. 保留 model、shape、precision、quality、software、topology 和 system boundary。

## 二、六条主线的关系

| 主线 | 主要方向 | 唯一负责的问题 | 入口文档 |
| --- | --- | --- | --- |
| 1. 模型计算与 Workload | 模型 → 需求 | 模型到底产生什么计算、数据和通信？ | [模型计算原语与 Workload 描述](./notes/model-computation-primitives.md) |
| 2. 模型到硬件的完整映射 | 上层 → 下层 | 一个 operation 怎样逐层变成设备执行？ | [模型到硬件的完整映射](./notes/model-to-hardware-mapping.md) |
| 3. 硬件架构 | 硬件 → 契约 | 硬件提供哪些资源，把哪些责任交给软件？ | [四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md) |
| 4. 软件优化 | 软件 → 利用率 | 不改变模型语义时，怎样减少时间、数据移动和浪费？ | [跨架构软件优化方法](./notes/software-optimization-methodology.md) |
| 5. 模型—硬件协同设计 | 双向反馈 | 什么时候应该修改模型、数值或硬件契约？ | [模型—硬件协同设计](./notes/model-hardware-codesign.md) |
| 6. 性能建模与验证 | 假设 → 证据 | 如何定量判断瓶颈并验证结论？ | [性能建模与验证](./notes/performance-modeling.md) |

以上六篇是各主线的“所有权文档”。其他专论和案例只展开其中一个问题，不再重复定义整条主线。

## 三、主线 1：模型计算与 Workload

### 核心问题

模型名称不能直接决定硬件需求。必须先把模型拆成 operation、tensor、dependency、state 和 communication，再分析每种计算的规律性、复用和动态性。

### 学习单元

| 单元 | 内容 | 文档计划 | 产出 |
| --- | --- | --- | --- |
| 1.1 计算原语 | GEMM、batched GEMM、convolution、reduction、normalization、gather/scatter | [框架已建立](./notes/model-computation-primitives.md) | operation 特征表 |
| 1.2 Transformer | Attention、FFN、KV cache、prefill/decode、GQA/MQA | 新增 `transformer-workload.md` | shape 与状态量分析 |
| 1.3 训练计算 | Forward、backward、optimizer、activation、gradient、checkpointing | 新增 `training-computation.md` | 训练内存与通信账本 |
| 1.4 稀疏与动态计算 | MoE routing、embedding、variable length、structured sparsity | 纳入协同设计案例 | 规则性与负载均衡分析 |

### 必须掌握的量

- operation count 与 critical path；
- FLOPs/MACs 与不同计数口径；
- tensor shape、layout、dtype 和生命周期；
- bytes read/write 与可实现的数据复用；
- persistent state，例如 weight、KV cache、optimizer state；
- batch、sequence length、hidden size、expert count 对需求的影响；
- collective 和 point-to-point communication volume。

### 实验与完成标准

选择一个 Transformer block，为 prefill、decode 和 training 分别建立 computation/traffic ledger。只有当读者能解释同一个 block 为什么在不同阶段呈现不同瓶颈时，本主线才算完成。

## 四、主线 2：模型到硬件的完整映射

### 核心问题

模型 graph 不会直接在硬件上执行。中间经过 capture、IR、rewrite、fusion、layout、bufferization、placement、scheduling、code generation、runtime submission 和 device execution。该主线负责连接这些层，不讨论某一厂商的全部实现细节。

### 统一映射模板

```text
Model / Framework graph
→ Stable or framework IR
→ Graph rewrite and fusion
→ Shape, layout and sharding decisions
→ Bufferization and memory planning
→ Kernel or program selection
→ Placement and scheduling
→ ISA / instruction streams
→ Runtime submission and synchronization
→ Compute, memory and communication pipelines
```

### 文档归属

| 文档 | 角色 | 整改方向 |
| --- | --- | --- |
| [模型到硬件的完整映射](./notes/model-to-hardware-mapping.md) | 跨架构统一主干，框架已建立 | 用同一个 Transformer block 串起全部层级 |
| [推理框架与运行时边界](./notes/inference-stack.md) | Framework/runtime 边界 | 补充 graph capture、specialization、lifecycle 与 serving boundary |
| [Groq 编译器心智模型](./notes/compiler.md) | 静态时空调度案例 | 保持为厂商案例，不承担通用 compiler 教程 |
| [ISA 与指令流](./notes/instruction-flow.md) | 指令流案例 | 连接 operation schedule 与 device instruction |
| TPU、Tensix 专论 | XLA/PJRT 与 TT software stack 案例 | 统一使用主干中的层级名称 |

### 实验与完成标准

选取 `MatMul → activation → residual`，分别画出 GPU、Groq、Tensix 和 TPU 的 mapping ledger。每一层必须写明输入、输出、决策者和仍未确定的信息，不能用“compiler 自动处理”代替解释。

## 五、主线 3：硬件架构

### 核心问题

硬件架构研究的重点不是峰值参数，而是资源和责任：计算在哪里发生，数据如何供应，下一项工作由谁选择，等待怎样被覆盖，完成和可见性如何证明，多芯片怎样扩展。

### 当前文档结构

| 层级 | 所有权文档 | 作用 |
| --- | --- | --- |
| 跨架构坐标系 | [四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md) | 统一 core、tile、调度、memory、compiler 和 interconnect 的比较口径 |
| NVIDIA GPU | [Tile 流水与同步](./notes/nvidia-gpu-synchronization.md) | 动态 SIMT、residency、scoreboard、async pipeline 与 completion |
| Groq TSP | [ISCA 架构导读](./notes/architecture.md) | Functional slicing、stream 和静态时空执行 |
| Tenstorrent Tensix | [Tensix 架构与软件栈](./notes/tenstorrent-architecture.md) | Core-local SRAM、CB、NoC 与 programmable dataflow |
| Google TPU | [Systolic Array、XLA 与 Pod](./notes/google-tpu-architecture.md) | MXU、VMEM/HBM、XLA/PJRT 与 ICI |

比较专题只回答一个窄问题：动态与静态调度、GPU SM 与 Tensix core 的责任变化、或多种 dataflow contract。它们不再复制完整架构介绍。

### 统一分析维度

1. compute organization；
2. execution and scheduling unit；
3. memory hierarchy and ownership；
4. data movement and synchronization；
5. latency-hiding mechanism；
6. compiler/runtime contract；
7. scale-up/scale-out interconnect；
8. programmability、dynamic behavior 和公开边界。

### 实验与完成标准

现有三个实验分别观察静态调度、CB pipeline 和 systolic wavefront。后续需要增加 GPU-style latency hiding 的简化模型，使四条架构主线都能落到可观察机制。

## 六、主线 4：软件优化

### 核心问题

软件优化不是厂商技巧清单，而是在保持数值语义或允许的质量边界内，减少不必要的 execution、data movement、synchronization 和 idle time。

### 统一优化顺序

1. 明确 workload、shape、dtype、quality 和 SLO；
2. 判断瓶颈类别，不先假定 compute-bound；
3. 减少 operation 和中间结果；
4. 提高 locality、reuse 和 transaction efficiency；
5. 重叠 compute、memory 和 communication；
6. 平衡 pipeline 与 parallel work；
7. 调整 numerics、layout、sharding 和 specialization；
8. 重新测量端到端结果与质量。

### 文档计划

| 文档 | 角色 | 核心内容 |
| --- | --- | --- |
| [跨架构软件优化方法](./notes/software-optimization-methodology.md) | 跨架构所有权文档，框架已建立 | Fusion、tiling、layout、buffering、quantization、sharding 和 profiling 的统一方法 |
| [Groq 风格的软件优化](./notes/software-optimization.md) | 厂商案例 | Chaining、SXM layout、weight preload 和 BERT mapping |
| TPU 与 Tensix 专论中的优化章节 | 厂商案例 | MXU utilization、Pallas、CB、NoC 和 core placement |
| GPU Tile 流水 | 机制案例 | Occupancy、async copy、barrier 和 pipeline ownership |

### 实验与完成标准

对同一个 workload 建立 baseline，每次只改变一个优化决策，并记录 FLOPs、bytes、latency、utilization、memory capacity 和 quality。无法说明优化改变了哪一项资源需求，就不能算完成优化分析。

## 七、主线 5：模型—硬件协同设计

### 核心问题

当软件优化无法消除根本瓶颈时，需要判断应该改变模型、数值、系统划分还是硬件资源。该主线负责双向反馈，不重复一般的软件优化技巧。

### 四类反馈

| 硬件或系统约束 | 模型/算法响应 | 需要验证的代价 |
| --- | --- | --- |
| HBM bandwidth 与 KV capacity | GQA/MQA、KV quantization、sliding window | Accuracy、context capability、decode latency |
| Intermediate traffic | FlashAttention、fusion-friendly operator | Recompute、kernel complexity、shape constraints |
| Matrix engine shape | Padding-friendly dimension、block structure | Parameter efficiency 与模型质量 |
| Interconnect 与 load imbalance | MoE expert placement、routing constraint、parallel strategy | Expert quality、capacity、tail latency |
| Low-precision units | Quantization-aware training、scaling、block format | Accumulation error、outlier handling、quality |
| Sparse execution support | Structured sparsity、block sparsity | Effective density、metadata 和 load balance |

### 文档计划

| 文档 | 角色 |
| --- | --- |
| [模型—硬件协同设计](./notes/model-hardware-codesign.md) | 协同设计决策框架与统一案例模板，框架已建立 |
| 新增 `attention-memory-codesign.md` | Attention、KV cache、FlashAttention、GQA/MQA 案例 |
| 新增 `numerics-sparsity-codesign.md` | Quantization、accumulation、structured sparsity 案例 |
| 新增 `moe-system-codesign.md` | Expert routing、network、placement 与 load balance 案例 |
| [GPU + LPX 异构推理](./notes/nvidia-groq3-heterogeneous-inference.md) | Layer 内异构划分与 online routing 案例 |

### 实验与完成标准

每个案例必须同时给出 baseline、约束、模型变化、硬件收益、软件代价和质量风险。只证明吞吐提升而不检查模型质量、状态容量或系统边界，不算协同设计结论。

## 八、主线 6：性能建模与验证

### 核心问题

架构和优化判断必须转化为可测量、可证伪的预测。本主线负责统一量纲、模型、实验和证据，不负责重复解释硬件结构。

### 性能模型层次

| 层次 | 主要量 | 典型问题 |
| --- | --- | --- |
| Operation | FLOPs、bytes、arithmetic intensity | 算子理论上更依赖 compute 还是 memory？ |
| Kernel | occupancy、pipeline utilization、transaction、stall | 实现为什么达不到 roofline？ |
| Device program | critical path、overlap、working set、synchronization | 多个 kernel 和数据移动怎样组合？ |
| Multi-device | communication volume、collective、topology、imbalance | 扩展效率为什么下降？ |
| Serving system | queue、batch、TTFT、ITL、throughput、SLO | 局部加速是否改善端到端服务？ |
| Cost/energy | joules、power、capacity、utilization、cost | 更快是否意味着更高系统效率？ |

### 文档与实验计划

| 内容 | 状态 | 目标 |
| --- | --- | --- |
| [性能建模与验证](./notes/performance-modeling.md) | P0 框架已建立 | FLOPs/Bytes、roofline、capacity、latency decomposition 与 communication model |
| 新增 `benchmark-methodology.md` | P1 | 公平输入、warmup、measurement boundary、quality、generation 与 topology |
| [静态调度实验](./labs/static_scheduler.md) | 已有 | Dependency、resource conflict、transport delay |
| [Tensix 流水实验](./labs/tensix_pipeline.md) | 已有 | Stage balance、buffer depth 与 backpressure |
| [Systolic wavefront 实验](./labs/systolic_array.md) | 已有 | Fill/drain、partial tile 与 utilization |
| 新增 roofline/traffic lab | P1 | 把 model operation 映射到 FLOPs、bytes 和 capacity |
| 新增 attention/KV lab | P2 | 观察 prefill/decode、context 和 batch 的需求变化 |
| 新增 collective/topology lab | P2 | 观察 parallel strategy 与 communication lower bound |

### 完成标准

实验必须先写预测，再给输入、单位、测量边界和结果。模拟器输出不能冒充真实硬件时间；厂商数据不能脱离 generation、dtype、shape、software 和 system boundary。

## 九、文档所有权与去重规则

| 问题 | 唯一归属 |
| --- | --- |
| Operation 和 workload 特征 | [模型计算原语与 Workload 描述](./notes/model-computation-primitives.md) |
| 全栈 lowering 与执行路径 | [模型到硬件的完整映射](./notes/model-to-hardware-mapping.md) |
| 四类硬件统一比较 | [四类加速器统一对照](./notes/ai-accelerator-architecture-comparison.md) |
| 跨架构软件优化方法 | [跨架构软件优化方法](./notes/software-optimization-methodology.md) |
| 模型—硬件反馈决策 | [模型—硬件协同设计](./notes/model-hardware-codesign.md) |
| 性能量纲、模型和瓶颈分类 | [性能建模与验证](./notes/performance-modeling.md) |
| 公共术语 | [术语表](./glossary.md) |
| 证据等级与资料 | [资料目录](./sources/catalog.md) |

厂商专论只解释该厂商如何实现这些共同问题；案例文只解释一个 workload 或 trade-off。若一段内容已经有所有权文档，其他文章应给出上下文和链接，而不是复制定义、比较表或结论。

## 十、每篇核心文档的固定结构

后续新增或整改的核心文档统一采用以下结构：

1. 核心问题与非目标；
2. 输入 workload 和变量；
3. 计算、数据、状态与通信；
4. 全栈责任分配；
5. 定量模型与瓶颈假设；
6. 优化或协同设计选择；
7. 可证伪实验；
8. 适用范围、代际与证据边界；
9. 与其他主线的连接。

## 十一、实施顺序

### P0：建立共同主干

1. [模型计算原语与 Workload 描述](./notes/model-computation-primitives.md)
2. [模型到硬件的完整映射](./notes/model-to-hardware-mapping.md)
3. [跨架构软件优化方法](./notes/software-optimization-methodology.md)
4. [模型—硬件协同设计](./notes/model-hardware-codesign.md)
5. [性能建模与验证](./notes/performance-modeling.md)

以上五篇框架和硬件架构主干均已落地，仓库现在具备六条可直接进入的主线。下一轮按 P1 顺序补充贯穿案例和定量内容，不在各厂商文章中重复定义主干。

### P1：加入代表性 Workload

1. `transformer-workload.md`
2. `training-computation.md`
3. `attention-memory-codesign.md`
4. `benchmark-methodology.md`
5. roofline/traffic lab

### P2：扩展动态和分布式系统

1. `moe-system-codesign.md`
2. `numerics-sparsity-codesign.md`
3. attention/KV lab
4. collective/topology lab
5. 将 GPU + LPX 案例接入统一 serving performance model

## 十二、共同案例与最终交付

六条主线共同使用一个 Transformer block 作为贯穿案例，必要时再扩展到 CNN、MoE、embedding 和 diffusion。最终项目不要求复刻真实芯片，而要求交付一份完整、可验证的 co-design dossier：

- workload specification；
- model-to-hardware mapping ledger；
- 四类架构的责任对照；
- baseline 与优化方案；
- 至少一个 model/hardware feedback decision；
- performance model 与实验结果；
- quality、generation、topology 和 evidence boundary。

这份交付能够同时回答两类问题：**硬件为什么这样设计，软件怎样利用它；模型为什么产生这种需求，又能否通过协同设计改变需求。**
