---
title: Performance Modeling and Validation
description: 用统一 unit、layered model 和 Experiment Contract，把 Architecture judgment 与 Optimization hypothesis 转成可预测、可测量、可反证的 conclusion。
documentType: 全栈主干
topics:
  - performance
  - roofline
  - profiling
  - validation
---

# Performance Modeling and Validation

## 核心问题

怎样在实现之前预测主要资源限制，并在实现之后用一致的单位和实验条件验证判断？本章为其他五条主线提供共同的证据语言。

## 非目标

- 不试图替代 cycle-accurate 模拟器或芯片级功耗模型。
- 不把厂商峰值规格直接当作应用可达性能。
- 不用单次运行、单个 kernel 或缺少质量约束的数字得出系统结论。
- 不追求一个覆盖所有层级的万能公式；不同层级使用不同精度的模型。

## 统一单位与指标

| 类别 | 基本量 | 常见派生指标 |
| --- | --- | --- |
| 计算 | operations、instructions、tensor shape | 有效吞吐、利用率、每 token 计算量 |
| 数据移动 | bytes、事务数、访问层级 | 有效带宽、算术强度、复用率 |
| 容量 | 参数、激活、KV、临时 buffer | 峰值占用、可支持 batch 或上下文 |
| 时间 | 启动、计算、等待、同步、排队 | latency、关键路径、重叠率 |
| 通信 | message bytes、跳数、collective | 链路利用率、通信占比、扩展效率 |
| 服务 | 请求率、batch、token 数、队列长度 | TTFT、ITL、吞吐、P95/P99、SLO 达标率 |
| 能源 | joules、watts、执行时间 | 每 token 能耗、性能功耗比 |

所有数字都要带单位、口径和统计范围。例如 MAC 是否计作一次还是两次 operation，必须在文档中固定。

## 最小估算式

设工作量为 `Ops`，需要通过目标存储层级的数据量为 `Bytes`：

```text
Arithmetic Intensity = Ops / Bytes
Compute Lower Bound  = Ops / Effective Compute Rate
Memory Lower Bound   = Bytes / Effective Bandwidth
Simple Runtime Bound = max(Compute Lower Bound, Memory Lower Bound)
```

这里使用有效速率而不是理论峰值。有效速率应由可比 microbenchmark、历史测量或保守利用率假设得到，并注明来源。

### 容量约束

```text
Working Set = Parameters + Activations + Persistent State + Temporary Buffers
Working Set <= Available Capacity × Safety Factor
```

容量不满足时，不能只把问题描述成“更慢”；它会强制引入分片、分页、重计算、量化或卸载，从而改变性能模型本身。

### 重叠与关键路径

计算、搬运和通信只有在依赖与资源允许时才能重叠。估算时应画出关键路径，分别给出完全串行、理想重叠和根据 trace 得到的实际重叠三种结果。

### 分布式通信

至少记录通信 bytes、消息数量、参与设备、拓扑、链路有效带宽和启动延迟。collective 名称本身不足以预测代价，还要考虑分片方式和并发流量。

## 五级模型

| 层级 | 主要输入 | 主要输出 | 典型误差来源 |
| --- | --- | --- | --- |
| 算子 | shape、dtype、算法 | operations、逻辑 bytes | 忽略融合和真实事务 |
| Kernel | tile、layout、存储层级 | 吞吐、带宽、占用 | 编译器与边界 tile |
| 设备 | kernel 图、依赖、容量 | 关键路径、利用率 | 启动、同步、竞争 |
| 分布式 | 分片、collective、拓扑 | 通信时间、扩展效率 | 热点、负载不均、链路共享 |
| 服务 | 请求分布、batch 策略、队列 | TTFT、ITL、吞吐与尾延迟 | 排队、动态 shape、缓存命中 |

越向上层，模型越需要真实流量分布与调度信息；越向下层，模型越需要精确的硬件和编译细节。

## 瓶颈证据矩阵

| 判断 | 预测信号 | 实测证据 | 反证信号 |
| --- | --- | --- | --- |
| 计算受限 | 高算术强度，计算下界更大 | 计算单元利用率高，带宽有余量 | 降低 bytes 后仍明显提速 |
| 带宽受限 | 内存下界更大 | 带宽接近有效上限，执行单元等待数据 | 提升计算峰值带来明显收益 |
| 容量受限 | working set 超预算 | OOM、分页、卸载或 batch 被迫降低 | 容量变化不影响策略与吞吐 |
| 启动受限 | 大量短 kernel | 时间线存在密集空隙与提交开销 | 融合后端到端无变化 |
| 通信受限 | 通信位于关键路径 | 链路与 collective 时间占比高 | 单设备或理想互连估算仍同样慢 |
| 负载不均 | 最大分片远高于均值 | 设备或专家完成时间离散 | 重平衡后关键路径不变 |

## 实验契约

每个实验在执行前先填写：

| 字段 | 内容 |
| --- | --- |
| 问题 | 要验证或反证的具体判断 |
| 固定条件 | 模型、输入、精度、硬件、软件、热身与运行次数 |
| 预测 | 指标方向、数量级和资源原因 |
| 对照 | 基线、消融或理论上下界 |
| 采集 | 端到端时间、局部时间、counter、容量、通信与质量 |
| 统计 | 分位数、方差、异常值规则和样本范围 |
| 判定 | 什么结果支持假设，什么结果推翻假设 |

## 性能模型账本

每个结论保留三列数据：理论上界或下界、带假设的预测、实际测量。偏差不是简单误差，而是定位遗漏成本的入口，例如缓存失效、同步、调度空洞、转换或通信竞争。

| 对象 | 理论边界 | 模型预测 | 实际测量 | 偏差解释 |
| --- | --- | --- | --- | --- |
| 单算子 |  |  |  |  |
| 融合子图 |  |  |  |  |
| 单设备步骤 |  |  |  |  |
| 多设备步骤 |  |  |  |  |
| 在线请求 |  |  |  |  |

## 仓库内验证入口

- [脉动阵列实验](../labs/systolic_array.md)用于观察阵列填充、数据复用与利用率。
- [静态调度实验](../labs/static_scheduler.md)用于观察依赖、确定性时序和调度空洞。
- [Tensix 流水实验](../labs/tensix_pipeline.md)用于观察 tile、局部存储与流水关系。

后续实验都应先在本章记录预测，再进入具体实验文档，避免在看到结果后倒推解释。

## 与其他主线的接口

- [模型计算原语与 Workload 描述](./model-computation-primitives.md)提供 operations、bytes、状态和通信的原始账本。
- [模型到硬件的完整映射](./model-to-hardware-mapping.md)提供真实层级、执行顺序和可观察产物。
- [跨架构软件优化方法](./software-optimization-methodology.md)用模型选择优化并验收结果。
- [模型—硬件协同设计](./model-hardware-codesign.md)用模型量化跨层变化的收益和代价。

## 后续展开顺序

1. 建立一个 Transformer block 的算子级和设备级模型。
2. 分开补齐 prefill、decode 与训练的服务级模型。
3. 加入多卡分片、MoE 和通信重叠，并用真实 trace 校准。

## 完成标准

每个性能结论都应能追溯到明确单位、假设、公式、预测、实验条件和反证标准；模型与实测不一致时，文档必须解释偏差或降低结论置信度。
