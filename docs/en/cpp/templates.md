---
title: "C++ Templates, Forwarding, and Callables"
description: "Twelve generic-code reminders covering deduction, reference collapsing, forwarding, dependent names, SFINAE, concepts, ADL, and callable wrappers."
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Templates", "Forwarding", "Concepts", "Lambda", "Type Erasure"]
---

# Templates, Forwarding, and Callables

[Review index](./index.md) · **Prioritize F02–F07 and F12.** Determine where T is deduced before tracing forwarding.

## F01 · Templates are not runtime text substitution {#f01}

A template describes a family instantiated for selected types or values. Definitions normally must be visible when instantiated, hence header definitions. Controlled explicit instantiation can support a selected type set from a .cpp file; a link error is not proof that templates can never live there.

## F02 · By-value and by-reference deduction differ {#f02}

| Parameter pattern | Passing const int x |
| --- | --- |
| `template<class T> f(T)` | T is int; copied parameter |
| `template<class T> f(T&)` | T is const int; borrowing |
| `template<class T> f(const T&)` | T is int; const comes from the pattern |

Arrays/functions may decay by value. Deduction does not freely apply user conversions to unify two Ts: f(T,T) with int and double ordinarily conflicts unless the interface or explicit arguments change.

## F03 · Not every T&& forwards {#f03}

```cpp
template<class T> void forwardable(T&& x);       // T deduced here
template<class T> void constRvalue(const T&& x); // not forwarding
template<class T> struct Box {
  void consume(T&& x);                           // T fixed by Box
};
```

The central pattern is an rvalue reference to a cv-unqualified template parameter deduced here. Auto&& can also forward in applicable deduction contexts, with special cases such as braced initializer lists. Two ampersands alone do not establish perfect forwarding.

## F04 · Reference collapsing: an lvalue reference wins {#f04}

| Combination | Result |
| --- | --- |
| T& with & | T& |
| T& with && | T& |
| T&& with & | T& |
| T&& with && | T&& |

Passing an int lvalue to f(T&&) can deduce T as int&, collapsing the parameter to int&. This does not create an actual reference object containing another reference.

## F05 · Move requests reuse; forward preserves deduced category {#f05}

```cpp
int pick(const std::string&) { return 1; }
int pick(std::string&&) { return 2; }
template<class T> int relay(T&& value) {
  return pick(std::forward<T>(value));
}
```

Relay selects 1 for an lvalue and 2 for an appropriate rvalue. Pick(value) sees a named lvalue; move(value) can instead unintentionally consume the caller's lvalue.

## F06 · Decltype(auto) can preserve a borrowed return {#f06}

```cpp
template<class C> decltype(auto) first(C& values) {
  return (values.front());
}
```

This preserves front's reference while requiring an lvalue container. The return still depends on its lifetime, and the container must be nonempty. Ordinary auto typically drops the reference; decltype(auto) is not inherently safer.

## F07 · Dependent-name markers guide parsing and lookup {#f07}

`typename T::value_type` identifies a dependent type; `obj.template convert<U>()` disambiguates a template-id. Members from dependent bases often need `this->member` or qualification. Some contexts have been relaxed across standards, but these markers remain essential for reading LLVM templates.

## F08 · SFINAE does not swallow every compiler error {#f08}

Applicable substitution failures in the immediate context remove candidates; arbitrary errors inside a selected function body do not. Enable_if, [17] void_t, and detection idioms control participation, not implementation correctness. Distinguish an unavailable candidate from a broken selected body.

## F09 · If constexpr is not a universal invalid-code shelter {#f09}

```cpp
template<class T> auto identityOrRead(T value) {
  if constexpr (std::is_pointer_v<T>) return *value;
  else return value;
}
```

Since [17], an appropriately discarded dependent branch is not instantiated when the condition is resolved. Nondependent errors can still be diagnosed, and an ordinary non-template if constexpr(false) does not hide arbitrary type errors. The pointer branch also needs a valid non-null pointer.

## F10 · Concepts constrain interfaces, not mathematical truth {#f10}

```cpp
template<std::integral T>      // [20], <concepts>
T twice(T value) { return value + value; }
```

Requires checks expressions, types, and combined constraints for selection and diagnostics. It does not prove signed addition cannot overflow or that a comparator actually satisfies strict weak ordering. Syntactic satisfaction does not discharge all semantic obligations.

## F11 · ADL and the generic swap idiom {#f11}

```cpp
using std::swap;
swap(left, right); // also considers applicable associated-namespace candidates
```

Qualifying std::swap changes lookup. Do not freely add overloads to std; use only permitted customization mechanisms. Read hidden-friend and CRTP patterns by locating names and the concrete implementation type.

## F12 · Callables extend beyond lambdas {#f12}

| Form | Tradeoff |
| --- | --- |
| Function pointer | No captured state; simple interface boundary |
| Template parameter F | Concrete type and inlining opportunities, more instantiations |
| std::function | Owns a copyable type-erased target; may allocate; not every move-only closure fits |
| LLVM function_ref | Non-owning, generally for immediate calls rather than retention |
| std::move_only_function [23] | Owning wrapper for move-only targets; check library support |

[17] std::invoke unifies several function/member-pointer invocation forms without prolonging object lifetime.

### Predict before revealing

1. Why is `Box<T>::consume(T&&)` not necessarily forwarding?
2. What is the category of value inside relay?
3. Do satisfied requires-expressions prove no overflow or dangling?

::: details Check your answers
Why is `Box<T>::consume(T&&)` not universally accepting lvalues? T is fixed. Why is value an lvalue inside relay? It is named. Do satisfied requires-expressions prove no overflow or dangling? No: semantic and runtime conditions remain.
:::

References: [call deduction](https://eel.is/c++draft/temp.deduct.call), [references](https://eel.is/c++draft/dcl.ref), [constraints](https://eel.is/c++draft/temp.constr), [if statements](https://eel.is/c++draft/stmt.if), [function objects](https://eel.is/c++draft/function.objects).
