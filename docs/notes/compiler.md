---
title: "Groq 编译器心智模型"
description: "本章根据 ISCA 2020/2022、ASAP 2022 BERT 论文和 Groq 专利整理。真实商业编译器未开源；下图是公开机制的结构化重建，不代表内部模块名称或 pass 顺序完全一致。"
outline: deep
products: ["Groq TSP"]
documentType: "机制专题"
topics: ["编译器","时空调度","资源规划"]
---

# Groq 编译器心智模型

本章根据 ISCA 2020/2022、ASAP 2022 BERT 论文和 Groq 专利整理。真实商业编译器未开源；下图是公开机制的结构化重建，不代表内部模块名称或 pass 顺序完全一致。

## 1. 为什么编译器是架构的一部分

传统 CPU/GPU 在运行时用 cache、arbiter、scoreboard、out-of-order scheduler 等硬件机制处理不确定的数据到达和资源竞争。TSP 的设计选择是把更多决定提前到编译期：

- 哪个 functional slice 执行操作；
- operand 放在哪个 MEM slice/bank；
- 使用哪个 stream 和方向；
- 指令何时 dispatch；
- 数据经过多少 transport cycles；
- 哪些操作并行、串行或流水重叠；
- 何时插入 NOP、Repeat、IFetch 和同步指令；
- 多芯片 tensor 走哪些物理 links。

因此，compiler schedule 不只是“生成机器码”，而是整个设备执行的显式计划。

## 2. 从模型到指令流

这不是一套可验证的商业编译器 pass 顺序，而是把公开机制整理成一条便于阅读的教学路径：

1. 从 framework model 或 tensor graph 开始；
2. 分析 DAG、shape、dtype 和 producer-consumer dependency；
3. 进行 operator rewrite 与 lowering；
4. 选择 numerics 和 quantization 路径；
5. 规划 tensor layout 与 SRAM；
6. 分配 functional unit；
7. 完成 time-space scheduling；
8. 生成 instruction queue 内容并进行 VLIW packing；
9. 生成 assembly、binary 和 constraint metadata；
10. 由 host 加载并进入 deterministic execution。

### DAG 与依赖

模型首先被表达成 operator/tensor DAG。节点或边需要携带 shape、dtype、producer-consumer dependency 等信息。编译器必须知道哪些操作可并行，哪些操作必须等待输入。

### Rewrite 与 lowering

高层 operator 不一定对应单条指令。编译器要把 convolution、LayerNorm、Softmax 等拆成硬件支持的 matrix、vector、switch 和 memory operations。公开专利还描述了把高 rank tensor lowering 成硬件处理的 rank-2 tensor/vector 表达。

### Numerics

这里决定 int8、fp16、int32 accumulator、fp32 nonlinear 等数值路径，并插入 quantize/dequantize、cast、scale。数值选择同时影响：

- stream 对齐和占用；
- MXM/VXM 吞吐；
- 常量和 activation 容量；
- 精度损失；
- 可以形成的 pipeline。

### Layout 与 memory planning

片上 SRAM 是显式管理资源，不是自动填充的 cache。编译器需要处理：

- tensor 分布到哪些 MEM slices/banks；
- 同周期 read/write 是否发生 bank conflict；
- weights 离消费它的 MXM 有多远；
- intermediate 是否直接 forwarding，还是写回 SRAM；
- buffer lifetime 能否复用同一地址；
- instruction text、constants、scratchpad 如何分配容量。

### Resource allocation

一个 operator 可有多个实现策略，例如：

- 使用几个 MXM planes；
- VXM 的 16 个 ALU 如何组成 chains；
- reshape 放在 SXM 流水中完成，还是先 materialize；
- tensor 按列、行或 layer 分片到多个芯片；
- 选择最短路径还是多路径分散带宽。

仅按 FLOPs 平衡通常不够。ISCA 2022 的 BERT-Large 案例表明，把 data movement 和空间布局加入编译器决策后，论文报告的 realized throughput 又提升约 26%。

### Time-space scheduling

编译器同时安排两个维度：

- **time**：每条 slice instruction 的 dispatch cycle；
- **space**：使用哪个 slice、stream、MEM bank、MXM plane、VXM ALU 或 C2C link。

对一条依赖边，可以用下面的教学模型理解最早消费时间：

```text
consumer_start >= producer_start
                + producer_functional_delay
                + stream_transport_delay
```

真实机制还要考虑 instruction-operand skew、20-tile stagger、stream capacity、bank/link occupancy 和多个 instruction queues 的 logical time。

### Instruction generation

调度结果被分发到各 functional slice 的 instruction queues。公开专利描述一种 VLIW 形式，其中 bundle 的不同 sub-fields 对应不同 tile/slice 集合。编译器显式打包可以同周期执行的 discrete instructions，并插入 NOP、Repeat 和 IFetch 维护时间关系和指令供给。

## 3. 编译器需要维护的状态

至少包括：

- 每个 instruction queue 的 logical time；
- functional unit 和 stream register 的占用；
- tensor 在哪个 MEM slice/bank；
- value 的 ready cycle 和当前位置；
- 每条指令的 `d_func`、`d_skew`；
- 数据移动距离；
- buffer liveness；
- SRAM、功耗、温度或执行时间等约束；
- 多芯片物理 link 的带宽和延迟。

## 4. 应重点学习的编译技术

| 技术 | 在 TSP/LPU 问题中的作用 |
| --- | --- |
| Graph rewrite | 把 framework operator 变成硬件友好的组合 |
| Fusion | 避免 intermediate 写回 SRAM |
| List scheduling | 在依赖与 resource constraint 下决定最早周期 |
| Modulo/software pipelining | 让连续 vector 或 layer 稳态重叠 |
| Liveness analysis | 计算 buffer 生命周期与复用机会 |
| Layout transformation | 对齐 vector/stream/MXM 形状 |
| Bank-aware allocation | 避免同周期 memory conflict |
| Instruction packing | 把独立 slice operations 放入同周期 bundle |
| Cost model | 比较计算、数据移动、容量和延迟 |
| Constraint solving | 满足 cycle、power、memory、thermal 等边界 |

## 5. 不应直接下结论的地方

- 专利中的 DAG/rewrite/scheduler/optimizer/assembler 是公开实施例，不保证等同当前产品源码结构。
- 2022 BERT 论文使用的 GroqAPI 允许较低层控制；这不等于普通用户今天能获得同样接口。
- “deterministic” 不代表编译容易。相反，动态硬件省掉的复杂度会进入 compiler search、placement 和 schedule validation。
- 编译器预测 device cycles 不等于 host-to-host latency；PCIe、pre/post-processing 和服务调度仍可引入变化。
