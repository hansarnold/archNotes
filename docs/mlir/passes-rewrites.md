---
title: "MLIR Pass、Pattern 与 Rewrite"
description: "区分 Pass、Pattern、Canonicalization、CSE 与 DCE，理解 PatternRewriter、Greedy Rewrite 和 Pass Anchoring。"
outline: deep
products: ["MLIR"]
documentType: "教程章节"
topics: ["Pass", "PatternRewriter", "Canonicalization", "CSE"]
---

# MLIR Pass、Pattern 与 Rewrite

Pass 是有边界的编译步骤；Pattern 是局部匹配与替换规则；Canonicalization 是把 IR 收敛到规范形式的一组 Rewrite。三者相关，但不能互相替代。

## 三个基本概念

### Pass

Pass 可以执行 Analysis 或 Transformation。PassManager 负责嵌套、调度、Instrumentation 和阶段间 Verify。

### Rewrite Pattern

Pattern 描述局部规则：

```text
arith.addi(%x, 0) → %x
```

一个 Pass 可以收集多个 Pattern，再交给 Rewrite Driver 反复应用。

### Canonicalization

Canonicalization 应把不同等价写法归一化，方便后续匹配。它不应该承载任意 Target-specific Lowering，也不保证完成所有全局优化。

## Greedy Rewrite 与收敛

```text
match an Operation
  → apply a Rewrite
  → new IR enables another Pattern
  → continue until a Fixpoint
```

Pattern 必须有明确的收敛方向。若同时存在 A→B 和 B→A，Driver 可能震荡。常见做法是定义 Canonical form，或者让某种复杂度单调下降。

## PatternRewriter 的修改纪律

通过 Rewriter API 修改被 Driver 跟踪的 IR：

- `replaceOp`：替换 Results 并移除旧 Operation；
- `eraseOp`：删除 Operation；
- `modifyOpInPlace`：受控原地更新；
- `create`：在 Insertion Point 创建 Operation。

直接绕过 Rewriter 修改 IR 会破坏 Worklist、Listener、Rollback 或 Analysis invariant。

## C++ Pattern 骨架

```cpp
struct AddZero final : OpRewritePattern<arith::AddIOp> {
  using OpRewritePattern::OpRewritePattern;

  LogicalResult matchAndRewrite(
      arith::AddIOp op,
      PatternRewriter &rewriter) const override {
    auto cst = op.getRhs().getDefiningOp<arith::ConstantIntOp>();
    if (!cst || cst.value() != 0)
      return failure();
    rewriter.replaceOp(op, op.getLhs());
    return success();
  }
};
```

生产实现还需检查 Constant 是否位于左侧、Vector/Splat、Integer Type 和 Overflow semantics，并确认 upstream Canonicalization 是否已经覆盖。

## DRR 与 C++ Pattern

简单、固定形状的规则适合 Declarative Rewrite Rule。需要复杂 Predicate、Analysis、动态收益判断或多 Operation 协调时，C++ Pattern 更直观。

Pattern Benefit 只帮助同一位置的多个 Rewrite 候选排序，不是完整 Cost Model。Fusion 后的 Register pressure、SRAM capacity、Layout transform 和多 Engine overlap 都需要更高层的 Analysis。

## Pass Anchoring

```bash
mlir-opt input.mlir \
  --pass-pipeline='builtin.module(func.func(canonicalize,cse))'
```

`builtin.module(...)` 和 `func.func(...)` 表示嵌套 PassManager 的 Anchor Operation。一个 Pass 若只运行在 `func.func`，却被安排在错误层级，可能报 Pipeline 错误或完全看不到目标 Operation。

## Canonicalization、CSE 与 DCE

| 机制 | 目标 | 依赖 |
| --- | --- | --- |
| Canonicalization | 收敛到规范表达 | Dialect/Operation 提供的 Rewrite |
| CSE | 合并等价公共子表达式 | Operation equivalence 与 Side Effect |
| DCE | 删除无用且不可观察的计算 | Use 与 Effect contract |

常见 Pipeline 会组合它们，但顺序会改变后续 Pattern 的匹配机会。

## Pattern 不生效的排查顺序

1. 输入 Operation 的真实结构是否与预期一致？
2. Pass 是否运行在包含它的 Anchor 上？
3. Pattern 是否注册到该 Pass？
4. Type、Attribute、Constant 和 Region 条件是否满足？
5. 更早的 Pattern 是否已经改写目标？
6. Rewrite 是否达到 Iteration limit？

把问题缩小到 10–20 行，只保留一个 Pass 和一个 Pattern，是最有效的调试方式。

## 延伸阅读

- [Pass Management](https://mlir.llvm.org/docs/PassManagement/)
- [Pattern Rewriting](https://mlir.llvm.org/docs/PatternRewriter/)
- [Canonicalization](https://mlir.llvm.org/docs/Canonicalization/)
