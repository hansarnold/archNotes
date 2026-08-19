---
title: Model-to-Hardware Mapping
description: 从 model graph、Intermediate Representation 和 Runtime task，一直追踪到 instruction stream、Data Movement 与 Hardware Execution Unit。
documentType: 全栈主干
topics:
  - mapping
  - compiler
  - runtime
  - execution
---

# Model-to-Hardware Mapping

## 核心问题

一个模型算子最终如何变成硬件上的计算、访存、通信与同步？本章关注的是完整执行链，而不是某个编译器 pass 或某条指令的孤立细节。

## 非目标

- 不在这里复述模型计算量，计算语义由[模型计算原语与 Workload 描述](./model-computation-primitives.md)负责。
- 不试图覆盖每家厂商的全部编译器实现。
- 不把“编译器会自动优化”当作结论；每个关键决策都要能指出所属层级和可观察产物。
- 不在这里评价优化收益，收益归入[性能建模与验证](./performance-modeling.md)。

## 完整执行链

| 阶段 | 主要决策 | 可观察产物 |
| --- | --- | --- |
| 模型与框架图 | 算子语义、依赖、动态维度 | 导出图、算子列表、shape 与 dtype |
| 图级或可移植 IR | 规范化、模式重写、融合候选 | IR、重写日志、子图边界 |
| 张量映射 | layout、分块、分片、复制 | tensor map、sharding spec |
| 内存规划 | buffer 生命周期、复用、放置 | buffer plan、峰值容量估计 |
| Kernel 选择与生成 | 实现、tile、并行粒度 | kernel IR、生成代码、二进制 |
| 设备调度 | placement、顺序、流水与同步 | task graph、command stream |
| 指令与运行时 | 提交、依赖、事件、通信 | 指令流、队列、trace |
| 硬件执行 | 发射、数据通路、存储层级使用 | counter、timeline、带宽与利用率 |

这条链允许前后反馈。例如，硬件对 tile 形状或片上容量的约束，会反过来影响图融合和 buffer 规划；动态 shape 也可能让部分决策延迟到运行时。

## 决策账本

分析任何映射时，至少记录以下字段：

| 字段 | 要回答的问题 |
| --- | --- |
| 输入与输出 | 哪些 tensor、shape、dtype 和依赖进入这一层？ |
| 决策 | 这一层选择了什么 layout、tile、placement 或执行顺序？ |
| 责任主体 | 框架、编译器、运行时、kernel 库还是硬件？ |
| 决策时机 | 模型构建、编译、加载还是每次执行？ |
| 约束来源 | 语义、容量、带宽、指令集还是拓扑？ |
| 可观察证据 | 用什么 IR、日志、trace 或 counter 验证？ |
| 失败表现 | 决策不合适时会出现什么瓶颈或正确性问题？ |

## 分层责任边界

| 层级 | 典型责任 | 不应含糊处理的边界 |
| --- | --- | --- |
| 框架与模型导出 | 保留语义、shape 和控制依赖 | 动态行为是否真的被捕获 |
| 图编译器 | 重写、融合、公共子表达式与分区 | 跨子图边界是否引入额外搬运 |
| Kernel 编译器或库 | tile、向量化、共享存储和指令选择 | 特化条件与回退路径是什么 |
| 运行时 | 内存分配、任务提交、同步与通信 | 哪些依赖静态已知，哪些运行时解析 |
| 硬件 | 发射、缓存、互连和执行流水 | 理论能力是否能被当前映射触达 |

## 通用映射练习

以 `MatMul → activation → residual add` 为例，不直接问“能否融合”，而是依次回答：

1. 三个算子的 shape、dtype、广播和依赖是什么？
2. 中间结果是否必须写回大容量存储，还是能保留在片上？
3. 融合后寄存器或片上存储压力是否增加？
4. tile 形状由谁选择，边界 tile 如何处理？
5. 多设备分片后，residual 的拥有者与通信位置在哪里？
6. 在 IR、kernel 代码和设备 trace 中分别能看到什么证据？

## 四类架构的映射观察位

| 架构视角 | 首要观察点 | 仓库入口 |
| --- | --- | --- |
| GPU | thread/block、warp 调度、缓存与 kernel 边界 | [GPU 同步与执行](./nvidia-gpu-synchronization.md) |
| 脉动阵列 | 数据驻留、阵列利用率、边界填充 | [Google TPU 架构](./google-tpu-architecture.md) |
| 静态调度数据流 | 编译期时序、片上路径与确定性 | [LPU 与 GPU](./lpu-vs-gpu.md) |
| 分布式 tile | 数据流图、tile 放置、NoC 与局部存储 | [Tenstorrent 架构](./tenstorrent-architecture.md) |

这些入口用于补充实例，统一比较轴仍以[AI 加速器架构统一对照](./ai-accelerator-architecture-comparison.md)为准。

## 与其他主线的接口

- 上游：[模型计算原语与 Workload 描述](./model-computation-primitives.md)提供算子、tensor、状态和通信需求。
- 方法：[跨架构软件优化方法](./software-optimization-methodology.md)选择在哪一层改变当前映射。
- 反向设计：[模型—硬件协同设计](./model-hardware-codesign.md)判断何时需要改变模型或硬件契约。
- 证据闭环：[性能建模与验证](./performance-modeling.md)检验映射是否实现预期收益。

## 后续展开顺序

1. 先补一条 Transformer block 的端到端映射账本。
2. 再用相同模板分别填写 GPU、脉动阵列、静态调度和分布式 tile。
3. 最后补充动态图、条件执行和多设备通信等破坏静态假设的情形。

## 完成标准

读者应能选择一个模型子图，画出从图到硬件执行的层级链，明确每个关键决策由谁、在何时作出，并用至少一种中间产物和一种运行证据验证自己的判断。
