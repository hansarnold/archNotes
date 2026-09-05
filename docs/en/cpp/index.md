---
title: "C++ Review Cheat Sheets"
description: "A quick reference for returning C++ developers: forgotten rules, short examples, pitfalls, and self-checks across the language, STL, and tooling."
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Review", "Language Rules", "STL", "Lifetime", "Tooling"]
---

# C++ Review Cheat Sheets

For people who have written C++ and want their judgment back, not a Hello World course. Jump directly to the uncertain rule. **C++17** is the baseline; **[20] / [23]** mark newer facilities. Check language and standard-library support separately.

## Seven topics, 84 reminders

Each sheet has twelve numbered reminders: rules, short examples, boundaries, and prediction-first folded answers. Jump to the uncertain point; on a phone, use the page outline or search an API name.

| Sheet | Common gaps | IDs |
| --- | --- | --- |
| [Types, initialization, expressions](./types.md) | Const, auto, decltype, value categories, casts, evaluation order | T01–T12 |
| [Lifetime, ownership, move](./lifetime.md) | RAII, views, temporaries, NRVO, smart pointers, captures, invalidation | L01–L12 |
| [Classes and object model](./classes.md) | Special members, Rule of Zero/Five, virtual dispatch, slicing, explicit, noexcept | C01–C12 |
| [Templates, deduction, callbacks](./templates.md) | Forwarding references, collapsing, forward, dependent names, SFINAE, concepts, ADL | F01–F12 |
| [Containers and algorithms](./stl.md) | Capacity/size, erase-remove, search, sorting, accumulation, maps, proxies | S01–S12 |
| [Modern C++ and concurrency](./modern.md) | [17]/[20]/[23], optional/variant, span/ranges, threads, atomics | M01–M12 |
| [Builds, errors, debugging](./tooling.md) | ODR, inline/static, headers, UB, LLVM errors, PImpl, sanitizers | G01–G12 |

Go directly to the [C++17 / C++20 runnable checks](./tooling.md#verification) for representative verification, not proof of all 84 rules or every UB path.

## First-pass memory check

| When you see this | Recall this rule |
| --- | --- |
| [`auto x = ref`](./types.md#t03) | Usually a separate value; request an alias with `&` |
| [`decltype(x)` versus `decltype((x))`](./types.md#t04) | An unparenthesized name has special treatment; the latter follows expression category |
| [A named `T&& x` used as `x`](./types.md#t06) | An lvalue in ordinary expression contexts |
| [`std::move(x)`](./lifetime.md#l04) | A category cast; overload resolution determines the operation |
| [`std::move(const_x)`](./lifetime.md#l04) | An ordinary non-const move overload may not match, leaving a copy |
| [`return std::move(local)`](./lifetime.md#l05) | Can prevent NRVO; ordinarily return the local directly |
| [`vector<int>(4, 9)` versus `{4, 9}`](./types.md#t02) | Four nines versus two elements, four and nine |
| [Indexing after `reserve(n)`](./stl.md#s02) | Capacity is not size; reserving creates no elements |
| [`map[key]`](./stl.md#s09) | Inserts when absent; use find or [20] contains for a query |
| [`remove_if`](./stl.md#s04) | Produces a logical end, without shrinking the container |
| [A saved string_view or span](./lifetime.md#l03) | Does not own data; identify the longer-lived owner |
| [`[=]` accessing members](./lifetime.md#l11) | Can retain this as a pointer rather than snapshot the object |
| [Adding only `~T() = default`](./classes.md#c02) | A user-declared destructor can suppress implicit move generation |
| [`is_move_constructible_v<T>`](./classes.md#c02) | Copy construction may accept an rvalue; the trait does not prove a move constructor exists |
| [Sharing a shared_ptr across threads](./modern.md#m11) | Reference-count safety does not protect the pointee's state |
| [const / constexpr / consteval](./modern.md#m02) | Read-only access, constant evaluation capability, and [20] immediate functions differ |

## Review instead of restarting

Mark only rules you cannot explain. Predict type, result, ownership, and invalidation before revealing an answer. Distinguish guaranteed behavior, unspecified behavior, implementation-defined behavior, and undefined behavior.

**Four hours is a priority-review budget, not a limit on the reference library.** The AI Compiler route still totals twelve hours; these sheets remain independently useful while reading source later.

| Session | Minutes | Activity |
| --- | ---: | --- |
| A1 | 35 | Types, initialization, const, categories, and deduction |
| A2 | 35 | Lifetime, RAII, copy/move, and invalidation |
| A3 | 50 | Predict, then complete the three existing repairs |
| B1 | 30 | Classes, templates, lambdas, and LLVM utilities |
| B2 | 25 | Containers/algorithms plus ODR, exceptions, and concurrency boundaries |
| B3 | 65 | Implement or recreate the miniature pass and explain a changed condition |

Practice entries: [C++ review A](../mlir/cpp-refresh.md) and [review B: miniature pass](../mlir/cpp-labs.md). Use an already-mastered exercise as a ten-minute check and spend the remaining budget on weak areas.

## Sources and scope

The organization is inspired by [hackingcpp's Cheat Sheets](https://hackingcpp.com/cpp/cheat_sheets). This section uses original explanations, examples, and tests, not a mirror of its articles or graphics. Keep the original site as a complementary reference. Rule links point to the C++ working draft, Core Guidelines, and official LLVM material; the evolving draft must be read alongside each sheet's version labels.
