---
title: "A Miniature C++ Constant Folding Pass"
description: "Review classes, templates, lambdas, and LLVM utility types while implementing and validating a small constant folding pass."
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Hands-on Lab"
topics: ["Constant Folding", "Templates", "Lambda", "Verification", "IR"]
---

# A Miniature C++ Constant Folding Pass

Part of [C++ review](../cpp/index.md), session B, 120 minutes: classes/templates/LLVM utilities 30, STL and error boundaries 25, pass implementation/validation/explanation 65. Complete [C++ Review A](./cpp-refresh.md) first.

Look up gaps in [classes](../cpp/classes.md), [templates and callbacks](../cpp/templates.md), [STL](../cpp/stl.md), and [builds/errors/debugging](../cpp/tooling.md). Focus on special members, forwarding references, invalidation, accumulate's initial type, and LLVM Error handling obligations. [Modern C++ and concurrency](../cpp/modern.md) is an independent reference; this exercise need not become concurrent.

## Syntax found in compiler code

| Construct | Interpretation | Required depth |
| --- | --- | --- |
| `enum class Kind` | Scoped enumeration | Select `Kind::Add` |
| `explicit C(T x)` | Restrict implicit construction | Distinguish construction from a function call |
| `virtual` / `override` | Dynamic interface and override checking | Check destruction when deleting through a base pointer |
| `template<class F>` | Instantiate code for types | Locate the parameter and instantiation |
| `using Base::Base` | Inherit constructors | Recognize common pattern-class scaffolding |
| `[&]`, `[=]`, `[x]` | Lambda capture | Determine what is borrowed/copied and whether it escapes |
| `std::optional<T>` | A value that may be absent | Check before dereferencing |

A callback that retains a reference to a local can dangle after return. Immediate traversal and retained/asynchronous callbacks have different contracts. Capturing a pointer by value does not copy its pointee.

## Read a template's call relationships

```cpp
template <class Fold>
int testPass(Fold fold) {
  Graph graph = makeExample();
  auto changed = fold(graph);
  return changed == 1 ? 0 : 1;
}
```

This syntax sketch uses `makeExample` as a placeholder. The executable `testPass` in `mini_ir.hpp` constructs actual fixtures, calls the provided transformation, and verifies results. Follow types and calls before studying advanced template metaprogramming.

## The complete teaching IR contract

Nodes are Constant, Input, or Add. A `vector<Node>` stores dependencies before their users; every Add refers to earlier indices. The final node is the output, and every Input reads the same external input value.

Arithmetic is checked signed i64: overflow is rejected. This is deliberately different from MLIR `arith.addi` modulo semantics. A compiler must implement its IR's rules without relying on undefined host-language behavior.

```text
%0 = constant 2
%1 = constant 3
%2 = add %0, %1
%3 = input
%4 = add %2, %3
```

This is a teaching notation, not parseable MLIR. With external input 7, the result is 12.

## Implement the transformation

```sh
python3 labs/compiler_bootcamp/run_cpp.py fold
```

The starter compiles but fails the folding check. Implement `foldConstants(Graph&)` in [fold.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/fold.cpp): verify first, visit Add nodes in order, use `checkedAdd` only for two constants, replace the current node on success, and return the change count. Preserve variable-dependent and overflowing additions and keep indices stable.

Do not erase or append nodes in this exercise. Fixed storage keeps the task focused and avoids reference/index invalidation. Real MLIR replacements must use its rewriter APIs; the teaching container is not a substitute for those contracts.

::: details First hint
Use `auto&` to mutate original nodes. Read the operands using their indices, inspect kinds, then check the optional result of `checkedAdd` before replacement.
:::

::: details Why can one traversal fold a constant chain?
Operands refer to earlier nodes, so an upstream Add may already have become a Constant. This graph contains no cycles or topology changes. General IR may require a worklist, dataflow analysis, or iteration.
:::

::: details Complete core solution
```cpp
std::size_t foldConstants(Graph &graph) {
  verify(graph);
  std::size_t changed = 0;
  for (auto &node : graph) {
    if (node.kind != Kind::Add) continue;
    const auto &lhs = graph[node.lhs];
    const auto &rhs = graph[node.rhs];
    if (lhs.kind != Kind::Constant || rhs.kind != Kind::Constant) continue;
    const auto sum = checkedAdd(lhs.value, rhs.value);
    if (!sum) continue;
    node = Node{Kind::Constant, *sum};
    ++changed;
  }
  return changed;
}
```
The [reference source](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/fold_solution.cpp) includes the executable harness.
:::

## Verify more than printed output

Checks cover the expected constant, retained input-dependent work, equal results for 21 inputs, transitive folding, negative constants, fixed points, both overflow directions, and malformed dependencies.

```sh
python3 labs/compiler_bootcamp/run_cpp.py fold
python3 labs/compiler_bootcamp/run_cpp.py fold --sanitize
```

Run `fold_solution` to inspect the reference implementation. These checks provide evidence for the covered contract, not a formal proof of arbitrary compiler correctness.

Then replace one Constant with an Input. Predict which fold becomes unavailable and explain why your pass remains valid. Do this independently of the reference answer.

## Bridge to LLVM and MLIR utilities

| Type or utility | Mental model | Concern |
| --- | --- | --- |
| `StringRef` | Non-owning character range | Underlying characters must survive |
| `ArrayRef<T>` | Non-owning contiguous element range | Container changes can invalidate access |
| `SmallVector<T>` | Vector with inline storage for small sizes | Growth and mutation may still invalidate references |
| `isa<T>` / `dyn_cast<T>` | Type test / attempted cast | Handle mismatch and null according to the API |
| `function_ref` | Non-owning callable reference | Usually immediate use; do not retain casually |
| `LogicalResult` | Success/failure status | Not the computed numerical value |

In [MLIR Toy Chapter 3](https://mlir.llvm.org/docs/Tutorials/Toy/Ch-3/), identify a match condition, replacement, and failure return. Relate them to this exercise before following framework implementation details.

## Five exit questions

Who owns the graph? Why is `auto&` necessary? Why avoid arbitrary growth during traversal? Why not directly evaluate `INT64_MAX + 1` in C++? Why does shorter IR not prove a speedup?

Return to the [C++ review index](../cpp/index.md) to choose the next weak area. Consult the [LLVM manual](https://llvm.org/docs/ProgrammersManual.html) and [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) for utility and ownership details.

## Review discussion {#review-discussion}

Explain these after finishing the exercises; they belong to language review rather than the Compiler concept exam.

### 1. What is easily misread about auto, references, and move?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

Iteration by value generally modifies a copy; iteration by reference can modify the original. References and string views do not own underlying objects, so lifetime matters. `std::move` changes an expression's category to enable move overloads; it does not transfer resources itself. A const input commonly selects a copy because an ordinary move constructor needs a non-const rvalue reference.

Follow-up: can you read a moved-from object? Consult its guarantees and the operation's preconditions. Standard-library objects generally remain valid but unspecified; an emptied source after unique_ptr move construction is a specific guarantee, not a universal property of user-defined types.

Misconception: const automatically prolongs a referenced object's lifetime, or every moved-from object must be empty.

</details>

### 2. Why are vector edits during traversal risky?

<details>
<summary>Reference answer, follow-up, and misconception</summary>

Erase invalidates iterators and references at or after the erased position; continue with its returned iterator. A push_back that reallocates invalidates existing element pointers, references, and iterators. Reserve is not a universal safety guarantee for arbitrary mutation.

Follow-up: why does the miniature pass replace nodes without erasing them? Position is the node ID, so erasure shifts later nodes and corrupts operand indices. Real IR must maintain use-def relationships through appropriate transformation APIs.

Misconception: an address that appears unchanged establishes that access remains legal.

</details>
