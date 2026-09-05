---
title: "C++ Lifetime、Ownership 与 Move 速查"
description: "12 个资源与生命周期复习点：RAII、临时量、View、Move、Elision、智能指针、失效、Lambda 捕获与对象存储。"
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Lifetime", "Ownership", "Move Semantics", "Invalidation"]
---

# Lifetime、Ownership 与 Move

[复习总入口](./index.md) · **优先 L01–L07、L10–L11**。每次只问三件事：谁拥有、何时销毁、谁还在借用。

## L01 · RAII 管理资源，不只是管理内存 {#l01}

`vector` 管元素存储，`unique_ptr` 管对象，`lock_guard` 管锁。作用域正常退出或栈展开时，已完成构造的自动对象按规则析构。构造失败时，完整对象的析构函数不会运行，已构造的基类和成员仍会清理。不要把重要清理只放到构造尚未成功的对象析构体里。

## L02 · Lifetime Extension 不是可以转送的券 {#l02}

```cpp
const std::string& kept = std::string("tile"); // 此局部绑定延长临时量寿命
// const std::string& bad() { return std::string("tile"); }
// 函数返回引用不会让这个临时量活到调用者使用时
```

给函数参数 `const T&` 绑定临时量，通常只保留到调用所在完整表达式结束。返回该引用、复制引用或保存 View 都不会重新延长寿命。适用上下文有例外，不能把“const 引用延寿”当成无条件规则。

## L03 · View 复制的是访问范围，不是数据 {#l03}

`string_view`、[20] `span`、LLVM `StringRef` / `ArrayRef` 都不拥有底层元素。Owner 被销毁、字符串被修改或容器重分配后，View 可能失效。string_view 也不保证以 NUL 结尾；把 `view.data()` 直接传给期待 C String 的接口可能越界读取。

**修复选择：** 即时读取用借用；跨调用保存则复制为 owning string/vector，或明确要求 Owner 长期存活。`const span<int>` 的元素仍可写；只读元素应使用 `span<const int>`。

## L04 · std::move 不搬运，也不去掉 const {#l04}

```cpp
std::string source = "kernel";
std::string target = std::move(source); // 选中 Move Constructor
const std::string frozen = "weight";
std::string copy = std::move(frozen);   // 常见情况：选中 Copy Constructor
```

把表达式转为 xvalue，只是让重载有机会使用资源。Move 也不保证 O(1)：元素类型、分配器、Small-string Storage 等都影响实际工作量。

## L05 · 返回值：先让 Elision 工作 {#l05}

```cpp
std::string makeName() { return std::string("gemm"); } // [17] 同类型 prvalue 直接构造结果
std::string makeOther() { std::string s = "gemm"; return s; } // 可选 NRVO
```

NRVO 和 [17] guaranteed copy elision 不是同一个规则。通常别写 `return std::move(s);`，它使这个表达式不再满足 NRVO 条件；直接 `return s;` 在不能消除时仍有相应的移动规则。不要要求每个 Build 打印相同构造次数来证明可选 NRVO。

## L06 · Moved-from：有效不代表内容固定 {#l06}

标准库对象一般保持 valid but unspecified 状态，除非该操作给了更强保证。可以析构、赋新值；其他操作仍须满足前置条件。移动构造 unique_ptr 后源为空是明确保证；不能推导所有被 Move 的 vector/string 或用户类型都必然为空。

## L07 · unique_ptr 的三个动作别混 {#l07}

| 操作 | 所有权与清理 |
| --- | --- |
| `p.get()` | 借用裸指针；p 仍拥有，不要手动 delete |
| `p.release()` | 放弃所有权并返回指针；不删除对象，调用者必须接管 |
| `p.reset(q)` | 清理原对象并接管 q；不能把 `p.get()` 又交回去 |

优先 `make_unique<T>()`，数组用匹配的 `unique_ptr<T[]>`。向借用 API 传裸指针不代表转移所有权，接口契约必须明确。

## L08 · shared_ptr 共享的是 Control Block {#l08}

复制 shared_ptr 共享所有权；拿同一个 raw pointer 构造两个独立 shared_ptr 会产生两个 Control Block，可能 Double Delete。`make_shared` 通常合并控制块与对象的分配；有 weak_ptr 残留时，相关分配的存储可能继续存在，即使对象已经析构。

不同 shared_ptr 实例共享 Control Block 的管理可并发，不意味着同一个 shared_ptr 变量的并发写入或 pointee 状态自动安全。

## L09 · weak_ptr 打破拥有关系中的环 {#l09}

```cpp
std::weak_ptr<Node> parent;
if (auto owner = parent.lock()) {
  use(*owner); // 此作用域内持有强引用
}
```

不要先 `expired()` 再假定之后使用仍安全；用 `lock()` 一步获得强引用或失败。回指 Parent、Cache、Observer 是否应该拥有对象，要按业务 Lifetime 决定。

## L10 · 失效速查：修改结构前先停一下 {#l10}

| 操作 | 需要重新检查的访问 |
| --- | --- |
| vector 重分配 | 所有元素指针、引用、Iterator，以及旧 end |
| vector 无重分配的 push_back | 旧元素访问保留，旧 end 失效 |
| vector erase | 删除点及之后的 Iterator/Reference 失效 |
| list 插入 / 删除 | 插入通常保留；删除使被删元素的访问失效 |
| map 插入 / erase | 插入保留；erase 使被删元素的访问失效 |
| unordered_map rehash | Iterator 失效；未被删除元素的指针和引用保持有效 |

`reserve` 不改变 Size，也不是任意修改的通行证。LLVM IR Handle 同样不拥有被引用的 Operation；删除 IR 后，保存的 Handle 不能继续随意使用。

## L11 · Lambda 捕获的 Lifetime 契约 {#l11}

| 捕获 | 保存了什么 | 风险 |
| --- | --- | --- |
| `[&x]` | 借用 x | 回调比 x 活得久则悬空 |
| `[x]` | x 的副本 | x 是指针/View 时没有复制 pointee |
| `[this]` / 使用成员的 `[=]` | this 指针 | 不延长宿主对象寿命；[20] 隐式 this 的 `[=]` 用法已弃用 |
| `[*this]` [17] | 宿主对象副本 | Copy 成本、切片与成员自身的借用仍要审查 |
| `[p = std::move(p)]` [14] | 移入 Closure 的成员 | 可以让 Closure 成为 Move-only |

捕获列表不决定异步执行，调用者怎样保存和调用 Closure 才决定。`mutable` 允许改按值捕获的成员，不会改回原对象，也不意味着线程安全。

## L12 · 有一块字节，不等于里面有任意 T {#l12}

审查底层代码时分别确认 Storage、Alignment、Lifetime、访问类型。不能用 `memcpy` 或 reinterpret_cast 随便复制非平凡对象；资源所有权会被破坏。Placement new 与显式析构用于特定存储管理场景，优先使用容器/分配器接口，不要在普通 Compiler Pass 中自行制造对象生命周期。

### 先预测，再展开

1. unique_ptr 的 release 会 delete 吗？
2. `span<const int>` 与 `const span<int>` 是否等价？
3. 复制一个指向已销毁局部 string 的 View，能修复悬空吗？

::: details 对照答案
release 会 delete 吗？不会。`span<const int>` 与 `const span<int>` 一样吗？前者限制元素写入，后者只限制 View 对象自身。返回局部 string 的 string_view 能靠复制 View 修好吗？不能，应延长 Owner 寿命或返回 owning string。
:::

依据：[Temporary Objects](https://eel.is/c++draft/class.temporary)、[Copy Elision](https://eel.is/c++draft/class.copy.elision)、[Lambda Capture](https://eel.is/c++draft/expr.prim.lambda.capture)、[Smart Pointers](https://eel.is/c++draft/smartptr)、[LLVM Programmer's Manual](https://llvm.org/docs/ProgrammersManual.html)。
