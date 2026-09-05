---
title: "C++ 模板、Forwarding 与 Callable 速查"
description: "12 个泛型代码复习点：推导、引用折叠、Forwarding Reference、decltype(auto)、依赖名、SFINAE、Concepts、ADL 和 Callable。"
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Templates", "Forwarding", "Concepts", "Lambda", "Type Erasure"]
---

# 模板、Forwarding 与 Callable

[复习总入口](./index.md) · **优先 F02–F07、F12**。先读懂“这里的 T 从哪推导”，再看表达式怎样被转发。

## F01 · 模板不是运行时字符串替换 {#f01}

模板定义描述一族实例；需要实例化时才针对类型/值形成代码。编译器通常要在实例化点看见定义，所以模板实现常放 Header；也可用受控的显式实例化把支持类型集合放在 .cpp。看到 Link Error 不要立即断言模板不能放 .cpp。

## F02 · 按值与按引用推导不同 {#f02}

| 参数形式 | `const int x` 作为实参时的常见推导 |
| --- | --- |
| `template<class T> f(T)` | T = int，参数是副本 |
| `template<class T> f(T&)` | T = const int，参数借用 |
| `template<class T> f(const T&)` | T = int，const 来自形参模式 |

数组/函数按值可能 Decay；推导不会任意试遍用户自定义转换来让两个 T 相同。`f(T,T)` 接收 int 与 double，通常推导冲突，需改变接口或显式指定。

## F03 · 不是所有 T&& 都是 Forwarding Reference {#f03}

```cpp
template<class T> void forwardable(T&& x);       // T 在本次调用中推导
template<class T> void constRvalue(const T&& x); // 不是
template<class T> struct Box {
  void consume(T&& x);                           // T 已由 Box 决定，不是
};
```

Forwarding Reference 的核心是此处推导的 cv-unqualified 模板参数的右值引用；`auto&&` 在适用的推导语境中也可转发，但 braced initializer list 有特殊规则。不能把“看到两个 &”机械等同于完美转发。

## F04 · 引用折叠：只要参与者有 &，结果就是 & {#f04}

| 组合 | 折叠结果 |
| --- | --- |
| `T&` + `&` | `T&` |
| `T&` + `&&` | `T&` |
| `T&&` + `&` | `T&` |
| `T&&` + `&&` | `T&&` |

给 `f(T&&)` 传 lvalue int，T 可推导为 int&，因此形参折叠为 int&。这不是产生一个真实的“引用对象的引用”。

## F05 · Move 无条件表达可移；Forward 保留推导类别 {#f05}

```cpp
int pick(const std::string&) { return 1; }
int pick(std::string&&) { return 2; }
template<class T> int relay(T&& value) {
  return pick(std::forward<T>(value));
}
```

relay 接 lvalue 时选 1，接合适 rvalue 时选 2。写 `pick(value)` 会因 value 是具名表达式而按 lvalue 处理；写 move(value) 则可能意外移动调用者的 lvalue。

## F06 · decltype(auto) 返回值可能保留借用 {#f06}

```cpp
template<class C> decltype(auto) first(C& values) {
  return (values.front());
}
```

此例意图保留 front 返回的引用，并把输入限制为 lvalue 容器；返回值仍依赖容器寿命且要求非空。普通 auto 返回通常去引用；decltype(auto) 不是“更聪明、更安全的 auto”。

## F07 · typename、template、this-> 是解析与查找提示 {#f07}

`typename T::value_type` 表明依赖名是 Type；`obj.template convert<U>()` 消除依赖上下文中的解析歧义。模板派生类访问依赖基类成员时，常需 `this->member` 或限定名。不同标准放宽过部分场景，但理解这些标记仍是读 LLVM 模板代码的关键。

## F08 · SFINAE 不是把所有编译错误都吞掉 {#f08}

Substitution Failure 在适用的 immediate context 中能移除候选；函数体内部任意错误并不自动变成“尝试另一个重载”。`enable_if`、`void_t` [17] 和检测惯用法表达参与条件，不代替正确的函数体。先区分“候选不满足”与“选中后实现有错”。

## F09 · if constexpr 丢弃分支不等于随处可以写非法代码 {#f09}

```cpp
template<class T> auto identityOrRead(T value) {
  if constexpr (std::is_pointer_v<T>) return *value;
  else return value;
}
```

[17] 在模板实例化中，条件确定后不实例化被丢弃的依赖分支；独立于模板参数的非法写法仍可能报错。在普通非模板函数里，`if constexpr(false)` 不是隐藏任意类型错误的办法。指针分支还要求实际传入有效非空指针。

## F10 · Concepts 约束接口，不证明算法数学性质 {#f10}

```cpp
template<std::integral T>      // [20], <concepts>
T twice(T value) { return value + value; }
```

requires 可检查表达式、类型与组合约束，改善候选选择和 Diagnostic；它不证明上述 signed 加法永不溢出，也不证明一个比较器实际满足 Strict Weak Ordering。概念名与真正的语义责任要分开。

## F11 · ADL 与通用 swap 的惯用写法 {#f11}

```cpp
using std::swap;
swap(left, right); // 在适用情况下同时考虑关联命名空间中的 swap
```

直接限定 `std::swap` 会改变候选查找。不要为了扩展接口就随意向 std 加重载；只有标准允许的定制点才可使用相应方式。Hidden Friend、CRTP 等模式先沿“名字在哪里、哪个实例提供实现”来读。

## F12 · Callable 不只 Lambda {#f12}

| 形式 | 取舍 |
| --- | --- |
| 函数指针 | 无捕获状态；适合简单 ABI 边界 |
| 模板参数 F | 保留具体类型，易内联，但会增加实例化 |
| `std::function` | 拥有可复制的 Type-erased Target，可能分配；不是任意 Move-only Closure 都可放入 |
| LLVM `function_ref` | 非 owning，通常适合即时回调，不能随意保存 |
| `std::move_only_function` [23] | 支持 Move-only Target 的 owning 包装，需检查库支持 |

`std::invoke` [17] 统一若干函数/成员指针调用方式，不替你延长传入对象的寿命。

### 先预测，再展开

1. `Box<T>::consume(T&&)` 为什么不一定是转发接口？
2. relay 内的 value 是哪个 Value Category？
3. requires 检查通过，是否证明没有溢出和悬空？

::: details 对照答案
`Box<T>::consume(T&&)` 为何不能像转发函数一样接任意 lvalue？T 已固定。relay 内 value 为何不是 rvalue？它有名字。requires 通过是否能证明参数不会溢出或悬空？不能，这些仍是语义与运行时条件。
:::

依据：[Call Deduction](https://eel.is/c++draft/temp.deduct.call)、[References](https://eel.is/c++draft/dcl.ref)、[Constraints](https://eel.is/c++draft/temp.constr)、[if Statement](https://eel.is/c++draft/stmt.if)、[Function Objects](https://eel.is/c++draft/function.objects)。
