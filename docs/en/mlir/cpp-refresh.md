---
title: "C++ Review A: Find Gaps and Repair"
description: "Recover code reasoning through values, references, ownership, lifetime, copy/move, and container invalidation with executable examples and repairs."
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Review and Practice"
topics: ["Ownership", "Lifetime", "Move Semantics", "Containers", "Debugging"]
---

# C++ Review A: Find Gaps and Repair

Part of [C++ review](../cpp/index.md), session A, 120 minutes: types/deduction 35, lifetime/move 35, diagnostics/repairs/explanation 50. This is for returning C++ developers; skip familiar explanations and use the time on uncertain rules.

Start with [T01–T12: types and expressions](../cpp/types.md), especially auto, decltype, value categories, and initialization. Then review [L01–L12: lifetime and move](../cpp/lifetime.md). The three repairs below are an exit check, not the scope of C++ review. See the [complete 84-reminder index](../cpp/index.md).

## Ten-minute diagnostic

Explain whose object a range-for `auto` variable modifies, distinguish `const T*` from `T* const`, identify who keeps a `string_view`'s bytes alive, say what `std::move` itself does, distinguish vector size from capacity, and predict invalidation after `push_back`.

Mark uncertainty and spend more time on those points. Each recovered rule needs a concrete example.

## Values, references, pointers, and auto

```cpp
std::vector<int> nodes{1, 2, 3};
for (auto node : nodes) node += 10;
for (auto &node : nodes) node += 10;
```

The first loop changes copies; the second binds original elements. `const auto&` avoids copying and prevents modification through that reference. `auto` alone does not infer a reference for this declaration.

| Parameter | What is provided | Typical role |
| --- | --- | --- |
| `T value` | Independent parameter object, copied or moved | Small value or owned data |
| `const T& value` | Read-only access to an existing object | Borrowed input without an ownership transfer |
| `T& value` | Writable access to an existing object | Modify the caller's object |
| `T* value` | Potentially null address | Optional access; syntax alone does not establish ownership |

`const T*` restricts changes through the pointer; `T* const` prevents changing the pointer's address. Constness does not imply global immutability through every alias or thread safety.

::: details Can a function retain a const reference argument?
Only if the referenced object outlives every later use. Valid access during the call is insufficient. Copy, transfer ownership, or explicitly require a longer-lived caller object when retaining data.
:::

## Ownership and lifetime

Ownership identifies responsibility for a resource; lifetime identifies when an object exists. RAII associates release with destruction: `unique_ptr` manages an object, `vector` its element storage, and `lock_guard` a lock.

Use `unique_ptr` for exclusive ownership; it moves but does not copy. Shared ownership with `shared_ptr` introduces reference-count and cycle considerations. References, pointers, and views borrow access and need an explicit lifetime relationship.

This is a review-only error example; do not rely on whether it happens to run:

```cpp
std::string_view brokenName() {
  std::string local = "matmul";
  return local; // Dangling view after local is destroyed.
}
```

Returning an owning `std::string` is one repair. Copying a view copies access to a range, not its characters, and does not extend the underlying lifetime.

A compiler's lightweight operation/value handle can similarly depend on an underlying IR object. Copyability does not mean the handle remains valid after that object is erased.

## Copy, move, and Rule of Zero

`std::move` changes an expression's type category for overload selection. The selected constructor or assignment determines what actually moves.

```cpp
Tracked source{"tensor"};
Tracked copied{source};
Tracked moved{std::move(source)};
const Tracked frozen{"weight"};
Tracked fromConst{std::move(frozen)};
```

Predict copies and moves, then execute from the repository root:

```sh
python3 labs/compiler_bootcamp/run_cpp.py semantics
```

::: details Expected observations
```text
by value: 1
by reference: 11
copy
move
copy
owner empty: true
new owner: owned
```
The example's move constructor accepts `Tracked&&`, which cannot bind a const rvalue; the last construction therefore copies. Moving a `unique_ptr` leaves its source null. Other moved-from types follow their own contract, so do not assume every moved object becomes empty.

The intentionally modified-but-unused copy in the first loop may produce a warning. That warning illustrates the mistake; it is not an execution failure.
:::

Prefer resource-owning members such as strings, vectors, and smart pointers so a class needs no custom destructor/copy/move machinery: the Rule of Zero. Fill in the details with [special-member generation and Rule of Five](../cpp/classes.md#c02), [noexcept](../cpp/classes.md#c12), [copy elision / NRVO](../cpp/lifetime.md#l05), and [perfect forwarding](../cpp/templates.md#f05). Predict a concrete example before looking up the rule.

## Invalidation after container changes

| Operation | Consequence to retain |
| --- | --- |
| `vector.reserve(n)` | Capacity floor, not size; reallocation invalidates element pointers, references, and iterators |
| `vector.resize(n)` | Changes size and constructs/destroys elements; may reallocate |
| `vector.push_back` | Reallocation invalidates all element access; without it existing element access remains, but old `end()` is invalid |
| `vector.erase(it)` | Invalidates iterators/references at and after the erased position; returns the successor |
| `unordered_map` rehash | Invalidates iterators, generally retaining existing element pointers/references; erasing an element invalidates access to it |

Reason about iterator validity before changing a container during traversal. Reserving capacity is not a universal guarantee that arbitrary mutations are safe.

::: details Why can erasing adjacent negative values skip one?
The next element moves into the erased position. An unconditional increment then skips it. Assign `it = values.erase(it)` on deletion and increment only when retaining an element.
:::

## Three repairs

The initial run deliberately reports a TODO:

```sh
python3 labs/compiler_bootcamp/run_cpp.py repairs
```

Implement [repairs.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/repairs.cpp): prefix original names with `op.`, retain an owning name from a temporary view, and remove all negatives including adjacent/final elements and empty input.

The starter throws rather than executing dangling accesses. Behavioral tests do not replace an ownership and invalidation review.

::: details Hints after an independent attempt
Use a writable reference for the loop, return an owning string, and continue from erase's returned iterator. Re-run after each function to see the failure advance.
:::

::: details Reference implementation
Read [repairs_solution.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/repairs_solution.cpp) only after attempting the tasks.
```sh
python3 labs/compiler_bootcamp/run_cpp.py repairs_solution
python3 labs/compiler_bootcamp/run_cpp.py repairs_solution --sanitize
```
The optional ASan/UBSan run requires a supporting toolchain. A clean run alone cannot establish safety of every path; explain data ownership as well.
:::

## Explain one change

Choose a changed line and explain object location, copies, invalidating operations, and verification. Continue with the Day 2 [miniature C++ pass](./cpp-labs.md) for classes, templates, lambdas, and LLVM utilities.

Sources: [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines), [LLVM programming conventions](https://llvm.org/docs/ProgrammersManual.html), and [vector modifier rules in the C++ draft](https://eel.is/c++draft/vector.modifiers).
