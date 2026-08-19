---
title: 术语表
description: AI 加速器架构笔记中反复使用的共享术语与层级边界。
outline: deep
products: ["跨架构"]
documentType: "共享参考"
topics: ["术语", "层级边界", "执行模型"]
---

# 术语表

本页只定义跨文章反复出现的术语。厂商专有机制仍在对应架构专论中解释。

## 计算与工作单位

| 术语 | 本项目中的含义 |
| --- | --- |
| **Tile** | 被分块处理的一组数据或工作；它在 GPU、Groq、Tensix 和 TPU 中不是同一硬件层级。 |
| **Tensor Core / MXU** | 面向矩阵或张量运算的计算单元。NVIDIA Tensor Core 与 TPU MXU 不能只凭名称视为等价结构。 |
| **SM** | NVIDIA GPU 中容纳 warp、寄存器、shared memory、调度器及执行流水的多处理器。 |
| **Functional slice** | Groq TSP 中按功能纵向划分、由静态指令流协调的数据通路。 |
| **Tensix core** | Tenstorrent mesh 中带本地 SRAM、data-movement RISC-V 与 tensor/vector compute 的可编程 core。 |
| **Systolic array** | 数据按规则在 PE 阵列中传播并累加的结构，常用于解释 TPU MXU 的矩阵乘 wavefront。 |

## 调度与执行

| 术语 | 本项目中的含义 |
| --- | --- |
| **SIMT / Warp** | 多线程共享指令、按 warp 发射的 GPU 执行模型；warp 也是动态延迟隐藏的重要单位。 |
| **Static schedule** | 编译期确定操作时间、位置或资源占用的计划，不表示系统没有 runtime。 |
| **Dynamic scheduling** | 运行时由硬件或软件依据 readiness、资源与优先级选择下一项工作。 |
| **Latency hiding** | 用其他可执行工作、流水重叠或数据波前覆盖等待时间，而不是消除 latency。 |
| **Occupancy** | GPU 上 resident work 与资源约束的关系；它是延迟隐藏条件之一，不等同于利用率。 |
| **Backpressure** | 下游缓冲区或执行阶段无法继续接收数据时，对上游产生的阻塞。 |
| **Wavefront** | 依赖满足的计算沿阵列或执行空间逐步推进形成的波面。 |

## 存储与数据移动

| 术语 | 本项目中的含义 |
| --- | --- |
| **Scratchpad / Local SRAM** | 由软件显式管理的片上存储，不应与透明 cache 混用。 |
| **Shared memory** | NVIDIA GPU 中 CTA 可见、由程序显式管理的片上存储。 |
| **Circular buffer (CB)** | Tensix kernel 之间交换 tile、表达容量和所有权的有界缓冲协议。 |
| **HBM** | 高带宽片外内存；不同芯片、代际和系统边界下的带宽不能直接相除比较。 |
| **VMEM** | TPU TensorCore 内供向量和矩阵计算使用的软件管理存储层。 |
| **NoC** | 芯片内连接 core、SRAM 或功能模块的网络。 |
| **Collective** | 多设备共同参与的通信操作，如 all-reduce；完成语义取决于具体 runtime 和 API。 |

## 同步与所有权

| 术语 | 本项目中的含义 |
| --- | --- |
| **Barrier** | 参与者在 phase boundary 汇合的同步对象；它不自动替代所有 memory-order 要求。 |
| **Fence** | 约束指定内存访问的顺序或可见性，本身通常不承担参与者汇合。 |
| **Event** | 记录任务完成并建立后续依赖的 runtime 对象。 |
| **Completion** | 某层工作已经完成的证明；issue、执行结束、memory visibility 与 remote delivery 是不同时间点。 |
| **Ownership** | 哪个 producer、consumer 或 stage 当前有权读写或复用数据、buffer 与资源。 |

## 编译与软件栈

| 术语 | 本项目中的含义 |
| --- | --- |
| **Lowering** | 把高层图或算子逐步转换为更接近目标硬件的表示和操作。 |
| **Fusion** | 合并算子或循环，减少中间结果落盘、launch 和数据移动。 |
| **Memory planning** | 在编译期或 runtime 安排 buffer 的位置、大小、生命周期与复用。 |
| **Runtime** | 负责加载、提交、依赖、内存生命周期和设备协作的软件层，不等同于编译器或硬件调度器。 |
| **PJRT** | XLA 生态用于连接 compiled program 与设备执行的统一 runtime 接口。 |
| **TT-Metalium** | Tenstorrent 的低层设备编程环境，负责 core、kernel、buffer 与 NoC 相关控制。 |

## 证据边界

项目统一采用[资料目录](./sources/catalog.md)中的证据规则：区分同行评审结果、官方规格、开源行为、专利实施例和教学推导，并保留代际、精度、shape、topology 与系统边界。
