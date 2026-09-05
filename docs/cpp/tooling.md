---
title: "C++ 编译链接、诊断与自测速查"
description: "12 个工程复习点：Translation Unit、ODR、Header、static、宏、UB、数值、错误传播、PImpl、构建、诊断和可运行自测。"
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Build", "Linking", "ODR", "Diagnostics", "Verification"]
---

# 编译链接、诊断与自测

[复习总入口](./index.md) · **优先 G01–G06、G11–G12**。把编译期错误、链接期错误、运行时错误和语义错误分开定位。

## G01 · Translation Unit 是编译器看到的单位 {#g01}

一个源文件加上预处理带来的内容，形成 Translation Unit。声明告诉编译器接口；定义提供实体或函数体。声明能让调用通过编译，不代表链接器一定能找到对应实现。Signature、Namespace、ABI、链接库和模板实例化都可能导致 unresolved symbol。

## G02 · ODR 与 inline 不只是性能话题 {#g02}

普通非 inline 函数的定义不要直接复制进多个 Header 使用者。Header 中的 inline 函数、类和模板允许在满足 ODR 的条件下跨 Translation Unit 出现定义，并非任意不同定义都合法。inline 不要求机器码一定内联；[17] inline variable 可表达适当的跨 TU 变量定义。

## G03 · Header 自包含，Forward Declaration 只能解决部分依赖 {#g03}

Header 应自行包含接口需要的声明，不依赖“别的头文件恰好 include 了它”。Incomplete Type 可用于部分指针/引用声明，不能无条件用于 sizeof、成员布局或对象销毁。Include Guard / pragma once 解决同一 TU 中重复包含，不解决跨 TU 的 ODR 冲突。不要在公共 Header 写 using namespace std。

## G04 · static 在不同位置不是同一个意思 {#g04}

| 位置 | 作用 |
| --- | --- |
| Namespace scope 的 static | Internal Linkage：实体局限于该 TU |
| 函数内 static | 静态存储期；[11] 局部 static 的初始化有线程安全保证 |
| 类内 static member | 不属于某个对象实例；定义规则按成员种类/版本检查 |
| thread_local | 每线程存储；不自动同步其他共享对象 |

局部 static 初始化线程安全，不意味着后续所有读写线程安全。跨 TU 的动态初始化顺序仍需谨慎设计。

## G05 · 宏是文本机制，别忘多次求值 {#g05}

`#define SQUARE(x) ((x)*(x))` 中 SQUARE(i++) 会多次修改 i，不能靠多加括号修复求值问题。优先用合适的 inline/constexpr 函数；宏用于确有需要的条件编译或代码生成。多语句宏常用 do/while(0) 包裹，但仍要审查实参求值和名字碰撞。

## G06 · 四种“没有固定结果”不能混叫 UB {#g06}

| 类别 | 含义 | 本库的例子 |
| --- | --- | --- |
| Ill-formed | 违反语言规则，通常需诊断；部分 ODR 违反不要求诊断 | 花括号窄化、复制 unique_ptr |
| Implementation-defined | 实现选择并记录行为 | 某些类型表示/实现特性 |
| Unspecified | 允许多个合法结果，不必固定选择 | 适用场景中的参数求值顺序 |
| Undefined Behavior | 标准不再约束行为 | signed overflow、悬空访问、Data Race |

“Debug 能跑”与“每次都打印同一个值”都不能证明没有 UB。编译失败也不总是语言规则：可能是缺少头文件或库功能未实现。

## G07 · 数值与对象表示要独立审查 {#g07}

Signed/Unsigned 混用、Shift Count、越界、Alignment、错误访问类型，都可能让看似合理的底层优化失效。不要把“位宽够大”当成所有数值约束已经满足。浮点精度、NaN、signed zero、FMA 和重排要跟 IR/硬件契约对齐，而不是照搬宿主 C++ 表达式。

## G08 · 错误传播方式属于接口契约 {#g08}

| 方式 | 适用问题 | 需要保持清楚 |
| --- | --- | --- |
| bool / LogicalResult | 成功或失败 | 状态不是计算结果；检查返回值 |
| `optional<T>` | 有值或缺失 | 缺失是否需要错误原因 |
| `expected<T,E>` [23] / 项目 Result | 值或显式错误 | 调用链怎样传播 E |
| Exception | 非局部失败传播 | noexcept、清理与项目是否启用异常 |

LLVM 常见 Error/Expected，MLIR 常见 LogicalResult/FailureOr；以所读项目 API 为准。不要对着禁用异常的构建配置直接搬入抛异常方案。`[[nodiscard]]` 是检查未使用结果的辅助，不是自动处理失败。

## G09 · PImpl 与不完整类型析构 {#g09}

```cpp
// Header
class Engine {
  struct Impl;
  std::unique_ptr<Impl> impl;
public:
  Engine();
  ~Engine(); // 在 Impl 完整定义可见的 .cpp 中定义
};
```

PImpl 可隐藏布局与实现依赖；持有 `unique_ptr<Incomplete>` 不代表在任何位置实例化默认删除器都安全。显式声明析构还影响 Move，按 [C02](./classes.md#c02) 重新决定复制/移动接口。不要简单把 Header 中所有函数都写成 =default。

## G10 · 构建配置也会改变你在验证什么 {#g10}

确认 Language Standard、Compiler、Standard Library、Debug/Optimization、RTTI/Exception 设置和实际使用的 Include/Library 路径。CMake 负责配置生成，Ninja 等执行构建规则；新改的源文件若不在 Target 中，成功构建并不证明它被编译。Header-only 不等于零编译成本。

## G11 · 诊断工具的覆盖范围 {#g11}

| 工具 | 擅长发现 | 不能证明 |
| --- | --- | --- |
| Warning / Static Analysis | 可疑转换、生命周期、控制流 | 所有运行路径正确 |
| ASan | 被覆盖路径上的多类内存错误 | 没有 Data Race 或全部逻辑错误 |
| UBSan | 被覆盖路径上的若干 UB 类别 | 所有 UB 都有检查 |
| TSan | 被覆盖并发路径上的多类 Data Race | 并发算法在全部调度下正确 |
| Debugger / assert | 具体状态与不变量 | Release 下必然保留断言；NDEBUG 会移除 assert |

这些工具有平台、编译器与组合限制；TSan 不应与 ASan 当成同一个随意叠加的开关。下面的验证用显式失败检查，避免因为 NDEBUG 就变成全绿。

## G12 · 可运行的复习探针 {#g12}

### 验证与自测 {#verification}

在仓库根目录运行，不依赖 GPU 或 MLIR Build：

```sh
python3 -B labs/cpp_review/run.py --std 17
python3 -B labs/cpp_review/run.py --std 20
```

第一条运行 C++17 的类型/行为探针，再验证六段应被拒绝的代码。第二条检查 C++20 Concepts、span、ranges、consteval/constinit 等探针。工具会打印所用 Compiler、每个检查组和成功数量；编译或运行超时不算通过，也不会悄悄跳过不支持的模式。

源码与具体覆盖清单：[自测 README](https://github.com/hansarnold/archNotes/blob/main/labs/cpp_review/README.md)。**探针覆盖代表性规则，不等于 84 个知识点全部经过动态证明**；非法 Lifetime 与 Data Race 示例用于静态审查，不作为要执行的实验。C++23 条目仅供速查。

### 先预测，再展开

1. Header 有 include guard，就能在多 TU 中定义同一个普通外部函数吗？
2. 局部 static 初始化线程安全，是否意味着后续读写也安全？
3. NDEBUG 下只用 assert 的测试，是否仍在检查条件？

::: details 对照答案与复习方法
不能：Include Guard 不解决跨 TU 的 ODR 约束。不是：初始化后的共享读写仍需同步。不是：NDEBUG 会移除 assert，因此探针使用显式失败检查。

先写下三项预测：能不能编译、实际类型/输出、哪一步可能失效。然后只改一个条件，例如把参数加 const、把 auto 改成 auto&、把返回类型改为 decltype(auto)。解释差异，再运行安全的版本；UB 反例停在代码审查，不靠观察结果猜规则。
:::

接下来可做 [C++ 修错](../mlir/cpp-refresh.md)或[微型 Pass](../mlir/cpp-labs.md)。依据：[ODR](https://eel.is/c++draft/basic.def.odr)、[Storage Duration](https://eel.is/c++draft/basic.stc)、[Clang Diagnostics](https://clang.llvm.org/docs/DiagnosticsReference.html)、[AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html)、[UBSan](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)、[ThreadSanitizer](https://clang.llvm.org/docs/ThreadSanitizer.html)。
