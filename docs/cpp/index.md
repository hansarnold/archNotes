---
title: "C++ 复习速查"
description: "面向写过 C++ 的开发者，按易忘规则、短例子、反例和自测快速找回语言与标准库的判断力。"
outline: deep
products: ["C++", "LLVM", "MLIR"]
documentType: "Cheat Sheet"
topics: ["Review", "Language Rules", "STL", "Lifetime", "Tooling"]
---

# C++ 复习速查

给写过 C++、现在需要找回手感的人。直接按问题查，不从 Hello World 重新学。默认以 **C++17** 为基线，较新的功能标明 **[20] / [23]**；语言版本与标准库支持要分别检查。

## 7 个专题，84 条易忘要点

每个专题 12 条：规则、短例子、易错边界，以及先预测再展开的自测。按问题跳读，不必顺序通读。手机可用本页目录和站内搜索定位 API 名。

| 专题 | 常忘什么 | 编号 |
| --- | --- | --- |
| [类型、初始化与表达式](./types.md) | const、auto、decltype、Value Category、初始化、转换与求值顺序 | T01–T12 |
| [生命周期、所有权与 Move](./lifetime.md) | RAII、View、临时对象、NRVO、Smart Pointer、Lambda Capture、失效 | L01–L12 |
| [类与对象模型](./classes.md) | 特殊成员生成、Rule of Zero/Five、Virtual、Slicing、explicit、noexcept | C01–C12 |
| [模板、推导与回调](./templates.md) | Forwarding Reference、折叠、forward、依赖名、SFINAE、Concepts、ADL | F01–F12 |
| [容器与算法](./stl.md) | reserve/resize、erase-remove、查找、排序、累加、Map、Proxy | S01–S12 |
| [现代 C++ 与并发](./modern.md) | [17]/[20]/[23] 差异、optional/variant、span/ranges、Thread、Atomic | M01–M12 |
| [构建、错误与调试](./tooling.md) | ODR、inline/static、头文件、UB、LLVM Error、PImpl、Sanitizer | G01–G12 |

想直接动手：[C++17 / C++20 可运行自测](./tooling.md#verification)。它验证代表性规则，并非证明全部 84 条或所有 UB 路径。

## 先扫这张易忘清单

| 看到这段代码 | 先想起这条规则 |
| --- | --- |
| [`auto x = ref`](./types.md#t03) | 通常得到独立值；要别名需显式 `&` |
| [`decltype(x)` / `decltype((x))`](./types.md#t04) | 前者有名字特例；后者按表达式值类别推导 |
| [`T&& x`，随后使用 `x`](./types.md#t06) | 常规表达式中，有名字的右值引用变量也是 lvalue |
| [`std::move(x)`](./lifetime.md#l04) | 只改变值类别；是否 Move 由重载决定 |
| [`std::move(const_x)`](./lifetime.md#l04) | 常见 Move 接收非 const 右值，可能最终 Copy |
| [`return std::move(local)`](./lifetime.md#l05) | 可能阻止 NRVO；通常直接返回 local |
| [`vector<int>(4, 9)` / `{4, 9}`](./types.md#t02) | 四个 9，与两个元素 4、9 |
| [`reserve(n)` 后写 `v[i]`](./stl.md#s02) | Capacity 不是 Size；预留空间没有创建元素 |
| [`map[key]`](./stl.md#s09) | 缺失 Key 时插入；只读查询用 `find` / [20] `contains` |
| [`remove_if`](./stl.md#s04) | 改的是逻辑范围，不会缩短容器；再 `erase` |
| [保存 `string_view` / `span`](./lifetime.md#l03) | 不拥有数据；先问谁活得更久 |
| [Lambda 的 `[=]` 使用成员](./lifetime.md#l11) | 可能捕获的是 this 指针，不是整个对象快照 |
| [类只新增 `~T() = default`](./classes.md#c02) | 用户声明析构也可能抑制隐式 Move |
| [`is_move_constructible_v<T>` 为 true](./classes.md#c02) | 不证明存在 Move Constructor；Copy 也可能接住右值 |
| [`shared_ptr` 跨线程](./modern.md#m11) | 引用计数同步不代表对象内容线程安全 |
| [`const` / `constexpr` / `consteval`](./modern.md#m02) | 只读约束、可参与常量求值、[20] 立即函数不是一回事 |

## 怎么复习，而不是重新上课

第一次扫清单，只标记“解释不出来”的项；每次复习抓一个小组。对代码先判断类型、结果、所有权和失效点，再看规则。遇到“有时能跑”的代码，分清保证行为、未指定行为、实现定义行为与 UB。

**4 小时只是优先复习预算，不是全部知识点的阅读上限。** 这是独立的语言复习路线。需要时可与 8 小时 AI Compiler 路线搭配成 12 小时计划，但两个分区不互相穿插。

| 复习时段 | 用时 | 任务 |
| --- | ---: | --- |
| A1 | 35 分钟 | 类型、初始化、const、值类别与推导 |
| A2 | 35 分钟 | Lifetime、RAII、Copy/Move、失效 |
| A3 | 50 分钟 | 先预测，再做原有三个修错任务 |
| B1 | 30 分钟 | 类、模板、Lambda 与 LLVM 常见类型 |
| B2 | 25 分钟 | 容器/算法速查，并回忆 ODR、异常与并发边界 |
| B3 | 65 分钟 | 完成或重写微型 Pass，运行测试并解释一次条件变化 |

现有练习入口：[C++ 复习 A](../mlir/cpp-refresh.md)、[C++ 复习 B：微型 Pass](../mlir/cpp-labs.md)。已能独立完成的任务可用作 10 分钟验收，把剩余时间用于薄弱项。

## 资料边界

组织方式参考 [hackingcpp 的 Cheat Sheets](https://hackingcpp.com/cpp/cheat_sheets)。这里采用自己的中文解释、例子与测试，不镜像其文章或整套图表；原站适合并排查阅。规则依据链接到 C++ 标准草案、Core Guidelines 与 LLVM 官方资料。标准草案是持续更新的文档，阅读时仍要注意本页的版本标注。
