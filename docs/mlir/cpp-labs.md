---
title: "C++ 微型 Constant Folding Pass"
description: "复习类、模板、Lambda 和 LLVM 常见类型，亲手实现有语义约束与验证的 Constant Folding Pass。"
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "动手实验"
topics: ["Constant Folding", "Templates", "Lambda", "Verification", "IR"]
---

# C++ 微型 Constant Folding Pass

所属分区：[C++ 复习](../cpp/index.md)，复习 B，共 120 分钟：类/模板/LLVM 类型复习 30、STL 与错误边界 25、实现 Pass 与验证及复述 65。先完成 [C++ 复习 A](./cpp-refresh.md)。

按薄弱项查 [类与对象模型](../cpp/classes.md)、[模板与回调](../cpp/templates.md)、[STL](../cpp/stl.md)和[构建、错误与调试](../cpp/tooling.md)。特别留意特殊成员生成、Forwarding Reference、失效规则、accumulate 的初值类型，以及 LLVM Error 的处理义务。[现代 C++ 与并发](../cpp/modern.md)作为独立速查，不要求本练习变成并发程序。

## 读 Compiler 代码时常见的语法

| 语法 | 读法 | 当前需要掌握的程度 |
| --- | --- | --- |
| `enum class Kind` | 有作用域的枚举 | 用 `Kind::Add` 区分节点种类 |
| `explicit C(T x)` | 限制隐式转换的构造函数 | 区分构造对象与普通函数调用 |
| `virtual` / `override` | 动态接口与覆盖检查 | 通过基类指针销毁派生对象时，检查析构契约 |
| `template<class F>` | 按类型生成代码 | 识别参数类型与实例化位置 |
| `using Base::Base` | 继承基类构造函数 | 能读懂 Pattern 类常用骨架 |
| `[&]` / `[=]` / `[x]` | Lambda 捕获 | 判断捕获的是引用还是副本，以及是否逃逸 |
| `std::optional<T>` | 可能没有结果 | 先检查再解引用；不是一个任意默认数值 |

### Lambda 的一个生命周期问题

一个回调捕获局部变量的引用，如果被存储起来并在函数返回后执行，就可能悬空。即时遍历和异步保存回调的契约不同。按值捕获也不会自动复制捕获指针所指向的对象。

### 读懂模板骨架即可

```cpp
template <class Fold>
int testPass(Fold fold) {
  Graph graph = makeExample();
  auto changed = fold(graph);
  return changed == 1 ? 0 : 1;
}
```

这是语法示意，`makeExample` 表示示例输入构造。真实练习的 `testPass` 在 `mini_ir.hpp` 中：接受可调用对象，给它传入 Graph，再验证结果。现在先读懂类型与调用关系，复杂模板元编程留到需要时再查。

## 教学 IR 的完整契约

节点只有 `Constant`、`Input`、`Add` 三种。Graph 是按依赖顺序存放的 `vector<Node>`，每个 Add 的输入必须指向更早的节点。最后一个节点是程序输出，所有 Input 读取同一个外部输入值。

算术采用 **checked signed i64**：超出范围就拒绝求值。它不是 MLIR `arith.addi` 的 modulo 语义。这个区别是练习的一部分：Compiler 不能用宿主语言的未定义行为实现 IR 规则。

```text
%0 = constant 2
%1 = constant 3
%2 = add %0, %1
%3 = input
%4 = add %2, %3
```

这是自定义教学表示，不是可直接交给 `mlir-opt` 的文件。输入为 7 时，结果应为 12。

## 你需要实现的函数

```sh
python3 labs/compiler_bootcamp/run_cpp.py fold
```

Starter 能编译，但测试会提示缺少折叠。打开 [fold.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/fold.cpp)，实现 `foldConstants(Graph&)`：

1. 先 Verify Graph。
2. 按顺序找到 Add。
3. 两个 operand 都是 Constant 才尝试 `checkedAdd`。
4. 成功时把**当前节点**改成 Constant，返回变更数量。
5. 未知值或溢出保留原节点。保持节点索引不变。

不要在这里 erase 节点或 push 新节点；这样可以聚焦一个变换，并避免移动存储造成引用或索引失效。真实 MLIR 中的替换和删除应通过 Rewriter 管理，而不是直接套用这个教学容器的修改方式。

::: details 第一级提示
`for (auto &node : graph)` 修改原节点。检查 `node.kind` 后，通过 `node.lhs` 和 `node.rhs` 找到输入节点。`checkedAdd` 返回 optional，先判断是否有值。
:::

::: details 第二级提示：为什么一遍就能折叠常量链？
Verifier 要求 operand 指向之前的节点。因此访问当前节点时，前面的 Add 已经有机会变成 Constant。这个教学 Graph 不含循环，也没有改拓扑；推广到任意 IR 时可能需要 worklist、数据流分析或迭代。
:::

::: details 完整核心答案
```cpp
std::size_t foldConstants(Graph &graph) {
  verify(graph);
  std::size_t changed = 0;
  for (auto &node : graph) {
    if (node.kind != Kind::Add) continue;
    const auto &lhs = graph[node.lhs];
    const auto &rhs = graph[node.rhs];
    if (lhs.kind != Kind::Constant || rhs.kind != Kind::Constant) continue;
    const auto sum = checkedAdd(lhs.value, rhs.value);
    if (!sum) continue;
    node = Node{Kind::Constant, *sum};
    ++changed;
  }
  return changed;
}
```
完整可运行实现：[fold_solution.cpp](https://github.com/hansarnold/archNotes/blob/main/labs/compiler_bootcamp/fold_solution.cpp)。
:::

## 验证为什么比看输出更重要

测试不仅检查 `%2 = constant 5`。还会检查含变量的 Add 保留、21 个输入上的结果一致、常量链、负数、第二遍不再变化、正负两个方向溢出和非法依赖。

```sh
python3 labs/compiler_bootcamp/run_cpp.py fold
python3 labs/compiler_bootcamp/run_cpp.py fold --sanitize
```

参考答案可用 `fold_solution` 运行。测试证明所覆盖输入和契约，不是任意 Compiler 的形式化证明。

再做一次条件变化：把一个 Constant 改成 Input。预测哪个节点不再能折叠，说明你的 Pass 是否仍正确。**这一步不能只照抄参考代码。**

## LLVM / MLIR 的常见类型桥梁

| 类型或工具 | 怎么理解 | 需要留心的地方 |
| --- | --- | --- |
| `StringRef` | 非 owning 字符范围 | 原字符存储要活得足够久 |
| `ArrayRef<T>` | 非 owning 连续元素范围 | 不拥有元素；原容器变化可能使访问失效 |
| `SmallVector<T>` | 小规模时可用内联存储的 vector | 扩容和修改仍可能使引用失效 |
| `isa<T>` / `dyn_cast<T>` | 检查实际类型 / 尝试转换 | 按 API 契约处理不匹配或空值 |
| `function_ref` | 非 owning 可调用对象引用 | 通常用于即时回调，不能随意保存 |
| `LogicalResult` | 成功或失败的状态 | 不等同于一个计算数值 |

读取 [MLIR Toy Chapter 3](https://mlir.llvm.org/docs/Tutorials/Toy/Ch-3/) 中的 Rewrite 示例，只圈出“匹配条件”“替换动作”“失败返回”。它使用完整框架；先把本练习中的三部分对应起来。

## 结束前的五个问题

谁拥有 Graph？`auto&` 为什么重要？为什么不能在当前遍历里随便扩容？为什么 `INT64_MAX + 1` 不能直接在 C++ 中计算？为什么结构变短不等于已经证明程序更快？

完成后回到 [C++ 复习总览](../cpp/index.md)，选择下一项薄弱点。类型和所有权细节参考 [LLVM Programmer’s Manual](https://llvm.org/docs/ProgrammersManual.html) 与 [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)。

## 复习讨论 {#review-discussion}

完成练习后，独立解释这两题；它们属于语言复习，不计入 Compiler 概念路线验收。

### 1. `auto`、引用与 `std::move` 最容易误判什么？

<details>
<summary>参考答案、追问与误区</summary>

对元素逐值遍历通常修改的是副本，逐引用遍历才修改原元素。引用和 `string_view` 不拥有底层对象，必须检查其生命周期。`std::move` 是允许使用移动重载的类型转换，不执行搬运；对 `const` 对象常会选择 Copy，因为通常的 Move Constructor 接受非 const 右值引用。

追问：Move 后原对象能不能读取？要看对象状态与操作前置条件。标准库类型通常保持 valid but unspecified 状态；`unique_ptr` 移动构造后源指针为空有明确保证，不要把这个保证推广到所有用户类型。

误区：`const` 自动延长被引用对象的生命周期，或者任何 moved-from 对象都必然为空。

</details>

### 2. 为什么遍历 `vector` 时删除/新增元素很危险？

<details>
<summary>参考答案、追问与误区</summary>

`erase` 使删除位置及之后的 Iterator/Reference 失效，应接住它返回的下一个 Iterator；发生 Reallocation 的 `push_back` 会使已有元素的指针、引用和 Iterator 全部失效。`reserve` 不是所有修改的通用安全符。

追问：微型 Pass 为什么只原地替换节点、不 `erase`？节点以位置作为 ID，擦除会移动后面的节点并破坏操作数索引；真实 IR 需要维护 Use-def 与变换协议，不能直接套用普通容器操作。

误区：元素还“看起来在原来的地址”就认为访问一定合法。

</details>
