# Systolic-array wavefront 实验

这个实验用于理解 Google TPU MXU 背后的 systolic-array 基本思想。它不是 Google 官方 TPU simulator，也不是任何 TPU 代际的 cycle-accurate model。

模拟器假设：

- 计算 `C = A × B`；
- 一个矩形 PE array；
- A 从左向右传播，B 从上向下传播；
- 每个 PE 保留一个 output accumulator；
- output tile 按顺序执行；
- 不模拟 HBM、VMEM、vector unit、多 MXU、ICI 或 compiler instruction。

目标是观察：

- wavefront 怎样填充和排空 array；
- `K` 太小时 fill/drain 为什么明显；
- M/N 不能整除 array dimension 时，partial tile 怎样浪费 PE；
- scalar MAC count、array cycles 和 utilization 的区别；
- 为什么 TPU performance guide 强调 tensor dimension 和 padding。

## 运行

运行接近 TPU v6e/TPU7x `256 × 256` MXU dimension 的教学配置：

```bash
python3 labs/systolic_array/simulator.py \
  labs/systolic_array/programs/matmul_partial_tile.json
```

查看小型 `4 × 4` array 的逐周期 wavefront：

```bash
python3 labs/systolic_array/simulator.py \
  labs/systolic_array/programs/matmul_wavefront.json \
  --timeline 0 0
```

输出 JSON：

```bash
python3 labs/systolic_array/simulator.py \
  labs/systolic_array/programs/matmul_partial_tile.json \
  --json
```

## 配置

```json
{
  "m": 384,
  "k": 768,
  "n": 512,
  "array_rows": 256,
  "array_cols": 256
}
```

| 字段 | 含义 |
| --- | --- |
| `m` | A/output 的 row dimension |
| `k` | reduction dimension |
| `n` | B/output 的 column dimension |
| `array_rows` | PE array row 数 |
| `array_cols` | PE array column 数 |

## Cycle model

对于一个 active size 为 `R × C`、reduction 为 K 的 output tile，教学模型使用：

```text
cycles = K + R + C - 2
```

原因：PE `(i,j)` 在 cycle `i+j` 接收第一对匹配 operand，最后一个 reduction operand 在 `K-1+i+j` 到达。

这只描述最简 output-stationary wavefront。真实 TPU compiler/hardware 可以使用不同 tiling、pipeline、multiple MXU、buffering 和 overlapping。

## 三种 utilization

### Output padding utilization

```text
真实 output elements
────────────────────
所有 output tile 的完整 array slots
```

它突出 M/N 的 partial-tile waste。

### Wavefront utilization

在只计算 active rectangle 的前提下，衡量 K 个有用 MAC 相对于 fill/drain 期间可用 PE-cycle 的比例。

### Combined full-array utilization

```text
useful MACs
──────────────────────────
array_rows × array_cols × total_cycles
```

它同时计入 partial tile 和 wavefront fill/drain，是本实验最直观的综合指标。

## 推荐实验

### 1. K sweep

固定 `M=N=256`，让 K 取 16、64、256、1024。观察 K 越长时，fill/drain 越容易被 steady-state MAC 摊薄。

### 2. Partial tile

固定 `K=768`、`N=512`，让 M 取 256、257、384、511、512。观察只多一个 row 也可能产生额外 output tile。

### 3. Array generation 对照

分别设置：

```text
128 × 128  # v6e 之前的常见 Cloud TPU MXU dimension
256 × 256  # v6e/TPU7x 文档公开 dimension
```

同一个 shape 在更大 array 上不一定总有更高 utilization。更大的 peak capacity 需要更合适的 tile shape。

### 4. 与其他 lab 对照

- `static_scheduler`：Groq 用 compiler schedule 表达 resource/time；
- `tensix_pipeline`：Tenstorrent 用 CB 表达 producer-consumer；
- `systolic_array`：TPU MXU 用 operand wavefront 在 PE array 内复用。

比较：

- latency bubble 在哪里出现？
- 数据复用发生在什么层级？
- shape 不匹配造成什么浪费？
- 哪些问题由 compiler 处理，哪些是 hardware structure 固有？

## 简化边界

- 所有 output tile 串行，未模拟 tile overlap；
- 每个 PE 每周期最多一个 MAC；
- 不模拟 operand bandwidth、HBM、VMEM、SMEM 或 register capacity；
- 不模拟 vector/scalar/SparseCore；
- 不模拟 XLA fusion、layout、padding implementation；
- 不模拟多 TensorCore、dual chiplet、ICI 或 Pod；
- speedup 只是相对于“一周期一个 MAC”的教学基线；
- 不能用结果预测 TPU7x/v6e wall-clock performance。

下一步可扩展 HBM→VMEM double buffering、多个 MXU、vector epilogue 与 ICI collective。
