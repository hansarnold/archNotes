---
title: "Modern C++ and Concurrency Reminders"
description: "Twelve review points on language versions, constant evaluation, optional, variant, span, ranges, coroutines, threads, locks, and atomic ordering."
outline: deep
products: ["C++"]
documentType: "Cheat Sheet"
topics: ["Modern C++", "Concurrency", "Ranges", "Atomics", "Library Versions"]
---

# Modern C++ and Concurrency

[Review index](./index.md) · **Consult as needed.** Concurrent programs require whole-program synchronization reasoning; a sheet is not a substitute for validation.

## M01 · Standard year and implementation support differ {#m01}

| Standard | Representative facilities here |
| --- | --- |
| C++17 | Structured bindings, if constexpr, optional, variant, string_view, scoped_lock, inline variables |
| C++20 | Concepts, span, ranges, jthread, consteval, constinit, format, coroutines |
| C++23 | Expected, print, move_only_function, mdspan, to_underlying |

Selecting a language mode does not ensure every corresponding library facility exists. Use feature-test macros and small compile probes. Do not silently substitute an older interface with different semantics.

## M02 · Distinguish four constant-related keywords {#m02}

| Keyword | Meaning |
| --- | --- |
| const | Restricts mutation; initialization need not be compile-time |
| constexpr variable | Appropriate constant initialization and constness |
| constexpr function | Can participate in constant evaluation, but can also run at runtime |
| consteval [20] | Immediate function with applicable calls required to produce constant expressions |
| constinit [20] | Constant initialization for static/thread storage, not later immutability |

Optimization into a constant is different from satisfying a language-level constant-expression requirement.

## M03 · Optional absence is not a default value {#m03}

```cpp
std::optional<int> result;
if (result) use(*result);
int fallback = result.value_or(0);
```

Value() throws on absence; dereference requires engagement first. Value_or(expensive()) still evaluates its argument. Within this reference's C++17–23 scope, optional does not directly store T&; consider reference_wrapper or an explicit pointer contract. Do not backport newer working-draft extensions into older language modes.

## M04 · Variant and any solve different problems {#m04}

[17] Variant represents a known set of alternatives and commonly uses visit. Get on the wrong alternative throws; get_if can return null. A variant can become valueless_by_exception. Any type-erases an open set of copyable stored types; any_cast still needs the right type. Neither removes responsibility for type correctness.

## M05 · Span is a view, not a smaller vector {#m05}

```cpp
void increment(std::span<int> values) { // [20]
  for (int& value : values) ++value;
}
```

It describes contiguous elements without allocation, growth, or lifetime extension. Fixed extent constrains the type; dynamic extent carries runtime length. C++20 span indexing is not a general throwing bounds check; indices must remain valid.

## M06 · Range views are often lazy; inspect ownership individually {#m06}

```cpp
auto positive = values | std::views::filter([](int x) { return x > 0; }); // [20]
```

Creating a view does not necessarily materialize filtered values. Some views borrow; others can own their underlying range. Check the adaptor and version. Underlying mutation can invalidate iterators, and some views cache positions. Laziness does not promise live refresh after arbitrary edits. Dangling return markers do not make every retained view safe.

## M07 · Coroutines are not automatically threads or parallel work {#m07}

[20] Coroutines suspend and resume according to promise, awaiter, and caller contracts. Scheduling, thread switches, and I/O are not supplied automatically. References, this, and external buffers retained across suspension need valid lifetimes, and frame destruction responsibility must be explicit.

## M08 · Thread destruction differs from cooperative jthread stopping {#m08}

Destroying a joinable std::thread terminates the program; design joining or detaching explicitly. Detach is not a lifetime fix. [20] Jthread destruction requests stop and joins when joinable. Stop tokens are cooperative, not forced cancellation; ignored requests or permanent blocking can still prevent destruction from completing.

## M09 · Locks and condition variables need a state protocol {#m09}

Use lock_guard for simple scoped locking and unique_lock for unlocking or waiting. [17] Scoped_lock can manage multiple mutexes. Condition variables can wake spuriously, so use a predicate under the appropriate shared-state locking protocol.

```cpp
std::unique_lock<std::mutex> lock(mutex);
cv.wait(lock, [&] { return ready; }); // releases while waiting; owns lock on return
```

A notification alone does not establish a correct state transition. Design shared state and its predicate before notifications.

## M10 · Relaxed atomics do not publish arbitrary ordinary data {#m10}

```cpp
// Initially ready=false; payload is not modified after publication; one producer/consumer.
// Producer: payload = 42; ready.store(true, std::memory_order_release);
// Consumer: if (ready.load(std::memory_order_acquire)) use(payload);
```

An acquire observing the corresponding release can establish the required synchronization. Relaxed provides atomicity and relevant modification ordering for that atomic, not happens-before for arbitrary other objects. Default sequential consistency still does not make a multi-step algorithm transactional. A data race is UB, not merely a stale value.

## M11 · Shared_ptr thread safety has three layers {#m11}

Separate the control block, one shared_ptr variable, and the pointee. Distinct shared_ptr instances can manage shared ownership concurrently. Concurrent writes to the same variable need synchronization or [20] `atomic<shared_ptr<T>>`. Ordinary pointee fields still need their own protection. Use_count()==1 is not a general lock-free mutation proof.

## M12 · Newer interfaces still have boundaries {#m12}

| Facility | Purpose | Still check |
| --- | --- | --- |
| Format [20] / print [23] | Typed formatting/output | Library support, format and locale requirements |
| `expected<T,E>` [23] | Explicit value-or-error result | Failure propagation policy |
| Mdspan [23] | Multidimensional indexing, layout, accessor view | Storage ownership and actual kernel performance |
| Modules [20] | Interfaces and dependency visibility | Compiler/build support, BMI and ABI compatibility |

Executable probes distinguish C++17 and C++20. C++23 entries are reference material, not a claim that every listed facility ran on this machine.

### Predict before revealing

1. Does an atomic pointer protect ordinary pointee fields?
2. Can jthread forcibly stop an infinite loop that ignores its stop token?
3. Is value_or's fallback lazily evaluated?

::: details Check your answers
Does an atomic pointer protect ordinary pointee fields? No. Does jthread forcibly stop an infinite loop? No. Is value_or's fallback lazily evaluated? No: ordinary argument evaluation still occurs.
:::

References: [optional](https://eel.is/c++draft/optional), [span](https://eel.is/c++draft/views.span), [ranges](https://eel.is/c++draft/ranges), [data races](https://eel.is/c++draft/intro.races), [memory order](https://eel.is/c++draft/atomics.order), [jthread](https://eel.is/c++draft/thread.jthread.class).
