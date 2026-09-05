---
title: "C++ Types, Initialization, and Expressions"
description: "Twelve review points covering const, initialization, auto, decltype, categories, references, integer conversions, casts, enums, and sequencing."
outline: deep
products: ["C++"]
documentType: "Cheat Sheet"
topics: ["Types", "Initialization", "Deduction", "Value Categories"]
---

# Types, Initialization, and Expressions

[Review index](./index.md) · **Prioritize T01–T08.** Snippets omit headers and enclosing functions. Complete executable checks are linked under [verification](./tooling.md#verification).

## T01 · Locate the const {#t01}

| Declaration | Reassign pointer | Modify pointee through it |
| --- | --- | --- |
| `T* p` | Yes | Yes |
| `const T* p` / `T const* p` | Yes | No |
| `T* const p` | No | Yes |
| `const T* const p` | No | No |

A const reference is read-only access, not universal immutability or synchronization. A const vector of pointers prevents replacing pointer elements, not mutating their pointees.

## T02 · Parentheses and braces can select different constructors {#t02}

```cpp
int zero{};                    // 0
std::vector<int> a(4, 9);       // four nines
std::vector<int> b{4, 9};        // two elements
auto x{1};                     // int
auto y = {1};                  // initializer_list<int>
// int n{3.5};                  // ill-formed narrowing
```

List initialization prioritizes suitable initializer_list constructors. An uninitialized local `int n;` is not automatically zero. `T x();` may declare a function; `T x{};` constructs the intended object here.

## T03 · Auto commonly removes top-level const and references {#t03}

```cpp
const int count = 7;
auto copy = count;              // int
auto& alias = count;            // const int&
const int* ptr = &count;
auto ptrCopy = ptr;             // const int*, pointee const survives
int data[3]{};
auto decayed = data;            // int*
auto& whole = data;             // int (&)[3]
```

By-value deduction permits array/function decay; reference deduction can preserve an array type. Auto does not answer ownership questions for you.

## T04 · Parentheses change decltype {#t04}

```cpp
int n = 3;
decltype(n) value = n;          // int
decltype((n)) alias = n;        // int&
decltype(auto) alsoAlias = (n); // int&
```

An unparenthesized name or member access has special declared-type treatment. Other expressions follow lvalue to T&, xvalue to T&&, and prvalue to T. Returning `(local)` with decltype(auto) can therefore return a dangling reference despite no visible ampersand in the function declaration.

## T05 · Categories describe expressions, not storage regions {#t05}

| Category | Typical examples | Recall |
| --- | --- | --- |
| lvalue | `x`, `*p`, a call returning T& | Refers to an object with identity |
| xvalue | std::move(x), a call returning T&& | Identity with potential resource reuse |
| prvalue | 42, T{}, a by-value call | Computes a value or initializes a result object |

Glvalues comprise lvalues and xvalues; rvalues comprise prvalues and xvalues. An lvalue can be const and nonmodifiable.

## T06 · A named rvalue-reference variable is an lvalue expression {#t06}

```cpp
void take(const std::string&);
void take(std::string&&);
std::string&& name = std::string("gemm");
take(name);                     // const string& overload
take(std::move(name));          // string&& overload
```

Separate the variable's declared type from the expression category when using its name. Forwarding parameters follow the same rule; see [F03](./templates.md#f03). This reminder concerns ordinary expressions: [23] treats move-eligible names as xvalues in applicable return and related contexts, so do not extend the shorthand to every return context.

## T07 · Minimal reference-binding table {#t07}

| Parameter | Mutable lvalue | Const lvalue | Non-const rvalue |
| --- | --- | --- | --- |
| T& | Yes | No | No |
| const T& | Yes | Yes | Yes; inspect lifetime |
| Ordinary T&& | No | No | Yes |

Const T&& is not a forwarding reference. A reference is not a nullable handle; fabricating one for a nonexistent object does not create a safe null reference.

## T08 · Arithmetic happens before the destination conversion {#t08}

```cpp
int a = 50000, b = 50000;
long long safe = 1LL * a * b;
// long long late = a * b;      // overflows a 32-bit int first
bool surprise = (-1 < 1u);     // false, conversion to unsigned int
```

Unsigned arithmetic wraps modulo its width; signed overflow is undefined behavior. Check negative values and ranges when mixing int and size_t. [20] std::cmp_less supports safe mixed-sign comparison; a cast merely silencing a warning is not a range proof.

## T09 · Casts offer different guarantees {#t09}

| Cast | Typical purpose | Does not guarantee |
| --- | --- | --- |
| static_cast | Known conversions and constrained hierarchy casts | Checked downcasts or absence of narrowing |
| dynamic_cast | Checked polymorphic hierarchy conversion | Requires applicable polymorphism/RTTI; pointer failure is null, reference failure throws |
| const_cast | Adjust cv qualification | Writing an originally const object remains UB |
| reinterpret_cast | Low-level representation and pointer conversions | Alignment, lifetime, or legal access through the resulting type |

C-style casts hide which risk you chose. [20] std::bit_cast copies representations subject to size, type, and representation-validity requirements; it is not unrestricted type punning.

## T10 · Scoped enums do not implicitly become integers {#t10}

`enum class Kind : unsigned { Input, Add };` scopes names and prevents accidental mixing. Convert explicitly, or use [23] std::to_underlying. Flags require an intentional underlying type and operators. For `1 << bit`, inspect the promoted type and shift-count range.

## T11 · Structured bindings may copy or borrow {#t11}

```cpp
std::pair<int, int> tile{32, 64};
auto [m, n] = tile;             // decomposes a hidden copy
auto& [rows, cols] = tile;      // aliases original storage
rows = 16;                     // changes tile.first
```

[17] syntax. In `auto& [key, value]` over a map, the mapped value is mutable but its key remains const. Decomposition does not remove container restrictions.

## T12 · Written first does not necessarily execute first {#t12}

Function arguments are not guaranteed left-to-right. Since [17], the parameter initializations in `f(i++, i++)` do not interleave, but their order is unspecified. `i++ + i++` still has unsequenced modifications and is UB. Built-in && and || short-circuit; overloaded operator calls do not provide that same behavior.

### Predict before revealing

1. For `const int count = 3;`, what is `decltype((count))`?
2. Does `auto& [a,b] = tile;` modify a copy or the original?
3. Does assigning an int multiplication into int64 prevent multiplication overflow?

::: details Check your answers
What is decltype((count)) for a const int count? Const int&. What does auto& structured binding modify? The original object. Does assigning multiplication into int64 prevent overflow? Only if the multiplication itself is performed in a suitable type.
:::

References: [auto deduction](https://eel.is/c++draft/dcl.spec.auto), [decltype](https://eel.is/c++draft/dcl.type.decltype), [value categories](https://eel.is/c++draft/basic.lval), [function calls](https://eel.is/c++draft/expr.call).
