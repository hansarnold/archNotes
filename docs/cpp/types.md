---
title: "C++ 类型、初始化与表达式速查"
description: "12 个高频遗忘点：const、初始化、auto、decltype、值类别、引用绑定、整数转换、Cast、枚举与求值顺序。"
outline: deep
products: ["C++"]
documentType: "Cheat Sheet"
topics: ["Types", "Initialization", "Deduction", "Value Categories"]
---

# 类型、初始化与表达式

[复习总入口](./index.md) · **优先复习 T01–T08**。代码是局部片段，省略头文件与外层函数；完整可运行自测见[验证与自测](./tooling.md#verification)。

## T01 · const 放在哪里，限制的就是什么 {#t01}

| 声明 | 可以改指针指向 | 可以通过它改对象 |
| --- | --- | --- |
| `T* p` | 是 | 是 |
| `const T* p` / `T const* p` | 是 | 否 |
| `T* const p` | 否 | 是 |
| `const T* const p` | 否 | 否 |

`const T&` 是只读借用，不是对象绝对不可变，也不是自动线程安全。对 `const vector<T*>`，指针元素不能换，但所指 T 不因此变 const。

## T02 · 圆括号与花括号不总等价 {#t02}

```cpp
int zero{};                    // 0
std::vector<int> a(4, 9);       // 9, 9, 9, 9
std::vector<int> b{4, 9};        // 4, 9
auto x{1};                     // int
auto y = {1};                  // initializer_list<int>
// int n{3.5};                  // 拒绝 narrowing，不能编译
```

List-initialization 会优先考虑合适的 `initializer_list` 构造。局部 `int n;` 没有提供可读的初值；不要把“未初始化”和“自动为零”混为一谈。`T x();` 可能是函数声明，`T x{};` 才是此处想要的对象。

## T03 · auto 通常去掉顶层 const 与引用 {#t03}

```cpp
const int count = 7;
auto copy = count;              // int
auto& alias = count;            // const int&
const int* ptr = &count;
auto ptrCopy = ptr;             // const int*，底层 const 保留
int data[3]{};
auto decayed = data;            // int*
auto& whole = data;             // int (&)[3]
```

按值推导的 Array/Function 可以发生 Decay；加引用能保留数组类型。不要用 `auto` 隐藏自己还没想明白的所有权。

## T04 · decltype 的括号会改变答案 {#t04}

```cpp
int n = 3;
decltype(n) value = n;          // int
decltype((n)) alias = n;        // int&
decltype(auto) alsoAlias = (n); // int&
```

未加括号的名字/成员访问有特殊规则，返回声明类型；一般表达式按 lvalue → `T&`、xvalue → `T&&`、prvalue → `T`。因此用 `decltype(auto)` 返回 `(local)` 可能意外返回悬空引用，不能只看函数表面没有 `&`。

## T05 · 值类别描述表达式，不描述存储区域 {#t05}

| 类别 | 常见例子 | 记忆点 |
| --- | --- | --- |
| lvalue | 变量 `x`、`*p`、返回 `T&` 的调用 | 表达式指向一个有身份的对象 |
| xvalue | `std::move(x)`、返回 `T&&` 的调用 | 仍有身份，但可供资源复用 |
| prvalue | `42`、`T{}`、按值返回的调用 | 用于计算值或初始化结果对象 |

glvalue = lvalue + xvalue；rvalue = prvalue + xvalue。lvalue 不意味着可写，例如 const 对象的表达式仍可为 lvalue。

## T06 · 右值引用变量一旦有名字，名字就是 lvalue {#t06}

```cpp
void take(const std::string&);
void take(std::string&&);
std::string&& name = std::string("gemm");
take(name);                     // const string& 重载
take(std::move(name));          // string&& 重载
```

`name` 的声明类型和使用 `name` 时的表达式类别，是两个问题。转发参数同理，见 [F03](./templates.md#f03)。此处讲常规表达式；[23] 在适用的 return 等语境中，move-eligible 名字有按 xvalue 处理的特殊规则，不要把速记套用到所有返回语境。

## T07 · 引用绑定的最小表 {#t07}

| 参数 | 可变 lvalue | const lvalue | 非 const rvalue |
| --- | --- | --- | --- |
| `T&` | 可 | 不可 | 不可 |
| `const T&` | 可 | 可 | 可，留意 Lifetime |
| 普通 `T&&` | 不可 | 不可 | 可 |

`const T&&` 不等于 Forwarding Reference。引用不能为空是语言模型中的要求；制造对不存在对象的引用不会得到安全的“空引用”。

## T08 · 整数提升发生在赋值之前 {#t08}

```cpp
int a = 50000, b = 50000;
long long safe = 1LL * a * b;
// long long late = a * b;      // 32-bit int 上乘法先溢出，后转宽无济于事
bool surprise = (-1 < 1u);     // false：-1 转为 unsigned int
```

Unsigned 算术按其位宽取模；signed overflow 是 UB。计数混用 `int` 与 `size_t` 时先考虑负值与范围，不要用 Cast 掩盖 Warning。[20] `std::cmp_less` 可表达安全的混合符号比较。

## T09 · 四类 Cast 不提供同一种保证 {#t09}

| Cast | 用途 | 不会替你做什么 |
| --- | --- | --- |
| `static_cast` | 明确的已知转换、受约束的层级转换 | 不做运行时下转型检查、不防窄化 |
| `dynamic_cast` | 多态层级中的运行时检查 | 需满足多态/RTTI 等前提；指针失败为空，引用失败抛异常 |
| `const_cast` | 调整 cv 限定 | 原对象真为 const 时，去 const 后写仍是 UB |
| `reinterpret_cast` | 低层表示与指针转换 | 不保证对齐、对象存在或可按新类型访问 |

不要用 C-style Cast 把不同风险藏到一套语法里。复制对象表示可研究 [20] `std::bit_cast`，但它也有大小、类型与有效表示约束。

## T10 · enum class 不会隐式变成整数 {#t10}

`enum class Kind : unsigned { Input, Add };` 把名字放进作用域，减少混用。取整数用显式转换；[23] 有 `std::to_underlying`。位掩码需要明确的底层类型和运算符；`1 << bit` 还要审查提升后的类型和 Shift Count 范围。

## T11 · Structured Binding 可以复制，也可以借用 {#t11}

```cpp
std::pair<int, int> tile{32, 64};
auto [m, n] = tile;             // 拆解一个隐藏的副本
auto& [rows, cols] = tile;      // 绑定原对象
rows = 16;                     // tile.first 变为 16
```

[17] 语法。遍历 map 时 `auto& [key, value]` 可修改 mapped value，但 Key 仍是 const；不能把 Structured Binding 当成忽略容器约束的语法糖。

## T12 · 左边先写，不一定左边先执行 {#t12}

函数实参并非保证从左到右。[17] `f(i++, i++)` 的参数初始化彼此不交错，但顺序未指定；不能固定预测两个参数的对应值。`i++ + i++` 仍有 unsequenced modification 风险，是 UB。内建 `&&`、`||` 会短路；重载版本的函数调用不提供相同短路行为。

### 先预测，再展开

1. `const int count = 3;` 中 `decltype((count))` 是什么？
2. `auto& [a,b] = tile;` 修改的是副本还是原对象？
3. 把两个 int 的乘积赋给 int64，是否就能避免乘法溢出？

::: details 对照答案
`decltype((count))` 是什么？若 count 是 `const int`，答案为 `const int&`。`auto& [a,b]` 修改谁？修改绑定的原对象。把乘法结果存进 int64 就不溢出吗？不，先决定运算在哪个类型中完成。
:::

依据：[auto deduction](https://eel.is/c++draft/dcl.spec.auto)、[decltype](https://eel.is/c++draft/dcl.type.decltype)、[Value Categories](https://eel.is/c++draft/basic.lval)、[Function Call](https://eel.is/c++draft/expr.call)。
