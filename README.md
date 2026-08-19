# archNotes

一套研究不同 **AI accelerator architecture** 的学习笔记与可执行实验。项目不再以单一 LPU/Groq 为中心，而是使用统一坐标系比较四条主线：

- NVIDIA GPU：SM、SIMT/warp、Tensor Core、HBM/cache 与 CUDA ecosystem；
- Groq LPU/TSP：functional slicing、stream 与 compiler time-space scheduling；
- Tenstorrent Tensix：programmable core mesh、local SRAM、NoC 与 reader/compute/writer dataflow；
- Google TPU：TensorCore/MXU systolic array、XLA/GSPMD、HBM/VMEM 与 ICI Pod。

项目关注硬件微架构、编译器、指令/数据流、运行时、多芯片网络、软件优化和异构协作，不以云 API 调用为核心，也不把不同服务、模型和精度下的营销性能数字当成芯片机制实验。

## 学习目标

完成这套项目后，应该能够回答：

1. GPU SM、Groq functional slice、Tensix core 与 TPU TensorCore/MXU 如何组织计算？
2. Warp scheduling、time-space schedule、CB pipeline 与 systolic wavefront 怎样隐藏 latency？
3. Cache/shared memory、distributed SRAM、core-local scratchpad 与 HBM/VMEM 有什么不同？
4. CUDA compiler/library、Groq compiler、TT-MLIR/Metalium 与 StableHLO/XLA/PJRT 怎样分配责任？
5. Stream、CB、NoC、MXU、ICI、multicast、sharding 和 collective 分别解决什么问题？
6. 同一个 MatMul、Transformer block 如何映射到四种 architecture？
7. Fusion、layout、padding、buffer depth、occupancy 和 pipeline balance 为什么决定有效性能？
8. NVLink/NVSwitch、Groq C2C/LPX、Tenstorrent Ethernet mesh 与 TPU ICI/Pod 如何扩展？
9. 哪些 workload 适合 dynamic SIMT、explicit dataflow、static pipeline 或 systolic matrix engine？
10. 哪些 accelerator 可以细粒度协作，哪些当前只能做 request/workflow-level routing？
11. 如何区分同行评审结果、开源行为、厂商规格和教学推导？
12. 如何为同一 workload 建立公平、可验证的多架构实验？

## 项目地图

| 路径 | 内容 |
| --- | --- |
| `notes/ai-accelerator-architecture-comparison.md` | GPU、Groq、Tenstorrent、Google TPU 的统一架构坐标系 |
| `sources/catalog.md` | 四类 accelerator、论文、官方文档与通用背景资料索引 |
| `notes/nvidia-gpu-synchronization.md` | 跟随一块 tile 穿过 NVIDIA GPU 软硬件流水，理解每次 completion、visibility 与 ownership 交接 |
| `notes/architecture.md` | 第一代 Groq TSP 微架构导读 |
| `notes/lpu-vs-gpu.md` | Groq LPU/TSP 与 GPU 基础对照 |
| `notes/nvidia-groq3-heterogeneous-inference.md` | Rubin GPU + Groq 3 LPX 的 AFD、负载路由与容量模型 |
| `notes/tenstorrent-architecture.md` | Tensix core、NoC、local SRAM、TT-Metalium/TT-NN/TT-Forge 与 Galaxy |
| `notes/tenstorrent-rethinking-gpu-sm.md` | Tenstorrent 相对 GPU SM 弱化了什么、用什么替代，以及收益与代价 |
| `notes/groq-tenstorrent-comparison.md` | Groq、Tenstorrent 与 GPU 的深入机制对照 |
| `notes/google-tpu-architecture.md` | TPU MXU、systolic array、XLA/PJRT、VMEM/HBM、ICI 与 Pod |
| `notes/compiler.md` | Groq：从模型图到静态指令流的编译管线 |
| `notes/instruction-flow.md` | Groq：ISA、VLIW、独立指令队列与时间参数 |
| `notes/inference-stack.md` | Groq：前端、compiler、host runtime、device 与多芯片系统 |
| `notes/software-optimization.md` | Groq：BERT 映射案例和硬件感知优化方法 |
| `notes/learning-roadmap.md` | 多架构分阶段学习计划与交付物 |
| `labs/static_scheduler/` | Groq-inspired time-space 静态调度实验 |
| `labs/tensix_pipeline/` | Tenstorrent-inspired reader/compute/writer 与 CB 反压实验 |
| `labs/systolic_array/` | TPU-inspired systolic wavefront、fill/drain 与 partial-tile 实验 |

## 推荐顺序

```text
体系结构基础：pipeline / SIMD / SIMT / systolic / scratchpad / NoC
  ├→ GPU baseline：launch/residency → warp issue → execution/memory pipeline → synchronization → multi-GPU
  ├→ Groq：TSP slices → ISA/静态调度 → C2C → Groq 3 LPX/AFD
  ├→ Tenstorrent：Tensix core → Metalium/TT-NN → TT-MLIR → Galaxy
  ├→ Google TPU：MXU systolic → XLA/PJRT/Pallas → GSPMD/ICI → Pod
  └→ 统一对照：compute → memory → compiler → network
                 → workload fit → heterogeneous serving
```

建议先读 [AI accelerator 四架构总览](notes/ai-accelerator-architecture-comparison.md)，再进入 [NVIDIA GPU 软硬件流水与同步：一块 Tile 的端到端交接](notes/nvidia-gpu-synchronization.md)、[Groq](notes/architecture.md)、[Tenstorrent](notes/tenstorrent-architecture.md) 和 [Google TPU](notes/google-tpu-architecture.md) 专题。三个本地实验分别对应静态排程、producer-consumer pipeline 和 systolic wavefront：

```bash
python3 labs/static_scheduler/scheduler.py \
  labs/static_scheduler/programs/vector_add.json

python3 labs/tensix_pipeline/simulator.py \
  labs/tensix_pipeline/programs/eltwise_tiles.json

python3 labs/systolic_array/simulator.py \
  labs/systolic_array/programs/matmul_partial_tile.json

python3 -m unittest discover -s tests -v
```

## 公开资料的边界

各条研究主线公开程度不同：

- GPU 有成熟 CUDA/PTX 编程接口和公开指南，但完整 microarchitecture、firmware 与物理实现并不开放；
- Groq 有同行评审论文和专利，足以研究 functional slicing、ISA 类别和 compiler stage，但无法完整复现当前商业 compiler；
- Tenstorrent 的 TT-Metalium、TT-NN、TT-Forge 和 TT-MLIR 大量开源，可研究 kernel 与 lowering，但文档不等于完整 RTL 和物理代价；
- Google 的 StableHLO、XLA、PJRT、JAX/Pallas 大量开源，但 TPU backend、libtpu、ISA、RTL 和当前代 microarchitecture 只公开一部分；
- Blackhole/Wormhole、早期 Groq TSP/LPX、TPU v1/v4/v6e/TPU7x 属于不同代际，不能混用参数；
- Google 已列出 TPU 8i/8t 为 coming soon，当前机制基线仍以 TPU7x、v6e 和已发表论文为主；
- 产品页性能必须保留 model、dtype、quality、batch、shape、software、topology 和 system boundary。

因此，本项目实验都是“基于公开机制的教学模型”，每个实验会明确简化假设，不能预测真实芯片 wall-clock performance。

## 证据规则

- 所有数字标记芯片代际、频率、模型、精度、batch、chip count 与 topology。
- 分开“同行评审实测”“开源代码行为”“compiler prediction”“专利实施例”“厂商产品描述”。
- 不把 HLO、PTX、TT-Metalium kernel 或 Groq 专利 instruction 当成彼此等价的 ISA 层。
- 不用云 API tokens/s 反推裸芯片指令、功耗或片上利用率。
- 不把 TT Block FP8、TPU FP8、Groq FP8、NVIDIA FP8/NVFP4 峰值直接做倍数比较。
- 不把 SRAM、VMEM、HBM、GDDR 的不同层级 bandwidth 直接相除得出架构胜负。
- 对全部架构使用相同 workload、数值质量、shape、SLO、host/network 和系统功耗边界。
