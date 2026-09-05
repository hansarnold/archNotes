---
title: "C++ Build, Linking, Diagnostics, and Self-Checks"
description: "Twelve engineering reminders on translation units, ODR, headers, static storage, macros, UB, numerics, error handling, PImpl, builds, diagnostics, and executable probes."
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Build", "Linking", "ODR", "Diagnostics", "Verification"]
---

# Build, Linking, Diagnostics, and Self-Checks

[Review index](./index.md) · **Prioritize G01–G06 and G11–G12.** Separate compilation, linking, runtime, and semantic failures.

## G01 · Translation units are the compiler's input units {#g01}

A source file and preprocessed content form a translation unit. Declarations provide interfaces; definitions provide entities or bodies. A declared call compiling does not ensure its implementation will link. Signatures, namespaces, ABI, libraries, and template instantiation can all cause unresolved symbols.

## G02 · ODR and inline are not only performance concerns {#g02}

Do not put ordinary non-inline function definitions in headers included by multiple translation units. Inline functions, classes, and templates can have multiple definitions only under applicable ODR conditions. Inline does not require machine-code inlining. [17] Inline variables support appropriate cross-TU definitions.

## G03 · Headers should be self-contained {#g03}

Include declarations required by the interface rather than depending on accidental transitive includes. Incomplete types support some pointer/reference declarations, not arbitrary sizeof, layout, or destruction. Guards and pragma once prevent repeated inclusion within a TU, not cross-TU ODR violations. Avoid using namespace std in public headers.

## G04 · Static depends on where it appears {#g04}

| Context | Meaning |
| --- | --- |
| Namespace-scope static | Internal linkage within a TU |
| Function-local static | Static storage; local initialization is thread-safe since [11] |
| Static class member | Not per-object; check applicable definition rules |
| Thread_local | Per-thread storage, not synchronization of other objects |

Thread-safe local-static initialization does not make subsequent mutation safe. Dynamic initialization across TUs still requires careful design.

## G05 · Macros can evaluate arguments repeatedly {#g05}

For SQUARE(x) defined as ((x)*(x)), SQUARE(i++) modifies i repeatedly; additional parentheses do not fix evaluation. Prefer suitable inline or constexpr functions. Macros remain useful for intentional conditional compilation and generation. Do/while(0) can package multi-statement macros but does not solve argument evaluation or name collisions.

## G06 · Distinguish four classes of problematic behavior {#g06}

| Category | Meaning | Example here |
| --- | --- | --- |
| Ill-formed | Violates language rules, usually diagnosed; some ODR violations need no diagnostic | List narrowing, copying unique_ptr |
| Implementation-defined | Implementation chooses and documents | Certain representation/implementation properties |
| Unspecified | Multiple permitted outcomes without a fixed choice | Applicable argument evaluation orders |
| Undefined behavior | No standard behavior requirements | Signed overflow, dangling access, data races |

Debug success or repeated identical output does not establish absence of UB. Compilation failure can also reflect missing headers or unsupported library facilities rather than invalid language syntax.

## G07 · Review numerics and object representation independently {#g07}

Signed/unsigned mixing, shift counts, bounds, alignment, and invalid access types can invalidate low-level optimizations. A wide type does not settle every numerical condition. Floating precision, NaNs, signed zero, FMA, and regrouping must match IR/hardware contracts, not merely host expressions.

## G08 · Error propagation belongs to the interface contract {#g08}

| Mechanism | Represents | Clarify |
| --- | --- | --- |
| Bool / LogicalResult | Success or failure | Status is not a computed value; check it |
| `optional<T>` | Presence or absence | Whether absence needs an explanation |
| `expected<T,E>` [23] / project result | Value or explicit error | How E propagates |
| Exception | Nonlocal failure propagation | Noexcept, cleanup, and project configuration |

LLVM commonly uses Error/Expected and MLIR uses LogicalResult/FailureOr; follow the actual API. Do not transplant throwing code into an exception-disabled build indiscriminately. Nodiscard helps detect ignored results but does not handle them automatically.

## G09 · PImpl and incomplete-type destruction {#g09}

```cpp
// Header
class Engine {
  struct Impl;
  std::unique_ptr<Impl> impl;
public:
  Engine();
  ~Engine(); // define where Impl is complete
};
```

PImpl hides layout and implementation dependencies. Holding `unique_ptr<Incomplete>` does not make instantiating its default deletion safe anywhere. The destructor declaration also affects move generation: revisit [C02](./classes.md#c02). Defaulting every member in the header is not a universal solution.

## G10 · Build configuration determines what was tested {#g10}

Check standard mode, compiler, standard library, optimization/debugging, RTTI/exceptions, and actual include/library paths. CMake configures/generates; tools such as Ninja execute build rules. A successful build does not prove a changed file belongs to any target. Header-only does not mean zero compilation cost.

## G11 · Diagnostic tools have distinct coverage {#g11}

| Tool | Useful for | Cannot prove |
| --- | --- | --- |
| Warnings / static analysis | Suspicious conversions, lifetime, control flow | Every runtime path correct |
| ASan | Many exercised memory errors | Absence of races or logic errors |
| UBSan | Selected exercised UB categories | Detection of all UB |
| TSan | Many exercised data races | Correctness under every schedule |
| Debugger / assert | Concrete state and invariants | Assertions surviving NDEBUG |

Platforms, compilers, and sanitizer combinations have restrictions; TSan and ASan are not arbitrary interchangeable switches. The probes below use explicit failure checks so NDEBUG cannot silently erase them.

## G12 · Executable review probes {#g12}

### Verification and self-checks {#verification}

Run from the repository root, without GPU or an MLIR build:

```sh
python3 -B labs/cpp_review/run.py --std 17
python3 -B labs/cpp_review/run.py --std 20
```

The first runs C++17 type/behavior probes and checks six expected compiler rejections. The second probes C++20 concepts, span, ranges, constant-evaluation facilities, and related examples. The runner prints compiler, groups, and successful counts; timeouts and unsupported modes are failures, not silent skips.

Source and coverage: [probe README](https://github.com/hansarnold/archNotes/blob/main/labs/cpp_review/README.md). **Representative probes are not dynamic proofs of all 84 reminders.** Invalid lifetime and data-race examples remain code-review exercises; C++23 entries are reference-only.

### Predict before revealing

1. Does an include guard permit defining the same ordinary external function in multiple TUs?
2. Does thread-safe local-static initialization protect every subsequent access?
3. Do assert-only tests still check their conditions under NDEBUG?

::: details Check your answers and review method
No: include guards do not resolve cross-TU ODR obligations. No: later shared accesses need synchronization. No: NDEBUG removes assert, so these probes use explicit failure checks.

Predict compilation, actual type/output, and possible invalidation. Change one condition: const, auto versus auto&, or a decltype(auto) return. Explain before running the safe variant. Keep UB counterexamples at code-review level instead of inferring guarantees from their output.
:::

Continue with [repairs](../mlir/cpp-refresh.md) or the [miniature pass](../mlir/cpp-labs.md). References: [ODR](https://eel.is/c++draft/basic.def.odr), [storage duration](https://eel.is/c++draft/basic.stc), [Clang diagnostics](https://clang.llvm.org/docs/DiagnosticsReference.html), [ASan](https://clang.llvm.org/docs/AddressSanitizer.html), [UBSan](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html), [TSan](https://clang.llvm.org/docs/ThreadSanitizer.html).
