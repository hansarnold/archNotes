---
title: "Tensix reader/compute/writer 流水实验"
description: "这个实验是 Tenstorrent TT-Metalium programming model 的教学模拟器，不是 Tenstorrent 官方 simulator，也不是 cycle-accurate hardware model。"
outline: deep
products: ["Tenstorrent Tensix 教学模型"]
documentType: "可运行实验"
topics: ["流水线","Circular buffer","背压"]
---

# Tensix reader/compute/writer 流水实验

<Badge type="tip" text="Tenstorrent Tensix 教学模型" /> <Badge type="info" text="可运行实验" />

这个实验是 Tenstorrent TT-Metalium programming model 的教学模拟器，不是 Tenstorrent 官方 simulator，也不是 cycle-accurate hardware model。

它抽象一个 Tensix operation 的三条 device-kernel 流水：

```text
Reader → input circular buffer → Compute
       → output circular buffer → Writer
```

目标是观察：

- reader、compute、writer 如何在不同 tile 上重叠；
- bounded circular buffer 如何产生 backpressure；
- 哪个 stage 决定 steady-state throughput；
- CB 容量增加何时有效、何时只是浪费 L1 SRAM；
- pipeline makespan 与完全串行执行的差异。

## 运行

```bash
python3 labs/tensix_pipeline/simulator.py \
  labs/tensix_pipeline/programs/eltwise_tiles.json
```

查看逐 cycle timeline：

```bash
python3 labs/tensix_pipeline/simulator.py \
  labs/tensix_pipeline/programs/eltwise_tiles.json \
  --timeline
```

输出 JSON：

```bash
python3 labs/tensix_pipeline/simulator.py \
  labs/tensix_pipeline/programs/eltwise_tiles.json \
  --json
```

## 配置

```json
{
  "tiles": 12,
  "reader_cycles": 3,
  "compute_cycles": 5,
  "writer_cycles": 2,
  "input_cb_capacity": 2,
  "output_cb_capacity": 2
}
```

| 字段 | 含义 |
| --- | --- |
| `tiles` | operation 处理的 tile 数 |
| `reader_cycles` | reader 搬运一个 tile 的 service time |
| `compute_cycles` | compute 处理一个 tile 的 service time |
| `writer_cycles` | writer 搬运一个 tile 的 service time |
| `input_cb_capacity` | input circular buffer 可容纳 tile 数 |
| `output_cb_capacity` | output circular buffer 可容纳 tile 数 |

模拟器会为 reader 和 in-flight compute 预留未来的 CB slot，避免一个 stage 完成时才发现下游 buffer 已满。

## 推荐实验

### 1. Compute-bound

保持 `reader=3`、`writer=2`，把 `compute` 从 2 改到 10，观察 compute utilization 和其他 stage 的 empty/full stall。

### 2. DRAM/NoC read-bound

把 `reader` 改为 12。然后增加 input CB capacity，判断 buffer 是否能改变 steady-state bottleneck。

### 3. Writer backpressure

把 `writer` 改为 12、output CB capacity 改为 1，观察 compute 因 output buffer 满而停止。

### 4. Buffer depth sweep

对 input/output capacity 取 1、2、4、8。记录 makespan、最大 occupancy 和 speedup。容量足够覆盖 producer/consumer 波动后，继续增加通常不会提高吞吐。

### 5. 与 Groq lab 对照

`labs/static_scheduler/` 把 delay 和 resource placement 表达为预先生成的 time-space schedule；本实验把同步表达为 runtime producer-consumer buffer 状态。比较两者：

- stall 是编译期 NOP 还是运行期 wait？
- transport delay 在哪里表达？
- resource conflict 谁负责发现？
- buffer capacity 与 schedule length 如何互相影响？

## 简化边界

- 每个 stage 一次只处理一个 tile；
- 不模拟真实 FPU/SFPU、unpack/pack 子流水；
- 不模拟 DRAM bank、NOC0/NOC1、multicast 或 semaphore；
- 不模拟多 core/multi-device placement；
- service time 是配置值，不是官方硬件周期；
- timeline 用于理解依赖和反压，不能用来预测真实 Blackhole/Wormhole 性能。

下一步可以扩展 `NOC_READ`、`NOC_WRITE`、DRAM bank、multi-core multicast 和 per-core L1 capacity。
