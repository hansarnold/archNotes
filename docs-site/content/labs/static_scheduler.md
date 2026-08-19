---
title: "Static Time-Space Scheduler Lab"
description: "这是一个教学用的确定性 list scheduler，用来理解 Groq 公开资料中的几个核心概念："
outline: deep
products: ["Groq TSP 教学模型"]
documentType: "可运行实验"
topics: ["静态调度","资源冲突","确定性"]
---

# Static Time-Space Scheduler Lab

<Badge type="tip" text="Groq TSP 教学模型" /> <Badge type="info" text="可运行实验" />

这是一个教学用的确定性 list scheduler，用来理解 Groq 公开资料中的几个核心概念：

- operator dependency DAG；
- functional resource allocation；
- producer functional delay；
- stream transport delay；
- 每个 resource 的独立 instruction queue；
- 由编译器显式插入的 NOP 区间；
- compile-time predicted makespan。

它不访问 Groq API，也不需要 Groq 硬件。

## 运行

```bash
python3 labs/static_scheduler/scheduler.py \
  labs/static_scheduler/programs/vector_add.json
```

输出 JSON：

```bash
python3 labs/static_scheduler/scheduler.py \
  labs/static_scheduler/programs/vector_add.json \
  --json
```

保存 schedule：

```bash
python3 labs/static_scheduler/scheduler.py \
  labs/static_scheduler/programs/vector_add.json \
  --output output/vector-add-schedule.json
```

## 输入格式

```json
{
  "name": "example",
  "resources": ["MEM_A", "VXM"],
  "operations": [
    {
      "id": "read",
      "instruction": "Read A -> S1",
      "resource": "MEM_A",
      "latency": 2,
      "occupancy": 1
    },
    {
      "id": "consume",
      "instruction": "Add S1, S2 -> S3",
      "resource": "VXM",
      "latency": 1,
      "dependencies": [
        {"op": "read", "transit": 2}
      ]
    }
  ]
}
```

- `latency`：issue 到 result ready 的周期数；
- `occupancy`：该 resource 无法 issue 其他操作的周期数，默认 1；
- `transit`：producer result 到 consumer resource 的移动周期数；
- consumer 的最早周期是所有 dependency arrival cycles 的最大值；
- 同一 resource 上的 operations 不能在 occupancy 区间重叠。

## 调度算法

当前实现按输入顺序进行稳定拓扑排序，再采用 greedy earliest-start list scheduling。它的目标是可读和可扩展，不保证全局最优 schedule。

## 与真实 Groq 编译器的差距

本实验没有实现：

- 20-tile instruction/data stagger；
- `d_skew` 的独立建模；
- stream 数量、方向和 stream-register occupancy；
- MEM slice/bank conflict；
- MXM plane、VXM ALU chain 和 SXM 子资源；
- Repeat/IFetch buffer capacity；
- VLIW binary encoding；
- C2C routing、deskew 和 link bandwidth；
- compiler cost model 与搜索。

## 建议扩展顺序

1. 给 dependency 加 stream ID 和 direction。
2. 把 MEM resource 拆成 slice 与 bank。
3. 加入 `d_skew` 并验证 instruction/operand intersection。
4. 支持 vector iteration，观察 pipeline fill/steady/drain。
5. 加 liveness analysis 和 SRAM address reuse。
6. 加 C2C links 与多 hop routing。
7. 对同一 graph 比较 fused/unfused schedules。
