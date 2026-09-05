---
title: "现代 C++ 与并发易忘点速查"
description: "12 个现代标准库与并发复习点：constexpr、optional、variant、span、ranges、coroutine、thread、mutex、atomic 和版本支持。"
outline: deep
products: ["C++"]
documentType: "Cheat Sheet"
topics: ["Modern C++", "Concurrency", "Ranges", "Atomics", "Library Versions"]
---

# 现代 C++ 与并发

[复习总入口](./index.md) · **按需查阅**。并发代码必须按程序整体的同步关系推理；一张速查表不能替代完整验证。

## M01 · 标准年份与工具链支持分开看 {#m01}

| 标准 | 本库涉及的代表功能 |
| --- | --- |
| C++17 | Structured Binding、if constexpr、optional、variant、string_view、scoped_lock、inline variable |
| C++20 | Concepts、span、ranges、jthread、consteval、constinit、format、coroutine |
| C++23 | expected、print、move_only_function、mdspan、to_underlying |

打开 `-std=c++20` 不表示配套标准库实现了所有 [20] 功能。用 Feature-test Macro 与最小编译探针确认；不要悄悄把需要的新特性替换成语义不同的旧实现。

## M02 · const、constexpr、consteval、constinit {#m02}

| 关键字 | 回忆 |
| --- | --- |
| const | 限制修改；初始化不一定在编译期 |
| constexpr variable | 要求适当的常量初始化，并使对象 const |
| constexpr function | 满足条件时可参与常量求值，也可能运行时执行 |
| consteval [20] | 立即函数，要求适用调用产生常量表达式 |
| constinit [20] | 静态/线程存储对象的常量初始化约束；不意味着之后只读 |

“编译器最后优化成常量”与语言规则要求的 Constant Expression 不是同一判断。

## M03 · optional：没有值不是一个默认值 {#m03}

```cpp
std::optional<int> result;
if (result) use(*result);
int fallback = result.value_or(0);
```

空 optional 的 `value()` 会抛；直接 `*result` 要先满足有值前提。`value_or(expensive())` 的实参仍会求值，即便已有值。在本库的 C++17–23 范围内，optional 不直接支持 T&；可按需求使用 reference_wrapper 或明确的指针契约，勿将更新草案中的扩展倒推到旧版本。

## M04 · variant 与 any 解决不同的问题 {#m04}

Variant [17] 是已知候选类型的和类型，常用 visit 分派；访问错误分支的 get 会抛，get_if 可返回空。它可能 valueless_by_exception。Any [17] 做开放类型集合的 Type Erasure；any_cast 仍需知道正确类型，且存储对象有相应 Copy 要求。两者都不是随意绕过类型系统的保险箱。

## M05 · span 是视图，不是小 vector {#m05}

```cpp
void increment(std::span<int> values) { // [20]
  for (int& value : values) ++value;
}
```

它表示连续元素范围，不负责分配、增长或延长寿命。Fixed Extent 属于类型约束，Dynamic Extent 可携带运行时长度。C++20 span 的 `operator[]` 不是通用的抛异常边界检查；仍需保证下标合法。

## M06 · Ranges View 常是惰性的，所有权要逐个看 {#m06}

```cpp
auto positive = values | std::views::filter([](int x) { return x > 0; }); // [20]
```

构造 View 不代表已经生成了筛选结果副本。某些 View 借用、某些可拥有底层范围；检查具体 Adaptor 与版本。修改底层容器可能使 Iterator 失效，某些 View 还会缓存位置；不要把“惰性”当成“随时修改也能自动刷新”。算法返回的 dangling 标记也不能保证所有被你保存的 View 都安全。

## M07 · Coroutine 不等于线程，也不自动并行 {#m07}

Coroutine [20] 允许暂停/恢复，并由 Promise、Awaiter 与调用约定决定行为；调度器、线程切换和 I/O 不是关键字自动提供的。暂停期间保存的引用、this 与外部 Buffer 仍需存活，Coroutine Frame 的销毁责任也要明确。

## M08 · thread 的析构与 jthread 的停止 {#m08}

一个仍 joinable 的 std::thread 被析构会终止程序；必须按设计 join 或 detach。Detach 不是修复 Lifetime 问题的捷径。[20] jthread 析构会请求停止并在 joinable 时 join；Stop Token 是协作请求，不会强行杀掉任务。任务忽略停止或被永久阻塞，析构仍可能等待。

## M09 · Lock 与 Condition Variable 的最小纪律 {#m09}

用 lock_guard 管简单作用域锁，需要可解锁或 wait 时用 unique_lock；[17] scoped_lock 可管理多个 Mutex 的加锁。Condition Variable 允许 Spurious Wakeup，应在同一共享状态/锁协议下使用 Predicate。

```cpp
std::unique_lock<std::mutex> lock(mutex);
cv.wait(lock, [&] { return ready; }); // wait 期间释放锁，返回前重新持锁
```

只“发一个通知”不等于状态已经正确同步；先设计状态和谓词，再设计通知。

## M10 · Atomic 的 Relaxed 不会发布其他普通数据 {#m10}

```cpp
// 初始 ready=false；payload 在发布后不再修改；仅此一对 producer/consumer。
// Producer: payload = 42; ready.store(true, std::memory_order_release);
// Consumer: if (ready.load(std::memory_order_acquire)) use(payload);
```

当 Acquire 观察到对应 Release 发布的值时，可以建立所需的同步关系。Relaxed 保证该 Atomic 的原子性与相关修改顺序，不为任意其他对象建立 Happens-before。默认 seq_cst 也不会自动修复一个需要多步事务的算法。出现 Data Race 是 UB，不是仅有“旧值”。

## M11 · shared_ptr 的线程安全分三层 {#m11}

区分 Control Block、某个 shared_ptr 变量、被管理对象。不同实例的引用计数操作可以安全并发；并发修改同一个 shared_ptr 变量需要同步或 [20] `atomic<shared_ptr<T>>`；pointee 的普通字段仍要自己的同步。`use_count()==1` 不是免锁修改对象的通用证据。

## M12 · 新接口的价值与边界 {#m12}

| 功能 | 想解决什么 | 仍需确认 |
| --- | --- | --- |
| format [20] / print [23] | 类型化格式输出 | 实际标准库支持；格式与 Locale 要求 |
| `expected<T,E>` [23] | 值或错误的显式结果 | 错误传播策略；不自动处理失败 |
| mdspan [23] | 多维索引、Layout、Accessor 的视图 | 不自动拥有存储或生成高效 Kernel |
| Modules [20] | 模块接口与依赖可见性 | 编译器、构建系统、BMI 与 ABI 兼容性 |

本库的可运行探针区分 C++17 与 C++20；以上 C++23 功能是版本速查，不声称本机已全部运行验证。

### 先预测，再展开

1. Atomic 指针是否自动保护被指向对象的普通字段？
2. jthread 析构能否强制停止忽略 Stop Token 的死循环？
3. value_or 的备用值是否惰性求值？

::: details 对照答案
Atomic 指针指向的普通对象就线程安全了吗？不是。Jthread 会强制终止死循环吗？不会。Value_or 会惰性计算备用值吗？普通实参仍求值。
:::

依据：[Optional](https://eel.is/c++draft/optional)、[Span](https://eel.is/c++draft/views.span)、[Ranges](https://eel.is/c++draft/ranges)、[Data Races](https://eel.is/c++draft/intro.races)、[Memory Order](https://eel.is/c++draft/atomics.order)、[jthread](https://eel.is/c++draft/thread.jthread.class)。
