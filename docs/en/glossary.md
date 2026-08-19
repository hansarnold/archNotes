---
title: Glossary
description: Canonical English technical terminology and layer boundaries used throughout archNotes.
outline: deep
products: ["Cross-architecture"]
documentType: "Shared reference"
topics: ["Terminology", "Layer boundaries", "Execution model"]
---

# Glossary

This page is the terminology contract for the entire repository. Terms, acronyms, capitalization, API names, ISA names, and metric names remain in canonical English in every locale. The [Chinese Glossary](../glossary.md) uses the same inventory with Chinese explanations.

## Model and Workload

| Canonical term | Definition |
| --- | --- |
| **Workload** | The fixed model, Operations, Tensor Shapes, batch, sequence length, Data Types, execution phase, and system boundary used for an analysis. |
| **Operation** | A compute or Data Movement unit with explicit inputs, outputs, and semantics in a model graph or Intermediate Representation. |
| **Tensor Shape** | The size and meaning of each tensor dimension; it directly affects parallel granularity, Working Set, and Tile boundaries. |
| **Data Type (dtype)** | A numeric representation, including storage format, compute precision, and accumulation precision. |
| **Dependency** | A prerequisite that must be satisfied before an Operation, task, or data item can proceed. |
| **Persistent State** | State that survives across Operations or requests, such as weights, KV Cache, and optimizer state. |
| **Prefill** | The autoregressive inference phase that processes existing input tokens and builds the KV Cache. |
| **Decode** | The autoregressive inference phase that generates new tokens while reading and extending the KV Cache. |
| **Mixture of Experts (MoE)** | A model structure that routes each token to a subset of experts, introducing dynamic Workload, Load Imbalance, and Communication. |

## Compute and Units of Work

| Canonical term | Definition |
| --- | --- |
| **Tile** | A partitioned unit of data or work; it does not represent the same hardware level across GPU, Groq, Tensix, and TPU systems. |
| **Tensor Core / Matrix Multiply Unit (MXU)** | A Compute Unit for matrix or tensor Operations; implementations and surrounding pipelines are not equivalent merely because their names are similar. |
| **Streaming Multiprocessor (SM)** | An NVIDIA GPU multiprocessor containing Warps, registers, Shared Memory, schedulers, and Execution Pipelines. |
| **Functional Slice** | A function-specific datapath partition in a Groq TSP coordinated by a Static Instruction Stream. |
| **Tensix Core** | A programmable core in a Tenstorrent mesh with Local SRAM, Data Movement RISC-V processors, and tensor/vector compute. |
| **Systolic Array** | An array in which data propagates and accumulates through Processing Elements (PEs) according to a regular schedule. |
| **Reduction** | An Operation that combines many elements into fewer results, such as sum, max, or normalization statistics. |
| **Arithmetic Intensity** | The ratio of Operation count to actual Data Movement bytes at a specified memory level. |

## Scheduling and Execution

| Canonical term | Definition |
| --- | --- |
| **Single Instruction, Multiple Threads (SIMT)** | A GPU Execution Model in which threads share an instruction stream and typically issue in Warps. |
| **Warp** | A group of NVIDIA GPU threads that issue instructions together and provide a key unit for dynamic Latency Hiding. |
| **Static Scheduling** | A plan that assigns timing, Placement, or resources at compile time; it does not imply that the system has no Runtime. |
| **Dynamic Scheduling** | Selecting the next work item at execution time according to readiness, resource availability, or priority. |
| **Latency Hiding** | Covering wait time with other executable work, Pipeline Overlap, or Wavefronts rather than eliminating Latency itself. |
| **Occupancy** | The relationship between resident GPU work and register, Shared Memory, thread, and architecture limits; it is not equivalent to Utilization. |
| **Backpressure** | Blocking propagated to an upstream producer when a downstream buffer or Pipeline Stage cannot accept more data. |
| **Wavefront** | A moving front of Dependency-satisfied work across an array or execution space. |
| **Critical Path** | The longest time-weighted path through a Dependency graph, which determines minimum Completion time. |
| **Pipeline Overlap** | Concurrent compute, Data Movement, or Communication when Dependencies and resources allow it. |

## Memory and Data Movement

| Canonical term | Definition |
| --- | --- |
| **Cache** | A storage level managed by hardware or software policy to exploit locality; visibility and replacement semantics are architecture-specific. |
| **Scratchpad / Local SRAM** | Explicitly software-managed on-chip storage, distinct from a transparent Cache. |
| **Shared Memory** | NVIDIA GPU on-chip memory explicitly managed by a program and shared by threads in a Cooperative Thread Array (CTA). |
| **Circular Buffer (CB)** | A bounded-buffer protocol used by Tensix Kernels to exchange Tiles and express capacity and Ownership. |
| **High Bandwidth Memory (HBM)** | Off-chip memory designed for high aggregate bandwidth; any bandwidth value must be tied to a generation, configuration, and measurement boundary. |
| **Vector Memory (VMEM)** | A software-managed memory level inside a TPU TensorCore that feeds vector and matrix compute. |
| **Network on Chip (NoC)** | A network connecting cores, SRAM, or functional units within a chip. |
| **Data Movement** | Transfer of data across registers, on-chip memory, HBM, a NoC, or an interconnect. |
| **Reuse** | Using the same data for multiple Operations or Tiles before it leaves the current storage level. |
| **Working Set** | The parameters, activations, state, and temporary buffers that must be simultaneously available during an execution interval. |

## Synchronization and Ownership

| Canonical term | Definition |
| --- | --- |
| **Barrier** | A synchronization object at which participants rendezvous at a phase boundary; it does not replace every memory-order requirement. |
| **Fence** | A constraint on the order or visibility of selected memory accesses; it normally does not provide participant rendezvous. |
| **Event** | A Runtime object that records task Completion and establishes downstream Dependencies. |
| **Completion** | Proof that work has completed at a particular system level; issue, execution finish, memory visibility, and remote delivery are distinct points. |
| **Ownership** | The producer, consumer, or Pipeline Stage currently allowed to read, write, or reuse data, buffers, and resources. |
| **Collective Communication** | A Communication Operation involving multiple devices, such as All-Reduce; cost and Completion semantics depend on topology, Runtime, and API. |

## Compiler and Software Stack

| Canonical term | Definition |
| --- | --- |
| **Intermediate Representation (IR)** | A Compiler representation of program semantics, Dependencies, layout, or target Operations at a particular abstraction level. |
| **Lowering** | Progressively converting a high-level graph or Operation into IR and Operations closer to the target hardware. |
| **Fusion** | Combining Operations or loops to reduce intermediate materialization, Kernel Launches, and Data Movement. |
| **Tiling** | Partitioning a tensor or iteration space into Tiles that fit parallel execution and storage capacity. |
| **Bufferization** | Mapping tensor values to buffers with explicit storage, lifetime, and aliasing semantics. |
| **Memory Planning** | Assigning buffer Placement, size, lifetime, and Reuse at compile time or Runtime. |
| **Placement** | Assigning an Operation, Tile, buffer, or task to a specific core, device, or memory location. |
| **Sharding** | Distributing a Workload across execution resources by tensor dimension, Operation, or state. |
| **Kernel** | A program unit executed on a target device; its boundary, launch model, and specialization depend on the architecture and Runtime. |
| **Runtime** | The software layer responsible for program loading, submission, Dependencies, memory lifetime, and device coordination. |
| **Parallel Runtime Interface (PJRT)** | The XLA ecosystem Runtime interface connecting compiled programs to device execution. |
| **TT-Metalium** | Tenstorrent's low-level programming environment for controlling cores, Kernels, buffers, and the NoC. |

## Optimization and Co-design

| Canonical term | Definition |
| --- | --- |
| **Bottleneck** | The dominant resource or Critical Path component limiting an end-to-end objective within the current boundary. |
| **Compute-bound** | A condition in which Runtime is primarily limited by effective compute throughput. |
| **Memory-bound** | A condition in which Runtime is primarily limited by effective bandwidth or access behavior at a specified memory level. |
| **Capacity-bound** | A condition in which the Working Set exceeds available capacity and forces changes such as smaller batches, paging, Sharding, recomputation, or a different Data Type. |
| **Quantization** | Representing weights, activations, or state at lower precision under an explicit scaling, rounding, and accumulation contract. |
| **Model–Hardware Co-design** | Jointly changing model structure, numerics, software mapping, or a hardware contract to remove a constraint that local Optimization cannot adequately resolve. |
| **Roofline Model** | A model that combines Arithmetic Intensity, effective compute rate, and effective bandwidth to estimate a performance upper bound or Runtime lower bound. |

## Serving and Validation

| Canonical term | Definition |
| --- | --- |
| **Time to First Token (TTFT)** | Elapsed time from request arrival until the first output token becomes visible. |
| **Inter-token Latency (ITL)** | Elapsed time between adjacent output tokens during streaming generation. |
| **Service-Level Objective (SLO)** | A service target for metrics such as Latency, throughput, availability, or quality. |
| **Utilization** | The fraction of a measurement interval in which a resource performs useful work; the denominator and observation boundary must be stated. |
| **Effective Bandwidth** | The Data Movement rate actually achieved by a Workload at a specified boundary, rather than an interface peak specification. |
| **Experiment Contract** | A record that fixes the question, Workload, prediction, control, metrics, and falsification criterion before measurement. |

## Evidence Boundary

The repository follows the evidence rules in the [Source Catalog](../sources/catalog.md). It distinguishes peer-reviewed results, official specifications, open-source behavior, patent embodiments, and teaching inferences while preserving generation, Data Type, Tensor Shape, topology, and system boundaries.
