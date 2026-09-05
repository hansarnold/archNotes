---
title: "C++ Lifetime, Ownership, and Move"
description: "Twelve review points on RAII, temporaries, views, move, elision, smart pointers, invalidation, captures, and object storage."
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Lifetime", "Ownership", "Move Semantics", "Invalidation"]
---

# Lifetime, Ownership, and Move

[Review index](./index.md) · **Prioritize L01–L07 and L10–L11.** Ask who owns the resource, when it ends, and who still borrows it.

## L01 · RAII covers resources beyond memory {#l01}

Vector manages element storage, unique_ptr an object, and lock_guard a lock. Completed automatic objects are destroyed on applicable scope exits and stack unwinding. If construction fails, the complete object's destructor does not run, but completed bases and members are cleaned up. Do not rely exclusively on an unfinished object's destructor body for cleanup.

## L02 · Lifetime extension cannot simply be transferred {#l02}

```cpp
const std::string& kept = std::string("tile"); // this local binding extends lifetime
// const std::string& bad() { return std::string("tile"); }
// returning this reference does not keep the temporary alive for its caller
```

A temporary bound to a reference parameter ordinarily lasts through the full expression containing the call. Returning that reference or saving a view does not renew its lifetime. Context-specific exceptions matter; const reference is not an unconditional lifetime-extension rule.

## L03 · A copied view does not copy its elements {#l03}

String_view, [20] span, LLVM StringRef, and ArrayRef do not own backing elements. Owner destruction, string modification, or container reallocation can invalidate them. String_view does not guarantee NUL termination; passing data() to a C-string API can read beyond the view.

Borrow for immediate access; copy into an owning string/vector for retention, or explicitly require a longer-lived owner. A `const span<int>` still permits element writes; use `span<const int>` for read-only elements.

## L04 · Move neither transfers resources itself nor removes const {#l04}

```cpp
std::string source = "kernel";
std::string target = std::move(source); // selects move construction
const std::string frozen = "weight";
std::string copy = std::move(frozen);   // normally selects copy construction
```

Casting to an xvalue enables overload selection. Move is not guaranteed constant-time: element types, allocators, and small-string storage affect work performed.

## L05 · Let return-value elision work {#l05}

```cpp
std::string makeName() { return std::string("gemm"); } // [17] direct result construction
std::string makeOther() { std::string s = "gemm"; return s; } // optional NRVO
```

NRVO differs from [17] guaranteed copy elision. Ordinarily avoid return std::move(s): that expression is no longer eligible for NRVO. Returning s directly still has applicable implicit-move rules when elision is unavailable. Optional NRVO does not imply identical constructor logs in every build.

## L06 · Valid moved-from state need not have fixed contents {#l06}

Standard-library objects generally remain valid but unspecified unless an operation gives stronger guarantees. Destruction and reassignment are available; other operations must satisfy their preconditions. A null source after unique_ptr move construction is specific, not proof that all moved-from vectors, strings, or user types are empty.

## L07 · Distinguish unique_ptr access, release, and reset {#l07}

| Operation | Ownership behavior |
| --- | --- |
| get() | Borrows a raw pointer; do not manually delete it |
| release() | Relinquishes ownership without destruction; caller must take responsibility |
| reset(q) | Destroys the old object and adopts q; do not feed its own get() back |

Prefer make_unique; match arrays with `unique_ptr<T[]>`. Passing a raw pointer to a borrowing API does not transfer ownership.

## L08 · Shared ownership belongs to a control block {#l08}

Copying a shared_ptr shares ownership. Independently constructing two shared_ptr objects from one raw pointer creates separate control blocks and can double-delete. Make_shared commonly coallocates object and control block; remaining weak_ptr instances may retain that allocation after object destruction.

Concurrent control-block management through distinct shared_ptr instances does not protect concurrent writes to one shared_ptr variable or mutations of the pointee.

## L09 · Weak pointers remove ownership edges {#l09}

```cpp
std::weak_ptr<Node> parent;
if (auto owner = parent.lock()) {
  use(*owner); // strong ownership in this scope
}
```

Do not check expired() and assume a later use is safe. Lock either acquires strong ownership or fails. Choose parent links, caches, and observer ownership according to intended lifetimes.

## L10 · Check invalidation before structural edits {#l10}

| Mutation | Access affected |
| --- | --- |
| Vector reallocation | All element pointers, references, iterators, and old end |
| Vector push_back without reallocation | Old element access survives; old end does not |
| Vector erase | Iterators/references at or after the erase point |
| List insertion / erasure | Insertion generally preserves; erasure invalidates access to erased elements |
| Map insertion / erase | Insertion preserves; erased-element access is invalidated |
| Unordered_map rehash | Iterators invalidated; pointers/references to unerased elements remain valid |

Reserve neither changes size nor licenses arbitrary mutation. Similarly, LLVM IR handles do not own their referenced operations and cannot outlive erased IR indiscriminately.

## L11 · Lambda captures carry lifetime contracts {#l11}

| Capture | Stored state | Risk |
| --- | --- | --- |
| [&x] | Borrow of x | Dangling if callback outlives x |
| [x] | Copy of x | Pointer/view copies do not copy pointees |
| [this], or [=] using members | This pointer | Does not retain the host; implicit this via [=] is deprecated in [20] |
| [*this] [17] | Host object copy | Copy cost, slicing, and borrowed members remain relevant |
| [p = std::move(p)] [14] | Moved closure member | Can make the closure move-only |

Captures do not make execution asynchronous; storage and invocation determine that. Mutable permits modification of by-value capture members, not the original variables, and provides no synchronization.

## L12 · Bytes of storage are not automatically an arbitrary T {#l12}

Check storage, alignment, lifetime, and permitted access types independently. Reinterpret_cast and memcpy do not safely duplicate arbitrary nontrivial objects or their ownership. Placement new and explicit destruction belong in carefully designed storage management; prefer containers and allocator interfaces for ordinary compiler code.

### Predict before revealing

1. Does unique_ptr::release delete the object?
2. Are `span<const int>` and `const span<int>` equivalent?
3. Can copying a view repair its reference to a destroyed local string?

::: details Check your answers
Does release delete? No. Does `const span<int>` mean const elements? No; `span<const int>` does. Can copying a view repair a view into a destroyed local string? No: retain the owner or return owned characters.
:::

References: [temporaries](https://eel.is/c++draft/class.temporary), [copy elision](https://eel.is/c++draft/class.copy.elision), [lambda capture](https://eel.is/c++draft/expr.prim.lambda.capture), [smart pointers](https://eel.is/c++draft/smartptr), [LLVM Programmer's Manual](https://llvm.org/docs/ProgrammersManual.html).
