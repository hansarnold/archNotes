---
title: "C++ Classes, Special Members, and Polymorphism"
description: "Twelve object-model reminders: Rule of Zero/Five, implicit moves, default/delete, initialization order, destruction, slicing, overloads, and exception guarantees."
outline: deep
products: ["C++", "LLVM"]
documentType: "Cheat Sheet"
topics: ["Object Model", "Special Members", "Polymorphism", "Exceptions"]
---

# Classes, Special Members, and Polymorphism

[Review index](./index.md) · **Prioritize C01–C06 and C12.** Identify owners, special members, and invariants before business methods.

## C01 · Rule of Zero begins with member types {#c01}

```cpp
struct Program {
  std::string name;
  std::vector<int> nodes;
}; // members implement copy, move, and cleanup
```

Unique_ptr members can naturally make a class move-only. Do not write five special members simply because you declared a class; verify that default member operations implement the intended value semantics.

## C02 · User-declared destruction changes implicit move generation {#c02}

| Your declaration | Review |
| --- | --- |
| No handwritten special members | Member copy/move availability and invariants |
| Destructor, even defaulted | Implicit moves are suppressed; rvalues may select copying |
| Copy constructor or assignment | Implicit move generation is affected |
| Move constructor or assignment | Implicit copying may be defined as deleted |

Rule of Five means reviewing related resource-management operations, not always writing five bodies. Is_move_constructible tests construction from an rvalue; a copy constructor may satisfy it.

## C03 · Default, delete, and absence are distinct {#c03}

```cpp
struct Session {
  Session() = default;
  Session(const Session&) = delete;
  Session& operator=(const Session&) = delete;
  Session(Session&&) = default;
  Session& operator=(Session&&) = default;
};
```

An explicitly deleted function may win overload resolution and cause an error. A defaulted move constructor defined as deleted has a special rule excluding it from overload resolution. Do not summarize both situations as automatic fallback to copy.

## C04 · Member declaration order wins {#c04}

Virtual bases, direct bases, and members initialize in their specified orders; ordinary members follow declaration order, with reverse destruction. In `struct T { int a; int b; T(): b(1), a(b) {} };`, a still initializes first, reading b before initialization. Reordering the initializer list alone does not reorder construction.

## C05 · Base-pointer deletion needs a destruction contract {#c05}

```cpp
struct Pass {
  virtual ~Pass() = default;
  virtual void run() = 0;
};
```

Ordinary deletion of Derived through Base* requires virtual base destruction. Alternatively, a protected nonvirtual destructor can prohibit base-interface deletion. A virtual business method does not automatically make the destructor virtual. LLVM-style type recognition may also use explicit infrastructure instead of RTTI.

## C06 · Virtual calls during construction/destruction stay within the current layer {#c06}

A call from a base constructor does not dispatch into an unconstructed derived layer. Destruction similarly limits dispatch to the current layer. Avoid relying on a base constructor calling a derived hook; run complete-object workflows after construction.

## C07 · Passing a base by value slices {#c07}

Passing Derived to inspect(Base b) constructs a Base value without its derived portion. Use suitable references or pointers for polymorphic access. For polymorphic copying, consider a virtual clone returning an owning pointer. Borrowing still does not prolong the derived object's lifetime automatically.

## C08 · Explicit controls conversion entry points {#c08}

```cpp
struct Count {
  explicit Count(int n) : value(n) {}
  int value;
};
Count ok{3};
// Count accidental = 3;       // rejected
```

Conversion operators can also be explicit. Contextual bool conversion, such as in an if condition, differs from ordinary implicit conversion. [20] explicit(condition) makes explicitness conditional.

## C09 · Overriding differs from name hiding {#c09}

Override checks that a declaration really overrides a virtual function, including relevant cv/ref qualifiers. A derived declaration can hide a base overload set; using Base::foo can restore it. Using Base::Base inherits constructors, not automatic satisfaction of every derived-state invariant.

## C10 · Operator overloads cannot change precedence or arity {#c10}

Assignment commonly returns T& for chaining; prefix increment commonly returns a reference and postfix returns the old value. A sorting comparator must implement strict weak ordering, not <=. Operators remain functions: symbolic syntax does not establish zero cost or short-circuit evaluation.

## C11 · Members can overload on the receiver's category {#c11}

```cpp
struct Label {
  std::string text;
  const std::string& get() const & { return text; }
  std::string get() && { return std::move(text); }
};
```

Ref qualifiers distinguish borrowing from long-lived objects and extracting values from temporaries. Inspect the complete overload set, including const rvalues; one rvalue-qualified overload does not make every temporary-return path safe.

## C12 · Noexcept is a contract, not an aspiration {#c12}

An exception escaping a noexcept function terminates the program. Defaulted move noexcept depends on members; containers may copy instead of using a throwing move when their guarantees permit. Common guarantees are no-throw, strong rollback, and basic invariant/resource preservation. RAII supports cleanup but does not automatically give arbitrary operations the strong guarantee.

### Predict before revealing

1. Can adding only a defaulted destructor affect implicit moves?
2. Does a virtual run method make destruction virtual automatically?
3. Does a true move-constructible trait prove a move constructor is selected?

::: details Check your answers
Can a defaulted destructor affect move generation? Yes. Does virtual run imply virtual destruction? No. Does a true move-constructible trait prove a move rather than copy is selected? No: inspect viable constructors.
:::

References: [copy/move constructors](https://eel.is/c++draft/class.copy.ctor), [initialization order](https://eel.is/c++draft/class.base.init), [virtual functions](https://eel.is/c++draft/class.virtual), [exception specifications](https://eel.is/c++draft/except.spec), [Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines).
