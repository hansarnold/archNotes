# C++ review probes

These probes accompany the [Chinese](../../docs/cpp/index.md) and [English](../../docs/en/cpp/index.md) review sheets. They are for returning developers, not a first programming course. Run from the repository root:

```sh
python3 -B labs/cpp_review/run.py --std 17
python3 -B labs/cpp_review/run.py --std 20
python3 -B labs/cpp_review/run.py --std all
```

Use a compiler with the requested standard and a matching standard library; set `CXX` to select one. Binaries use a temporary directory and are removed after the run. Compilation has a 120-second limit; each executable has a 30-second limit. Timeouts and unavailable features fail explicitly. No GPU, MLIR build, or third-party Python packages are required.

## Coverage

- `probe17.cpp`: type deduction assertions, initialization, widening arithmetic, structured bindings, named rvalue references, copy/move selection, move traits, guaranteed elision, unique/shared/weak ownership, slicing, lambda captures, forwarding, borrowed returns, erase-remove, capacity, output iterators, sorting/uniqueness, binary search, accumulation type, map argument evaluation, vector<bool> proxies, live string views, optional/variant, and a joined atomic-counter example.
- `probe20.cpp`: constrained templates, consteval/constinit, span element constness, range filtering over live storage, erase_if, and mixed-sign comparison. It deliberately does not reuse a filtered view after structural mutation.
- `negative.cpp`: six isolated expected compiler rejections for copying unique_ptr, mutation through pointer-to-const, list narrowing, passing an lvalue to an ordinary rvalue reference, implicit explicit-constructor conversion, and selecting an explicitly deleted move constructor. Positive probes compile first; rejection checks use syntax-only compilation and require normal compiler diagnostics.

These checks illustrate selected rules, not dynamic proof of all 84 entries. No dangling dereference, invalid vector indexing, data race, or overflowing signed arithmetic is deliberately executed. C++23 facilities, coroutine lifetime, subtle memory-order protocols, and platform sanitizers remain reference/code-review material, not claimed runtime coverage. The atomic counter demonstrates atomic updates after joining, not proof of every concurrent algorithm.

The existing [repair and mini-pass labs](../compiler_bootcamp/README.md) remain the hands-on part of the four-hour review budget.
