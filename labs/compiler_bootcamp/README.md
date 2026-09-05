# AI Compiler and C++ bootcamp labs

Core labs require Python 3 and a C++17 compiler (`c++`, or set `CXX`). They run on a CPU; no PyTorch, GPU, MLIR build, or third-party Python package is required. Commands below run from the repository root.

## Numerical and analytical observations

```sh
python3 labs/compiler_bootcamp/workload.py model
python3 labs/compiler_bootcamp/workload.py mapping
python3 labs/compiler_bootcamp/workload.py mapping --buffers 1
python3 labs/compiler_bootcamp/workload.py mapping --tile-m 64 --tile-n 64
python3 labs/compiler_bootcamp/workload.py quant
python3 -m unittest discover -s labs/compiler_bootcamp -p 'test_*.py'
```

`model` verifies a tiny MatMul/bias/ReLU numerically using Python arithmetic. Its traffic ledger is analytical, not a measured GPU memory counter. `mapping` uses a hypothetical target: FP16 operands, FP32 accumulator, 32 KiB usable SRAM, 256 operations/cycle, one DMA load queue at 8 bytes/cycle with 80-cycle setup per combined A+B transfer. It schedules ONE output tile's K chunks and one final store. Alignment, bank conflicts, multiple output tiles, and calibrated silicon timing are outside this model. `quant` uses nearest/ties-to-even rounding and signed INT8 saturation.

## C++ prediction and exercises

```sh
python3 labs/compiler_bootcamp/run_cpp.py semantics
python3 labs/compiler_bootcamp/run_cpp.py repairs
python3 labs/compiler_bootcamp/run_cpp.py fold
```

The `repairs.cpp` and `fold.cpp` starters compile but intentionally fail their checks until the TODOs are implemented. Edit only those exercise files for learner work. `semantics.cpp` runs without modification. Binaries are built in temporary directories and cleaned up afterward.

Only after attempting the tasks, inspect and run reference solutions:

```sh
python3 labs/compiler_bootcamp/run_cpp.py solutions
python3 labs/compiler_bootcamp/run_cpp.py solutions --sanitize
```

ASan/UBSan are optional and require a supporting compiler/runtime. The runner limits compilation to 120 seconds and each executable to 30 seconds; timeout exits with code 124 and is not a passing test. The repair starter avoids executing the dangling-pointer examples discussed in the website. The fixed code is executable; observing no crash alone cannot prove that a dangling access is valid.

The miniature graph uses checked signed i64 addition. It deliberately differs from MLIR `arith.addi` modulo arithmetic. Overflowing constants remain an Add and the interpreter still rejects overflow. The pass preserves node indices and never erases nodes or changes graph topology. Tests cover variable paths, transitive folding, negative values, both overflow directions, fixed points, and invalid dependencies.

## Optional real MLIR

```sh
mlir-opt labs/compiler_bootcamp/01-canonicalize.mlir -canonicalize
mlir-opt labs/compiler_bootcamp/02-cse.mlir -cse
```

Record `mlir-opt --version` with the output. Canonicalization and CSE are isolated so one does not hide the other's effect. The website labels expected IR as explanatory reference output, not as a captured run on the reader's installation.

See the paired [Chinese route](../../docs/mlir/bootcamp.md) and [English route](../../docs/en/mlir/bootcamp.md) for timing, explanations, hints, and discussion exercises.
