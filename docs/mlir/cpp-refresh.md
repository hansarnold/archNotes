---
title: "C++ 快速回温：先判断再运行"
description: "用值与引用、生命周期、RAII、Copy/Move 和容器失效练习恢复 C++ 代码推理能力，配套可运行程序和三个修错任务。"
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "复习与练习"
topics: ["Ownership", "Lifetime", "Move Semantics", "Containers", "Debugging"]
---

# C++ 快速回温：先判断再运行

Day 1 单元 3，共 120 分钟：自测 10、概念与预测 40、运行观察 20、修错 40、复述 10。目标是找回对代码行为的判断，而不是记住所有语言规则。

## 10 分钟自测

先不查资料，分别用一句话回答：

1. `for (auto node : nodes)` 修改的是谁？
2. `const T*` 与 `T* const` 分别限制什么？
3. 返回 `std::string_view` 时，谁保证字符还活着？
4. `std::move(x)` 本身会搬运数据吗？
5. `vector.reserve(100)` 后，`size()` 就变成 100 吗？
6. `push_back` 后，旧指针和旧 iterator 还能用吗？

把不确定处标出来。后面的时间优先用在这些点，每个点都补一个具体例子。

## 值、引用、指针与 auto

```cpp
std::vector<int> nodes{1, 2, 3};
for (auto node : nodes) node += 10;
for (auto &node : nodes) node += 10;
```

第一个循环逐元素拷贝，修改副本；第二个循环绑定原元素。`const auto&` 可以避免拷贝并禁止通过该引用修改元素。`auto` 不是“自动引用”，要观察声明是否有 `&`。

| 参数形式 | 调用者交给函数什么 | 常见用途 |
| --- | --- | --- |
| `T value` | 一个独立参数对象，可能 Copy 或 Move | 小值，或函数需要拥有/保存的数据 |
| `const T& value` | 对已有对象的只读访问 | 大对象的只读输入；不自动延长所有生命周期 |
| `T& value` | 对已有对象的可写访问 | 修改原对象 |
| `T* value` | 一个地址，可以为空 | 可选访问；仅从语法不能推断所有权 |

`const T*` 限制通过指针修改所指对象；`T* const` 限制指针变量换地址。`const` 并不意味着对象在所有别名下都不可变，也不代表线程安全。

::: details 追问：函数把 const T& 保存起来，调用后安全吗？
要看被引用对象的生命周期。参数能在调用期间被访问，不代表函数可以长期保存它。需要长期保存时，明确复制、转移所有权，或要求调用者保持对象存活。
:::

## Ownership 与 Lifetime

Ownership 回答“谁负责资源”，Lifetime 回答“对象什么时候存在”。RAII 把资源释放绑定到对象析构，例如 `unique_ptr` 管理对象，`vector` 管理元素存储，`lock_guard` 管理锁。

`unique_ptr` 表示独占所有权，不能 Copy，可以 Move。`shared_ptr` 表示共享所有权，需要考虑引用计数和循环引用；仅仅“不知道谁拥有”并不是使用它的充分理由。借用一个对象可以使用引用、指针或 view，但要明确谁活得更久。

下面是**只用于代码 review 的错误例子，不要靠运行结果证明它安全**：

```cpp
std::string_view brokenName() {
  std::string local = "matmul";
  return local; // 错误：返回后 local 销毁，view 悬空。
}
```

修复方式之一是返回拥有字符的 `std::string`。`string_view` 本身只保存对字符的访问范围；复制这个 view 不会复制字符，也不会延长字符的生命周期。

对 Compiler 尤其要注意：一个轻量的 Operation/Value handle 仍依赖底层 IR 对象。不能因为 handle 可以 Copy，就认为删除底层 Operation 后仍能使用它。

## Copy、Move 与 Rule of Zero

`std::move` 是一次类型转换，让表达式可以参与 Move 相关的重载选择。实际是否搬运、如何搬运，由选中的构造函数或赋值函数决定。

```cpp
Tracked source{"tensor"};
Tracked copied{source};
Tracked moved{std::move(source)};
const Tracked frozen{"weight"};
Tracked fromConst{std::move(frozen)};
```

先预测每行 Copy/Move 次数，再运行：

```sh
python3 labs/compiler_bootcamp/run_cpp.py semantics
```

::: details 参考结果
```text
by value: 1
by reference: 11
copy
move
copy
owner empty: true
new owner: owned
```
本例 `Tracked` 的 Move 构造接收 `Tracked&&`，不能绑定 `const Tracked&&`，因此最后选择 Copy。移动 `unique_ptr` 后源指针为空；其他类型的 moved-from 状态要看该类型的契约，不能统一假定“全部变空”。

例子保留了一个“副本被修改后未使用”的 compiler warning，这正是第一个循环的提示。它不是运行失败。
:::

优先让 `string`、`vector`、智能指针等成员管理资源，这叫 **Rule of Zero**：类无需自己实现整套析构、Copy、Move。必须直接管理资源时，再学习 Rule of Five。`noexcept`、copy elision 和 perfect forwarding 的完整规则放到后续；这次先把参数绑定判断清楚。

## 容器变化之后，引用是否还有效

| 操作 | 必须记住的后果 |
| --- | --- |
| `vector.reserve(n)` | 提高 capacity 的下限；不增加 size。发生重分配会使元素指针、引用和 iterator 失效 |
| `vector.resize(n)` | 改变 size，可能构造/销毁元素；可能重分配 |
| `vector.push_back` | 若重分配，全部元素引用/指针/iterator 失效；无重分配时旧元素访问有效，但旧 `end()` 失效 |
| `vector.erase(it)` | 被删位置及之后的 iterator/reference 失效；返回新的后继 iterator |
| `unordered_map` rehash | iterator 失效；现有元素的指针和引用通常仍有效，删除该元素则失效 |

如果遍历时修改结构，先想 iterator 的有效性。不要把 `reserve` 当成任意容器修改都安全的保证。

::: details 练习：为什么删除相邻负数容易漏掉一个？
`erase` 后的后继元素已经移到当前位置；再无条件递增就跳过它。正确形式是 `it = values.erase(it)`，只有保留元素时才 `++it`。
:::

## 动手：三个修错任务

从仓库根目录执行，第一次会明确报 `TODO`：

```sh
python3 labs/compiler_bootcamp/run_cpp.py repairs
```

打开 [repairs.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/repairs.cpp)，完成：

1. 给原始节点名称加上 `op.` 前缀。
2. 从暂时有效的 `string_view` 生成可长期保存的名称。
3. 删除所有负数，覆盖相邻负数、末尾元素和空容器。

Starter 以显式异常替代危险的悬空访问，不会要求你执行 UB。测试检查行为，代码 review 仍要检查所有权和失效规则。

::: details 提示：只在独立尝试后打开
第一个任务用可写引用；第二个任务返回 owning `string`；第三个任务用 `erase` 的返回值。每完成一个任务重新运行，确认失败信息推进到下一项。
:::

::: details 完整答案与验证入口
参考实现是 [repairs_solution.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/repairs_solution.cpp)。
```sh
python3 labs/compiler_bootcamp/run_cpp.py repairs_solution
python3 labs/compiler_bootcamp/run_cpp.py repairs_solution --sanitize
```
ASan/UBSan 是支持的 compiler/runtime 上的附加检查。无报告不能单独证明所有代码路径都安全；同时说明谁拥有每份数据。
:::

## 结束前复述

选择你改动的一行，解释对象在哪里、是否发生 Copy、哪一步会使引用失效、怎样验证。Day 2 将在 [C++ 微型 Pass](./cpp-labs.md) 中复习类、模板、Lambda 和 LLVM 常见类型。

依据：[C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)、[LLVM Programmer’s Manual](https://llvm.org/docs/ProgrammersManual.html)、[C++ draft: vector modifiers](https://eel.is/c++draft/vector.modifiers)。
