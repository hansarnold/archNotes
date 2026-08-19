---
title: Glossary
description: archNotes 使用的 canonical English technical terminology，以及对应的 Chinese explanations。
outline: deep
products: ["Cross-architecture"]
documentType: "Shared reference"
topics: ["Terminology", "Layer boundaries", "Execution model"]
---

# Glossary

本页是全站的 terminology contract。term、acronym、capitalization、API name、ISA name 和 metric name 始终保留 canonical English；Chinese 只解释概念，不提供一套替代性的中文技术名词。

对应的 English 解释见 [English Glossary](./en/glossary.md)。

## Model and Workload

| Canonical term | Chinese explanation |
| --- | --- |
| **Workload** | 一次分析中固定的 model、Operation、Tensor Shape、batch、sequence length、Data Type、execution phase 和 system boundary。 |
| **Operation** | model graph 或 Intermediate Representation 中具有明确 input、output 和 semantics 的 compute 或 Data Movement unit。 |
| **Tensor Shape** | tensor 各 dimension 的 size 及其 semantics；它直接影响 parallel granularity、Working Set 和 Tile boundary。 |
| **Data Type (dtype)** | data 的 numeric representation，包括 storage format、compute precision 与 accumulation precision。 |
| **Dependency** | 一个 Operation、task 或 data item 开始前必须满足的 prerequisite。 |
| **Persistent State** | 跨 Operation 或 request 持续存在的 state，例如 weight、KV Cache 和 optimizer state。 |
| **Prefill** | autoregressive inference 中处理已有 input token 并建立 KV Cache 的 phase。 |
| **Decode** | autoregressive inference 中逐步生成新 token、读取并扩展 KV Cache 的 phase。 |
| **Mixture of Experts (MoE)** | 通过 Routing 为 token 选择部分 expert 的 model structure，会引入 dynamic Workload、Load Imbalance 和 Communication。 |

## Compute and Units of Work

| Canonical term | Chinese explanation |
| --- | --- |
| **Tile** | 被分块处理的一组 data 或 work；它在 GPU、Groq、Tensix 和 TPU 中不代表同一 hardware level。 |
| **Tensor Core / Matrix Multiply Unit (MXU)** | 面向 matrix 或 tensor Operation 的 Compute Unit；不同 product 中的 implementation 和 surrounding pipeline 不能仅凭名称视为等价。 |
| **Streaming Multiprocessor (SM)** | NVIDIA GPU 中容纳 Warp、register、Shared Memory、scheduler 与 Execution Pipeline 的 multiprocessor。 |
| **Functional Slice** | Groq TSP 中按 function 划分、由 Static Instruction Stream 协调的 datapath partition。 |
| **Tensix Core** | Tenstorrent mesh 中带 Local SRAM、Data Movement RISC-V 与 tensor/vector compute 的 programmable core。 |
| **Systolic Array** | data 在 Processing Element (PE) array 中按规则传播并 accumulate 的 structure。 |
| **Reduction** | 将多个 element 沿一个或多个 dimension 组合成较少 result 的 Operation，例如 sum、max 和 normalization statistics。 |
| **Arithmetic Intensity** | Operation count 与指定 memory level 实际 Data Movement bytes 的 ratio。 |

## Scheduling and Execution

| Canonical term | Chinese explanation |
| --- | --- |
| **Single Instruction, Multiple Threads (SIMT)** | 多个 thread 共享 instruction stream、通常以 Warp 为 issue unit 的 GPU Execution Model。 |
| **Warp** | NVIDIA GPU 中共同 issue instruction 的 thread group，也是 dynamic Latency Hiding 的重要 unit。 |
| **Static Scheduling** | 在 compile time 确定 Operation timing、Placement 或 resource allocation 的 plan；不表示 system 不存在 Runtime。 |
| **Dynamic Scheduling** | 在 execution time 根据 readiness、resource availability 或 priority 选择下一项 work。 |
| **Latency Hiding** | 用其他 executable work、Pipeline Overlap 或 Wavefront 覆盖 waiting time，而不是消除 Latency。 |
| **Occupancy** | GPU 上 resident work 与 register、Shared Memory、thread 和 architecture limit 的关系；它不等同于 Utilization。 |
| **Backpressure** | downstream buffer 或 Pipeline Stage 无法继续接收 data 时，对 upstream producer 形成的 blocking。 |
| **Wavefront** | Dependency 已满足的 work 沿 array 或 execution space 逐步推进形成的 activity front。 |
| **Critical Path** | Dependency graph 中决定 minimum Completion time 的 longest time-weighted path。 |
| **Pipeline Overlap** | 在 Dependency 与 resource 允许时 concurrent execution compute、Data Movement 或 Communication。 |

## Memory and Data Movement

| Canonical term | Chinese explanation |
| --- | --- |
| **Cache** | 由 hardware 或 software policy 管理、用于利用 locality 的 storage level；visibility 与 replacement semantics 取决于 architecture。 |
| **Scratchpad / Local SRAM** | 由 software 显式管理的 on-chip storage，不与 transparent Cache 混用。 |
| **Shared Memory** | NVIDIA GPU 中由 Cooperative Thread Array (CTA) 内 thread 共享、由 program 显式管理的 on-chip memory。 |
| **Circular Buffer (CB)** | Tensix Kernel 之间交换 Tile、表达 capacity 和 Ownership 的 bounded-buffer protocol。 |
| **High Bandwidth Memory (HBM)** | 面向 high aggregate bandwidth 的 off-chip memory；bandwidth 必须绑定具体 generation、configuration 和 measurement boundary。 |
| **Vector Memory (VMEM)** | TPU TensorCore 中供 vector 和 matrix compute 使用的 software-managed memory level。 |
| **Network on Chip (NoC)** | 连接 chip 内 core、SRAM 或 functional unit 的 network。 |
| **Data Movement** | data 在 register、on-chip memory、HBM、NoC 或 interconnect 之间的 transfer。 |
| **Reuse** | 同一份 data 在离开当前 storage level 前被多个 Operation 或 Tile 再次使用。 |
| **Working Set** | 某个 execution interval 内必须同时可用的 parameter、activation、state 和 temporary buffer。 |

## Synchronization and Ownership

| Canonical term | Chinese explanation |
| --- | --- |
| **Barrier** | participant 在 phase boundary rendezvous 的 synchronization object；它不自动替代全部 memory-order requirement。 |
| **Fence** | 约束指定 memory access 的 order 或 visibility，通常不承担 participant rendezvous。 |
| **Event** | 记录 task Completion 并建立 downstream Dependency 的 Runtime object。 |
| **Completion** | 某一 system level 对 work 已完成的 proof；issue、execution finish、memory visibility 和 remote delivery 是不同时间点。 |
| **Ownership** | 当前有权 read、write 或 reuse data、buffer 与 resource 的 producer、consumer 或 Pipeline Stage。 |
| **Collective Communication** | 多个 device 共同参与的 Communication Operation，例如 All-Reduce；cost 和 Completion semantics 取决于 topology、Runtime 和 API。 |

## Compiler and Software Stack

| Canonical term | Chinese explanation |
| --- | --- |
| **Intermediate Representation (IR)** | Compiler 在不同 abstraction level 表达 program semantics、Dependency、layout 或 target Operation 的 representation。 |
| **Lowering** | 把 high-level graph 或 Operation 逐步转换为更接近 target hardware 的 IR 和 Operation。 |
| **Fusion** | 合并 Operation 或 loop，以减少 intermediate materialization、Kernel Launch 和 Data Movement。 |
| **Tiling** | 将 tensor 或 iteration space 划分为适合 parallel execution 与 storage capacity 的 Tile。 |
| **Bufferization** | 将 tensor value 映射为具有 storage、lifetime 和 alias semantics 的 buffer。 |
| **Memory Planning** | 在 compile time 或 Runtime 安排 buffer Placement、size、lifetime 和 Reuse。 |
| **Placement** | 将 Operation、Tile、buffer 或 task 分配到具体 core、device 或 memory location。 |
| **Sharding** | 按 tensor dimension、Operation 或 state 将 Workload 分布到多个 execution resource。 |
| **Kernel** | 在 target device 上执行的 program unit；boundary、launch model 和 specialization 依 architecture 与 Runtime 而定。 |
| **Runtime** | 负责 program loading、submission、Dependency、memory lifetime 和 device coordination 的 software layer。 |
| **Parallel Runtime Interface (PJRT)** | XLA ecosystem 用于连接 compiled program 与 device execution 的 Runtime interface。 |
| **TT-Metalium** | Tenstorrent 的 low-level programming environment，用于控制 core、Kernel、buffer 与 NoC。 |

## Optimization and Co-design

| Canonical term | Chinese explanation |
| --- | --- |
| **Bottleneck** | 当前 boundary 下限制 end-to-end objective 的 dominant resource 或 Critical Path component。 |
| **Compute-bound** | Runtime 主要受 effective compute throughput 限制。 |
| **Memory-bound** | Runtime 主要受指定 memory level 的 effective bandwidth 或 access behavior 限制。 |
| **Capacity-bound** | Working Set 超过 available capacity，迫使 system 改变 batch、paging、Sharding、recomputation 或 Data Type。 |
| **Quantization** | 用较低 precision representation 表达 weight、activation 或 state，并定义 scaling、rounding 与 accumulation contract。 |
| **Model–Hardware Co-design** | 联动调整 model structure、numerics、software mapping 或 hardware contract，以解除无法通过 local Optimization 充分解决的 constraint。 |
| **Roofline Model** | 用 Arithmetic Intensity、effective compute rate 和 effective bandwidth 建立 performance upper bound 或 Runtime lower bound 的 model。 |

## Serving and Validation

| Canonical term | Chinese explanation |
| --- | --- |
| **Time to First Token (TTFT)** | request 到达后直到第一个 output token visible 的 elapsed time。 |
| **Inter-token Latency (ITL)** | streaming generation 中相邻 output token 之间的 elapsed time。 |
| **Service-Level Objective (SLO)** | service 对 Latency、throughput、availability 或 quality 等 metric 的 target constraint。 |
| **Utilization** | resource 在 measurement interval 内执行 useful work 的 fraction，必须说明 denominator 和 observation boundary。 |
| **Effective Bandwidth** | Workload 在指定 boundary 上实际获得的 Data Movement rate，而不是 interface peak specification。 |
| **Experiment Contract** | 在 measurement 前固定 question、Workload、prediction、control、metric 和 falsification criterion 的 record。 |

## Evidence Boundary

项目统一遵循[Source Catalog](./sources/catalog.md)中的 evidence rules：区分 peer-reviewed result、official specification、open-source behavior、patent embodiment 和 teaching inference，并保留 generation、Data Type、Tensor Shape、topology 与 system boundary。
