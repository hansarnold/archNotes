# AI Accelerator Architecture 资料目录

最后核对日期：2026-08-10。

## 证据等级

| 等级 | 来源 | 用途 | 注意事项 |
| --- | --- | --- | --- |
| A | 同行评审论文 | 架构、系统、优化案例与实验条件 | 论文代际常早于当前产品，参数不能直接迁移 |
| B | Groq 技术资料 | 当前术语与设计定位 | 厂商表述，需要论文支撑 |
| B-TT | Tenstorrent 官方文档与开源项目 | Tensix programming model、软件栈、产品规格 | 版本变化快；产品表述与代码行为分开 |
| B-TPU | Google Cloud/OpenXLA/JAX 官方资料 | TPU system、XLA/PJRT、产品代际与 kernel model | 开源 compiler surface 不等于 TPU backend/ISA/RTL 全公开 |
| C | 专利 | ISA、compiler pipeline、调度和实现细节 | 实施例不等于所有量产实现 |
| D | 通用编译器/体系结构资料 | 建立 lowering、IR、schedule、runtime 背景 | 不是 Groq 实现本身 |

## A：Groq 核心论文

### 1. 单芯片微架构

**Think Fast: A Tensor Streaming Processor (TSP) for Accelerating Deep Learning Workloads**

- 会议：ISCA 2020
- DOI：`10.1109/ISCA45697.2020.00023`
- PDF：<https://groq.humain.ai/wp-content/uploads/2024/02/2020-Isca.pdf>
- 重点：functional slicing、producer-consumer streams、MEM/SXM/MXM/VXM、instruction queues、静态调度、ResNet50 映射。

### 2. 多芯片系统与软件调度网络

**A Software-defined Tensor Streaming Multiprocessor for Large-scale Machine Learning**

- 会议：ISCA 2022
- DOI：`10.1145/3470496.3527405`
- PDF：<https://groq.humain.ai/wp-content/uploads/2023/05/GroqISCAPaper2022_ASoftwareDefinedTensorStreamingMultiprocessorForLargeScaleMachineLearning-1.pdf>
- 重点：分布式 SRAM、Dragonfly、source routing、link scheduling、runtime deskew、Send/Receive、多芯片 BERT。

### 3. Transformer 映射与优化

**Answer Fast: Accelerating BERT on the Tensor Streaming Processor**

- 会议：ASAP 2022
- PDF：<https://groq.humain.ai/wp-content/uploads/2022/10/Groq_ASAP2022_BestPaper.pdf>
- 重点：GroqAPI、GEMM/GELU 重叠、LayerNorm/Softmax、多功能单元流水、量化、片上内存利用、tail latency。

## B：Groq 技术资料

- LPU architecture：<https://groq.com/lpu-architecture>
- What is an LPU：<https://groq.com/blog/the-groq-lpu-explained>
- Groq papers：<https://groq.com/papers>
- 2020 Microprocessor Report：<https://groq.humain.ai/wp-content/uploads/2023/05/GROQ-ROCKS-NEURAL-NETWORKS.pdf>

厂商将当前产品称为 LPU；早期同行评审论文称 TSP。不要默认名称改变前后的具体微架构参数完全相同。

## B2：2026 NVIDIA Groq 3 与异构推理

- NVIDIA Groq 3 LPX 架构：<https://developer.nvidia.com/blog/inside-nvidia-groq-3-lpx-the-low-latency-inference-accelerator-for-the-nvidia-vera-rubin-platform>
- NVIDIA Groq 3 LPX 产品页：<https://www.nvidia.com/en-us/data-center/lpx/>
- Vera Rubin + LPX scale-up 与 AFD：<https://developer.nvidia.com/blog/?p=116892>
- GTC 2026 平台 session：<https://www.nvidia.com/en-us/on-demand/session/gtc26-s81911/>
- Rubin GPU 架构：<https://developer.nvidia.com/blog/inside-nvidia-rubin-gpu-architecture-powering-the-era-of-agentic-ai/>
- Vera Rubin NVL72 产品页：<https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/>
- NVIDIA Dynamo 兼容矩阵：<https://docs.nvidia.com/dynamo/dev/reference/compatibility>
- Groq/NVIDIA non-exclusive licensing agreement：<https://groq.com/newsroom/groq-and-nvidia-enter-non-exclusive-inference-technology-licensing-agreement-to-accelerate-ai-inference-at-global-scale>

这些资料首次明确描述 GPU prefill/attention 与 Groq 3 LPX FFN/MoE 组成的 Attention–FFN Disaggregation，以及 LPX draft + GPU verify。它们属于产品/架构公告，不是同行评审的端到端实测论文；厂商性能投影必须保留模型、context、交互速度、精度和比较基线。

对应研究笔记：`notes/nvidia-groq3-heterogeneous-inference.md`。

## B-TT：Tenstorrent Tensix、软件栈与产品

### 架构与低层编程

- Documentation hub：<https://docs.tenstorrent.com/>
- TT-Metalium single-core architecture/matmul lab：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab1/lab1.html>
- TT-Metalium advanced topics：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/index.html>
- Memory for kernel developers：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/memory_for_kernel_developers.html>
- Compute engines/dataflow：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html>
- Multi-core NoC multicast lab：<https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/labs/matmul/lab3/lab3.html>

### 软件栈与编译器

- TT software stack overview：<https://docs.tenstorrent.com/getting-started/tt-software-stack.html>
- TT-NN：<https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/about.html>
- TT-Forge：<https://docs.tenstorrent.com/forge/index.html>
- TT-MLIR overview：<https://docs.tenstorrent.com/tt-mlir/overview.html>
- TT-MLIR tensor layout：<https://docs.tenstorrent.com/tt-mlir/specs/tensor-layout.html>
- TT-MLIR device/mesh：<https://docs.tenstorrent.com/tt-mlir/specs/device.html>

### 产品与系统

- Tenstorrent company/product home：<https://tenstorrent.com/en>
- Blackhole/Wormhole PCIe cards：<https://tenstorrent.com/en/hardware/cards>
- Galaxy Blackhole/Wormhole：<https://tenstorrent.com/en/hardware/galaxy>
- TT-Metalium product page：<https://tenstorrent.com/software/tt-metalium>
- Tenstorrent Cloud：<https://tenstorrent.com/en/hardware/cloud>
- Product support/lifecycle：<https://tenstorrent.com/en/support>
- 2026 公司、IP 与异构部署方向：<https://tenstorrent.com/newsroom/tenstorrent-sets-new-performance-records-launches-tt--ascalon-s>

当前研究以 Blackhole 为主、Wormhole 为实践与上一代对照、Grayskull 为历史背景。Tenstorrent 产品页中的性能、模型覆盖率和相对领先表述属于厂商材料，不能代替相同模型/精度/软件版本的独立 benchmark。

对应研究笔记：`notes/tenstorrent-architecture.md` 与 `notes/groq-tenstorrent-comparison.md`。

## A/B-TPU：Google TPU、OpenXLA 与 Pod 系统

### A：历史与同行评审架构

- TPU v1, ISCA 2017：<https://research.google/pubs/in-datacenter-performance-analysis-of-a-tensor-processing-unit/>
- TPU v4 supercomputer：<https://arxiv.org/abs/2304.01433>
- GSPMD：<https://arxiv.org/abs/2105.04663>
- Google GSPMD overview：<https://www.research.google/blog/general-and-scalable-parallelization-for-neural-networks/>

TPU v1 用于研究 first-generation inference ASIC、software-managed memory、deterministic execution 和 65,536-MAC matrix unit。TPU v4 用于研究 3D torus、optical circuit switch、SparseCore 和 large-scale reliability。二者都不能直接替代 TPU7x 当前产品文档。

### B：当前 Cloud TPU 架构与产品

- TPU system architecture：<https://docs.cloud.google.com/tpu/docs/system-architecture-tpu-vm>
- TPU7x Ironwood：<https://docs.cloud.google.com/tpu/docs/tpu7x>
- TPU v6e Trillium：<https://docs.cloud.google.com/tpu/docs/v6e>
- TPU v5p：<https://docs.cloud.google.com/tpu/docs/v5p>
- TPU v5e：<https://docs.cloud.google.com/tpu/docs/v5e>
- TPU v4：<https://docs.cloud.google.com/tpu/docs/v4>
- Cloud TPU performance guide：<https://docs.cloud.google.com/tpu/docs/performance-guide>
- Cloud TPU generation/product page：<https://cloud.google.com/tpu>
- Cloud TPU resource/version planning：<https://docs.cloud.google.com/tpu/docs/plan-tpus>

截至核对日期，TPU7x Ironwood 是最新可用主线。产品页已列出 TPU 8i/8t，但标记为 coming soon；在完整 architecture/configuration 文档成熟前，只登记方向，不使用相对性能投影建立机制结论。

### B：Compiler、runtime 与 custom kernel

- StableHLO specification：<https://openxla.org/stablehlo/spec>
- StableHLO compatibility：<https://openxla.org/stablehlo/compatibility>
- PJRT uniform device API：<https://openxla.org/xla/pjrt>
- PJRT C++ overview：<https://openxla.org/xla/pjrt/cpp_api_overview>
- XLA architecture/SPMD partitioner example：<https://openxla.org/xla/gpu_architecture>
- Pallas quickstart：<https://docs.jax.dev/en/latest/pallas/quickstart.html>
- Pallas design/Mosaic lowering：<https://docs.jax.dev/en/latest/pallas/design/design.html>
- Pallas TPU pipelining：<https://docs.jax.dev/en/latest/pallas/tpu/pipelining.html>
- Pallas TPU API：<https://docs.jax.dev/en/latest/jax.experimental.pallas.tpu.html>
- PyTorch/XLA documentation：<https://docs.pytorch.org/xla/master/>

对应研究笔记：`notes/google-tpu-architecture.md` 与 `notes/ai-accelerator-architecture-comparison.md`。对应教学实验：`labs/systolic_array/`。

## C：ISA 与编译器专利

### 架构与 ISA

- Tensor streaming processor architecture：<https://patents.google.com/patent/US11360934B1/en>
- Instruction format and ISA：<https://patents.google.com/patent/US11822510B1/en>
- Processor instruction dispatch configuration：<https://patents.google.com/patent/US11868804B1/en>

重点检索：`VLIW instruction`、`discrete instruction`、`functional delay`、`instruction-operand skew`、`IFetch`、`Repeat`、`SetVL`、`Sync`、`Notify`。

### 编译器与调度

- Compiler operations for TSP：<https://patents.google.com/patent/US11645226B1/en>
- Compiler operations continuation：<https://patents.google.com/patent/US12222894B2/en>
- Scheduling to reduce dependency delay：<https://patents.google.com/patent/US11868908B2/en>

重点检索：`DAG generator`、`rewrite module`、`scheduler`、`constraint optimizer`、`assembler`、`cycle accurate`、`time-space scheduling`。

## D：建议补充的通用知识

### 体系结构

- Hennessy & Patterson, *Computer Architecture: A Quantitative Approach*
- Dataflow architecture、VLIW、SIMD/vector processor、systolic array
- Scratchpad vs cache、banked SRAM、roofline model
- Network-on-chip、Dragonfly、source routing、flow control
- NVIDIA CUDA Programming Guide：<https://docs.nvidia.com/cuda/cuda-programming-guide/index.html>
- NVIDIA CUDA C++ Best Practices Guide：<https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/>
- NVIDIA Hopper Tuning Guide：<https://docs.nvidia.com/cuda/archive/13.0.0/hopper-tuning-guide/index.html>
- NVIDIA PTX ISA：<https://docs.nvidia.com/cuda/parallel-thread-execution/>
- NVIDIA CUDA asynchronous barriers：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/async-barriers.html>
- NVIDIA CUDA pipelines：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/pipelines.html>
- NVIDIA Nsight Compute Profiling Guide：<https://docs.nvidia.com/nsight-compute/ProfilingGuide/>
- NVIDIA libcu++ synchronization primitives：<https://nvidia.github.io/cccl/libcudacxx/extended_api/synchronization_primitives.html>
- NVIDIA Cooperative Groups：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cooperative-groups.html>
- NVIDIA Programmatic Dependent Launch：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/programmatic-dependent-launch.html>
- NVIDIA Stream-Ordered Memory Allocator：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/stream-ordered-memory-allocation.html>
- NVIDIA Green Contexts：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/green-contexts.html>
- NVIDIA Cluster Launch Control：<https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cluster-launch-control.html>
- NVIDIA CUDA Multi-GPU Systems：<https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/multi-gpu-systems.html>
- NVIDIA NCCL stream semantics：<https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/streams.html>
- NVIDIA NVSHMEM memory ordering：<https://docs.nvidia.com/nvshmem/api/gen/api/ordering.html>

CUDA 资料用于建立 GPU 的 work submission、block/cluster placement、warp residency、instruction issue、execution/memory pipeline，以及 convergence、scoreboard、collective、atomicity、ordering、async completion、work stealing、object lifetime 和 distributed delivery 模型，不应将 NVIDIA 某代 SM 的具体参数泛化为所有 GPU。`mbarrier`、TMA tx-count、WGMMA、Cluster Launch Control、tcgen05、cluster scope 和 proxy/fabric 扩展必须保留 PTX ISA 与 target generation 边界。

### ML 编译器

- MLIR documentation：<https://mlir.llvm.org/docs/>
- MLIR Toy tutorial：<https://mlir.llvm.org/docs/Tutorials/Toy/>
- Apache TVM：<https://tvm.apache.org/docs/>
- ONNX IR specification：<https://onnx.ai/onnx/repo-docs/IR.html>

学习这些资料的目的，是理解 graph capture、IR、canonicalization、fusion、layout、bufferization、lowering、instruction selection 和 scheduling；不要把通用 compiler 内部设计直接视为 Groq、Tenstorrent、TPU 或 GPU backend 的真实实现。

## 推荐检索词

```text
Groq TSP functional slicing
Groq compiler time-space scheduling
Groq instruction operand skew functional delay
Groq VLIW instruction queue IFetch Repeat
GroqAPI BERT operator fusion
Tenstorrent Tensix reader compute writer circular buffer
TT-Metalium NoC multicast L1 sharding
TT-MLIR tensor layout device mesh
TT-NN custom operation performance report
Blackhole Wormhole Tensix core architecture
Google TPU TensorCore MXU systolic array VMEM HBM
TPU7x Ironwood dual chiplet ICI 3D torus
XLA StableHLO PJRT GSPMD sharding
JAX Pallas Mosaic TPU VMEM pipeline
tensor streaming processor memory allocation
software scheduled Dragonfly runtime deskew
static scheduling ML accelerator compiler
operator fusion scratchpad memory planning
```

## 新资料登记模板

```markdown
### 标题

- URL / DOI：
- 来源等级：A / B / C / D
- 芯片或软件代际：
- 研究问题：
- 公开事实：
- 作者推断：
- 可复现实验：
- 与 GPU/Groq/Tenstorrent/TPU 的关系：直接 / 对比 / 背景
- 未解决问题：
```
