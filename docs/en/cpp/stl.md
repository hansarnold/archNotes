---
title: "C++ STL Containers, Algorithms, and Strings"
description: "Twelve standard-library reminders on container choice, capacity, invalidation, erase-remove, searching, output iterators, sorting, accumulation, and map insertion."
outline: deep
products: ["C++", "LLVM"]
documentType: "Cheat Sheet"
topics: ["STL", "Containers", "Algorithms", "Strings", "Complexity"]
---

# STL Containers, Algorithms, and Strings

[Review index](./index.md) · **Prioritize S02–S09.** Ask about preconditions, valid result ranges, and lifetime before complexity.

## S01 · Select containers by access pattern {#s01}

| Container | Useful property | Cost or limitation |
| --- | --- | --- |
| vector | Contiguous, random access, traversal baseline | Middle edits move elements; growth can invalidate |
| deque | Growth at both ends, random access | Not globally contiguous; operation-specific invalidation |
| list / forward_list | Stable nodes and edits at known positions | Allocation and pointer chasing; finding positions still costs time |
| map / set | Ordered keys and tree lookup | Typically logarithmic; comparison defines key equivalence |
| unordered_map / set | Average constant-time hash lookup | Worst-case linear, rehash, unstable iteration order |
| array | Fixed-size contiguous elements | Size is part of the type |

Equal asymptotic complexity does not imply equal measured speed. Caches, allocation, element size, and workload matter.

## S02 · Reserve, resize, and emplacement differ {#s02}

```cpp
std::vector<int> v;
v.reserve(100);                 // size remains zero
v.resize(3);                    // three initialized ints
v.emplace_back(7);              // size becomes four
```

Emplacement constructs from arguments at the destination; it is not necessarily faster than push_back. Passing an already-created T temporary can still move it. Reserved capacity is not permission to access nonexistent elements.

## S03 · Invalid references and changed indices are separate hazards {#s03}

Reallocation may invalidate addresses; erasure may also change the meaning of a stored integer index. Use independent IDs if identity must survive vector edits. See the [invalidation table](./lifetime.md#l10).

## S04 · Erase-remove has two steps {#s04}

```cpp
auto newEnd = std::remove_if(v.begin(), v.end(), [](int x) { return x < 0; });
v.erase(newEnd, v.end());
// [20] std::erase_if(v, [](int x) { return x < 0; });
```

Remove_if compacts retained elements and returns a logical end. Remaining tail elements are still valid but have unspecified values; size is unchanged until erase. Do not interpret the old full range as retained results.

## S05 · Find and lower_bound have different preconditions {#s05}

Find can scan linearly without sorting. Lower_bound requires partitioning by the applicable predicate; a sorted range commonly satisfies it. Its result is the first position not less than the target, possibly end. Check the result and equivalence before claiming a match or dereferencing.

## S06 · Output algorithms do not automatically resize vectors {#s06}

```cpp
std::vector<int> out;
std::copy(v.begin(), v.end(), std::back_inserter(out));
// copying into out.begin() while out is empty is unsafe
```

Alternatively resize the destination first; reserve alone is insufficient. Overlap rules vary by algorithm. Select forward or backward copying/moving according to direction and contract.

## S07 · Sorting, uniqueness, and comparator contracts {#s07}

```cpp
std::sort(v.begin(), v.end());
v.erase(std::unique(v.begin(), v.end()), v.end());
```

Unique removes adjacent equivalents, not arbitrary global duplicates. Sorting changes order; stable_sort preserves order among equivalent elements. Comparators need a strict relation, not <=. NaN-containing floating data also needs an intentional ordering policy rather than assuming ordinary < satisfies the required relation over that domain.

## S08 · Accumulate's initial value selects its accumulator type {#s08}

```cpp
std::vector<double> costs{0.5, 1.5};
auto wrong = std::accumulate(costs.begin(), costs.end(), 0);   // int accumulator
auto total = std::accumulate(costs.begin(), costs.end(), 0.0); // double
```

A narrow integer accumulator can overflow. [17] Reduce permits regrouping/reordering and can change floating results. Parallelism does not make an operation associative; SIMD, FMA, and fast-math still need numerical contracts.

## S09 · Query, insert, and overwrite maps intentionally {#s09}

| Intention | Interface | Reminder |
| --- | --- | --- |
| Query without insertion | find / at / [20] contains | at throws on absence; check find against end |
| Construct mapped value only if absent | try_emplace [17] | Argument expressions are still evaluated before the call |
| Overwrite or insert | insert_or_assign [17] | Changes existing values |
| Obtain a writable slot | operator[] | Inserts a default value if missing |

Try_emplace(key, expensive()) still calls expensive. True lazy computation needs another decision point, with appropriate synchronization when concurrent.

## S10 · `vector<bool>` does not provide ordinary bool references {#s10}

It may pack bits and expose proxy references. `auto bit = flags[0]` can preserve a proxy rather than snapshot a bool; use `bool bit` for a value. Generic code must not assume every container reference is T& or that `vector<bool>` exposes a contiguous ordinary bool array.

## S11 · String and string_view substr return different ownership {#s11}

String::substr returns owned characters; string_view::substr returns a view. Saving a string_view directly from a temporary name.substr(1) dangles. Taking substr on a view of a longer-lived name avoids that temporary but still depends on stable backing storage.

Find's npos is an unsigned sentinel, not an ordinary valid index. Size minus one also underflows for an empty string. Check absence and emptiness first.

## S12 · Count iterator movement as well as comparisons {#s12}

Generic lower_bound over non-random-access iterators can make logarithmically many comparisons yet linearly many iterator increments. Map::lower_bound uses the tree structure. Prefer an appropriate member operation when available. LLVM SmallVector and DenseMap represent additional tradeoffs, not universally superior std replacements.

### Predict before revealing

1. Does reserve(100) on an empty vector create one hundred writable elements?
2. Does unique remove every duplicate value?
3. Does an existing key prevent evaluation of expensive() passed to try_emplace?

::: details Check your answers
Does reserve make one hundred writable elements? No. Does unique globally deduplicate? Only adjacent equivalents. Does an existing key prevent evaluation of expensive() passed to try_emplace? No.
:::

References: [containers](https://eel.is/c++draft/container.requirements.general), [removal](https://eel.is/c++draft/alg.remove), [binary search](https://eel.is/c++draft/alg.binary.search), [map modifiers](https://eel.is/c++draft/map.modifiers), [numeric operations](https://eel.is/c++draft/numeric.ops).
