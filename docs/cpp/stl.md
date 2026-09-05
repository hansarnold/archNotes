---
title: "C++ STL 容器、算法与字符串速查"
description: "12 个标准库复习点：容器选型、容量、失效、erase-remove、查找、输出 Iterator、排序去重、数值累计和 map 插入。"
outline: deep
products: ["C++", "LLVM"]
documentType: "Cheat Sheet"
topics: ["STL", "Containers", "Algorithms", "Strings", "Complexity"]
---

# STL 容器、算法与字符串

[复习总入口](./index.md) · **优先 S02–S09**。先问算法的前置条件、结果范围与元素 Lifetime，再问复杂度。

## S01 · 容器按访问模式选 {#s01}

| 容器 | 值得选它的原因 | 代价/限制 |
| --- | --- | --- |
| vector | 连续存储、随机访问、常见遍历基线 | 中间插入/删除搬移元素；增长可能失效 |
| deque | 两端增长、随机访问 | 不保证整体连续；失效规则要按操作查 |
| list / forward_list | 节点稳定性、已有位置的链表操作 | 分配与指针追逐，不能随机访问；找位置仍需时间 |
| map / set | 有序 Key、树式查询 | 常见操作 logarithmic；Key 的比较决定等价 |
| unordered_map / set | Hash 查询，平均常数时间 | 最坏线性、Rehash、迭代顺序不保证稳定 |
| array | 固定数量的连续元素 | 长度属于类型，不动态增长 |

不要用“大 O 相同”推断真实速度相同；Cache、分配、元素大小与 workload 都影响结果。

## S02 · reserve、resize、emplace_back {#s02}

```cpp
std::vector<int> v;
v.reserve(100);                 // size 仍为 0
v.resize(3);                    // 三个有效元素，int 值为 0
v.emplace_back(7);              // size 变 4
```

Emplace 是在目标位置用实参构造，并不保证比 push_back 快；若你已经构造了临时 T，emplace_back(T{...}) 仍可能移动临时量。Reserve 可能降低重复分配，不能提前访问尚不存在的元素。

## S03 · Iterator 失效与索引变义不同 {#s03}

重分配可能使指针/引用失效；即使只保存整数索引，erase 后“原来的第 5 个元素”也可能变了。需要稳定身份时设计独立 ID，不要把 vector 下标永久当对象身份。具体规则见 [L10 失效表](./lifetime.md#l10)。

## S04 · erase-remove 是两步 {#s04}

```cpp
auto newEnd = std::remove_if(v.begin(), v.end(), [](int x) { return x < 0; });
v.erase(newEnd, v.end());
// [20] std::erase_if(v, [](int x) { return x < 0; });
```

remove_if 把保留元素移到前段，返回逻辑 end；尾部仍有有效但内容未指定的元素，容器 Size 尚未改变。真正删除与缩短发生在 erase。不要只调用 remove_if 后继续按旧 Size 读有效结果。

## S05 · find 不需要排序，lower_bound 有范围前提 {#s05}

Find 可线性扫描；lower_bound 要求范围按对应谓词分区，排序范围是常见充分条件。它返回第一个“不小于目标”的位置，可能等于 end；还要额外比较才能确认目标存在。不要直接解引用它的返回值。

## S06 · 算法不会自动帮 vector 扩容 {#s06}

```cpp
std::vector<int> out;
std::copy(v.begin(), v.end(), std::back_inserter(out));
// copy(v.begin(), v.end(), out.begin()) 对空 out 不安全
```

另一种方式是先把 out resize 到足够长度。仅 reserve 不够。算法对重叠范围各有要求，移动重叠元素时根据方向和契约选 copy/move 或 backward 版本。

## S07 · sort、unique 与比较器 {#s07}

```cpp
std::sort(v.begin(), v.end());
v.erase(std::unique(v.begin(), v.end()), v.end());
```

unique 只折叠相邻等价元素，不是全局去重；排序会改变原始顺序。sort 不保证保持等价元素原顺序，需要时用 stable_sort。比较器使用严格关系，如 `<`，不是 `<=`；含 NaN 的浮点数据还需明确总的排序策略，不能盲目假定普通 < 在此输入域满足要求。

## S08 · accumulate 的初值决定累加器类型 {#s08}

```cpp
std::vector<double> costs{0.5, 1.5};
auto wrong = std::accumulate(costs.begin(), costs.end(), 0);   // int 累加器
auto total = std::accumulate(costs.begin(), costs.end(), 0.0); // double
```

整数求和时，初值太窄也可能溢出。Reduce [17] 允许不同分组/顺序，浮点结果可能不同；不能为了并行就假定每个运算满足结合律。SIMD、FMA 与 fast-math 也要遵守数值契约。

## S09 · map 的读取、插入、覆盖各有接口 {#s09}

| 意图 | 选择 | 容易漏掉的点 |
| --- | --- | --- |
| 不插入地查找 | find / at / [20] contains | at 缺失时抛；find 要检查 end |
| 缺失才构造 mapped value | try_emplace [17] | Key 已有时不在容器内构造 mapped value，但函数实参表达式仍先求值 |
| 已有就覆盖，否则插入 | insert_or_assign [17] | 会修改已有值 |
| 获取可写槽位 | operator[] | 缺失就插入默认值，不是纯查询 |

`try_emplace(key, expensive())` 仍会调用 expensive；需要惰性计算时先决定是否调用，且并发场景还要处理同步。

## S10 · `vector<bool>` 的元素不是普通 bool& {#s10}

它可使用位压缩与 Proxy Reference。`auto bit = flags[0]` 可能保留代理而不是独立 bool；要快照可写 `bool bit = flags[0];`。泛型代码不要假设所有容器的 Reference 都是 T&，也不要假设它能提供普通连续 bool 数组。

## S11 · string 与 string_view 的 substr 不同 {#s11}

`string.substr` 返回 owning string；`string_view.substr` 返回另一个 View。因此把临时 `name.substr(1)` 直接保存成 string_view 会悬空；可以先构造指向 name 的 string_view，再调用其 substr，但仍需 name 存活且存储稳定。

Find 返回的 `npos` 是特殊无符号值，不是普通合法索引；`size()-1` 在空字符串上也会下溢。先检查不存在和空输入，再做索引运算。

## S12 · 算法复杂度不仅数比较次数 {#s12}

对非 Random-access Iterator，通用 lower_bound 即使比较次数 logarithmic，Iterator 移动仍可能线性；map 的成员 lower_bound 可利用树结构。优先查容器成员是否提供更合适操作。LLVM 的 SmallVector/DenseMap 是另一组工程取舍，不是 std 容器的无条件替换。

### 先预测，再展开

1. 空 vector 只做 reserve(100)，能向 begin() 后写 100 个元素吗？
2. unique 会去掉所有重复值吗？
3. Key 已存在，try_emplace 的 expensive() 实参还会求值吗？

::: details 对照答案
Reserve 后 out.begin 可写 100 个元素吗？不行。Unique 去掉所有重复值吗？只处理相邻等价。Try_emplace 在 Key 已有时会避免 expensive() 实参求值吗？不会。
:::

依据：[Container Requirements](https://eel.is/c++draft/container.requirements.general)、[Removing Algorithms](https://eel.is/c++draft/alg.remove)、[Binary Search](https://eel.is/c++draft/alg.binary.search)、[Map Modifiers](https://eel.is/c++draft/map.modifiers)、[Numeric Operations](https://eel.is/c++draft/numeric.ops)。
