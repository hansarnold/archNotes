---
title: "ISA 与指令流"
description: "本章关注“指令如何控制固定功能单元，并在正确周期与数据相遇”。它不是完整 Groq ISA 手册，而是公开论文和专利可以建立的模型。"
outline: deep
products: ["Groq TSP"]
documentType: "机制专题"
topics: ["ISA","指令流","静态调度"]
---

# ISA 与指令流

<Badge type="tip" text="Groq TSP" /> <Badge type="info" text="机制专题" />

本章关注“指令如何控制固定功能单元，并在正确周期与数据相遇”。它不是完整 Groq ISA 手册，而是公开论文和专利可以建立的模型。

## 1. 指令流与数据流分离

```text
                    instruction flow
                          ↑
                          ↑  每个 slice 独立 instruction queue / ICU

data stream  → MEM → SXM → MXM → VXM → MEM →
```

- 指令沿 functional slice 的 tile 方向传播，并以 staggered 方式经过各 tile。
- operand/result 沿 stream 在 functional slices 之间移动。
- 当指令与目标 stream 在某 tile、某 cycle 相遇时，功能单元执行操作。
- 数据本身不需要携带“下一个算子是谁”的 packet metadata；编译器用时间和位置赋予其语义。

## 2. 独立 instruction queues

论文描述第一代 TSP 有 144 个独立 instruction queues。每个 queue 对应特定 functional slice 或 slice group，拥有自己的 program order。编译器同时追踪这些 queues 的 logical time。

这与“144 个通用 CPU core”不同：

- queue 中是 slice-specific operations；
- MEM queue 负责 Read/Write，MXM queue 负责矩阵相关控制，SXM queue 负责数据重排；
- queues 可并行推进，但必须保持编译器已证明的时间关系；
- 初始配置后，可主要通过 stream producer-consumer timing 协作。

## 3. VLIW 与 discrete instructions

公开专利描述 VLIW instruction/bundle 包含多个 sub-fields，每个有效 sub-field 是发送到特定 tile/slice 集合的 discrete instruction。可以把它理解为编译器显式表达同周期 ILP：

```text
cycle 20 bundle:
  MEM_WEST_0 : Read X → stream 1 east
  MEM_WEST_1 : Read Y → stream 2 east
  VXM        : NOP
  MXM_EAST   : LoadWeight ...
  SXM        : Permute ...
```

这只是教学表示，不是实际 binary encoding。

## 4. 时间参数

### `d_func`

functional delay：一条指令从执行到结果出现在目标 stream register 所需的周期数。

### `d_skew`

instruction-operand skew：instruction dispatch 与 operand 必须到达的时间关系。它让编译器知道应提前或延后发出哪一侧。

### transport delay

stream 从一个位置移动到另一个位置的周期数，通常与 slice 间距离和路径有关。

三者共同决定 producer-consumer 是否能正确相遇。调度器不是只看 DAG 拓扑顺序，还要看物理位置与 cycle。

## 5. 常见指令家族

| 区域 | 公开资料中的代表指令/操作 | 作用 |
| --- | --- | --- |
| ICU | NOP、Repeat、IFetch、Sync、Notify、SetVL/Config | 时间、取指、初始化同步、vector length |
| MEM | Read、Write、gather/scatter 类地址操作 | SRAM 与 streams 之间搬运数据 |
| VXM | Add、Mul、cast、activation、quantization | 逐元素与非线性流水 |
| MXM | load/install weights、activation control、accumulate | 矩阵乘加 |
| SXM | Shift、Permute、Distribute、Transpose、Rotate | tensor layout 与 lane movement |
| C2C | Send、Receive、deskew 相关操作 | 多芯片传输与链路对齐 |

完整 opcode、字段编码和当前产品语义并未公开。

## 6. NOP 为什么重要

在动态调度 CPU 中，NOP 常意味着浪费；在显式时间机器中，NOP 是 schedule 的一部分：

- 对齐不同 queues 的 logical time；
- 等待 operand 移动到消费位置；
- 避免 resource/bank/link conflict；
- 表达两个操作之间精确的 cycle distance。

专利描述 repeated NOP 可用 repeat count 编码较长等待，并由编译器隐式插入。

## 7. Repeat 与 IFetch

- `Repeat(n, d)`：重复前一操作，并在迭代之间加入固定 delay，适合规则 vector pipeline。
- `IFetch`：通过 stream 把后续 instruction text 填入 queue；可与正常执行重叠。

如果 instruction queue 饿空，编译器维护的 logical time 会失去基础，因此 instruction prefetch 本身也是静态 schedule 的资源问题。

## 8. Sync 与 Notify

这些指令提供高层 barrier，用于让独立 queues 在初始配置后对齐 logical time。论文描述的常见模式是一个 notifier queue 发出 Notify，其余 queues 等待 Sync。完成初始对齐后，大部分协作依赖确定性的 stream timing，而不是每个 producer-consumer 之间反复 barrier。

## 9. Vector add 的指令流

计算 `Z = X + Y` 可以抽象为：

```text
MEM_X queue : Read X → S1
MEM_Y queue : Read Y → S2
VXM queue   : Add S1, S2 → S3
MEM_Z queue : Write S3 → Z
```

关键不是四条指令的文本顺序，而是：

1. 两个 Read 可以在不同 MEM resources 上并行；
2. Read 结果经过不同距离后，必须在 Add 消费周期同时到达；
3. Add 的结果经过 functional + transport delay 后才能被 Write 消费；
4. 四个 queues 中间可能需要不同长度的 NOP 区间。

本项目的 `labs/static_scheduler/` 就从这个例子开始。
