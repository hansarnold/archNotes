---
title: "C++ 类、特殊成员与多态速查"
description: "12 个对象模型复习点：Rule of Zero/Five、隐式 Move、default/delete、成员顺序、多态析构、切片、重载与异常保证。"
outline: deep
products: ["C++", "LLVM"]
documentType: "Cheat Sheet"
topics: ["Object Model", "Special Members", "Polymorphism", "Exceptions"]
---

# 类、特殊成员与多态

[复习总入口](./index.md) · **优先 C01–C06、C12**。读一个类时，先找数据所有者、特殊成员与对外不变量，再看业务方法。

## C01 · Rule of Zero 是先选成员类型 {#c01}

```cpp
struct Program {
  std::string name;
  std::vector<int> nodes;
}; // 让成员实现复制、移动和清理
```

需要独占资源可用 unique_ptr 成员，类自然可能变成 Move-only。不要仅因为“这是一个类”就手写五个特殊成员；默认成员操作必须符合你希望的对象语义。

## C02 · 用户声明析构会影响隐式 Move {#c02}

| 你做了什么 | 需要复查什么 |
| --- | --- |
| 不手写特殊成员 | 成员是否可复制/移动；默认操作是否满足不变量 |
| 声明析构，包括 `~T() = default` | 隐式 Move 不再按原样生成；右值可能落到 Copy |
| 声明 Copy Constructor / Copy Assignment | 隐式 Move 的生成受到影响 |
| 声明 Move Constructor / Move Assignment | 隐式 Copy 可能被定义为 deleted |

Rule of Five 是资源管理时的联动审查，不是所有五项都必须手写函数体。`is_move_constructible_v<T>` 只测能否从相应右值构造；一个 Copy Constructor 也可能让结果为 true。

## C03 · default、delete 与“没有声明”不同 {#c03}

```cpp
struct Session {
  Session() = default;
  Session(const Session&) = delete;
  Session& operator=(const Session&) = delete;
  Session(Session&&) = default;
  Session& operator=(Session&&) = default;
};
```

显式 deleted 函数仍可能参与重载并在选中后报错。一个因成员原因被定义为 deleted 的 defaulted Move Constructor 则有忽略其重载候选的特殊规则；不要把两种 deleted 简写成相同的“退回 Copy”。

## C04 · 初始化顺序看声明，不看列表顺序 {#c04}

虚基类、直接基类、成员按各自规定顺序初始化；普通成员按在类中声明的顺序。析构按相反次序。`struct T { int a; int b; T(): b(1), a(b) {} };` 中 a 仍先初始化，读 b 的未初始化值有问题。把列表排好看不能改变成员声明顺序。

## C05 · 经基类指针删除，要有正确析构契约 {#c05}

```cpp
struct Pass {
  virtual ~Pass() = default;
  virtual void run() = 0;
};
```

普通情况下，通过 Base* 删除 Derived，Base 需要 virtual 析构。另一种接口策略是 protected 非 virtual 析构，明确禁止经基类删除。不要把“类里存在 virtual 方法”误认为“析构自然变成 virtual”。LLVM 风格代码也可能采用自己的类型识别协议，不能强行套 RTTI 模式。

## C06 · 构造/析构期间的 virtual 不跳到未来/已销毁的派生层 {#c06}

Base Constructor 中调用 virtual，按当前正在构造的 Base 层处理；此时 Derived 尚未构造完成。析构过程也受当前层限制。不要依赖 Base 构造函数调用 Derived Hook 初始化派生状态；把需要完整对象的流程移到构造完成之后。

## C07 · 按值传基类会 Slicing {#c07}

`void inspect(Base b)` 接收 Derived 时，会构造一个 Base 值，Derived 部分不会保留。需要多态访问用合适的引用/指针；需要多态复制，可设计返回 owning 指针的 virtual clone。引用并不会自动延长被引用 Derived 的 Lifetime。

## C08 · explicit 控制隐式转换入口 {#c08}

```cpp
struct Count {
  explicit Count(int n) : value(n) {}
  int value;
};
Count ok{3};
// Count accidental = 3;       // 不允许
```

Conversion Operator 也可 explicit，例如 bool 转换。`if (obj)` 等 contextual bool conversion 与普通隐式转换的规则不完全相同；[20] `explicit(condition)` 可表达条件化接口。

## C09 · Override 与名字隐藏是两件事 {#c09}

`override` 让编译器检查你真的覆盖了一个 virtual 方法，包括 cv/ref qualifier。派生类定义一个同名函数，可能隐藏整个基类重载集合；需要时写 `using Base::foo;`。`using Base::Base;` 继承构造，不表示所有派生状态的约束都自动被满足。

## C10 · 运算符重载不能改变优先级和元数 {#c10}

赋值运算符通常返回 `T&` 支持链式赋值，前置 ++ 通常返回引用、后置 ++ 通常返回旧值。实现 `operator<` 给排序用时要满足 Strict Weak Ordering；不能把 `<=` 当成比较器。重载运算符仍是函数，不能靠符号外观假定零开销或短路。

## C11 · 成员函数也可按对象值类别重载 {#c11}

```cpp
struct Label {
  std::string text;
  const std::string& get() const & { return text; }
  std::string get() && { return std::move(text); }
};
```

Ref-qualified 方法可区别长期存在对象的借用与临时对象的取值。仍须检查完整重载集合，例如 const rvalue 的去向；不能仅凭加了一个 `&&` 重载就认定所有临时对象返回路径都安全。

## C12 · noexcept 是契约，不是“尽量别抛” {#c12}

异常逃出 noexcept 函数会终止程序。默认 Move 的 noexcept 取决于成员；容器在保证条件允许时可能选择 Copy 来避免会抛的 Move。常见异常保证：No-throw（不抛）、Strong（失败不改变状态）、Basic（保持不变量、无泄漏）。RAII 帮助清理，不会自动让任意操作获得 Strong Guarantee。

### 先预测，再展开

1. 只新增一个 defaulted Destructor，会影响隐式 Move 吗？
2. 基类已有 virtual run，析构是否自动 virtual？
3. Move Trait 为 true，能否证明实际选择了 Move Constructor？

::: details 对照答案
只写一个默认析构会不会影响移动？会。基类有 virtual run，析构就自动 virtual 吗？不会。Move Trait 为 true 就证明发生 Move 而不是 Copy 吗？不能，必须看实际候选和选择。
:::

依据：[Copy/Move Constructors](https://eel.is/c++draft/class.copy.ctor)、[Initialization Order](https://eel.is/c++draft/class.base.init)、[Virtual Functions](https://eel.is/c++draft/class.virtual)、[Exception Specifications](https://eel.is/c++draft/except.spec)、[Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)。
