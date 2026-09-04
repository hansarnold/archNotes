---
title: "MLIR Passes, Patterns, and Rewrites"
description: "Separate passes, patterns, canonicalization, CSE, and DCE while learning PatternRewriter, greedy rewriting, convergence, and pass anchoring."
outline: deep
products: ["MLIR"]
documentType: "Tutorial Chapter"
topics: ["Pass", "PatternRewriter", "Canonicalization", "CSE"]
---

# MLIR Passes, Patterns, and Rewrites

A Pass is a bounded compiler stage. A Pattern is a local match-and-replace rule. Canonicalization is a collection of rewrites that moves IR toward canonical forms. They cooperate but are not interchangeable.

## Three basic concepts

### Pass

A Pass performs analysis or transformation. PassManager controls nesting, scheduling, instrumentation, and verification between stages.

### Rewrite Pattern

A Pattern describes a local rule:

```text
arith.addi(%x, 0) → %x
```

A Pass may collect many Patterns and let a Rewrite Driver apply them repeatedly.

### Canonicalization

Canonicalization normalizes equivalent forms to improve later matching. It should not contain arbitrary target-specific lowering and does not promise complete global optimization.

## Greedy rewriting and convergence

```text
match an Operation
  → apply a Rewrite
  → new IR enables another Pattern
  → continue until a Fixpoint
```

Patterns need a convergence direction. Rules for both A→B and B→A can make the Driver oscillate. Define a canonical form or a complexity measure that decreases monotonically.

## PatternRewriter discipline

Use Rewriter APIs to mutate IR tracked by a Driver:

- `replaceOp` replaces results and removes the old Operation.
- `eraseOp` removes an Operation.
- `modifyOpInPlace` performs a tracked in-place update.
- `create` builds an Operation at the insertion point.

Bypassing the Rewriter may invalidate worklists, listeners, rollback behavior, or analysis assumptions.

## C++ Pattern skeleton

```cpp
struct AddZero final : OpRewritePattern<arith::AddIOp> {
  using OpRewritePattern::OpRewritePattern;

  // Match the right-hand-side zero used in this example.
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

A production implementation must consider a constant on the left-hand side, vectors and splats, integer Types, overflow semantics, and whether upstream canonicalization already provides the rule.

## DRR and C++ Patterns

Declarative Rewrite Rules are effective for simple, fixed structural transformations. Use C++ when matching requires complex predicates, analysis, dynamic profitability, or coordination across multiple Operations.

Pattern Benefit prioritizes local alternatives at the same match location. It is not a global Cost Model for register pressure, SRAM capacity, layout conversions, or multi-engine overlap.

## Pass anchoring

```bash
mlir-opt input.mlir \
  --pass-pipeline='builtin.module(func.func(canonicalize,cse))'
```

`builtin.module(...)` and `func.func(...)` identify the anchor for nested PassManagers. A Pass anchored on `func.func` cannot see the expected Operations when scheduled at an incompatible level.

## Canonicalization, CSE, and DCE

| Mechanism | Goal | Required contract |
| --- | --- | --- |
| Canonicalization | Normalize equivalent expressions | Rewrites supplied by Operations and Dialects |
| CSE | Merge equivalent common subexpressions | Operation equivalence and side effects |
| DCE | Remove unused, unobservable computation | Uses and effect information |

These mechanisms often appear together, but order changes the matching opportunities available to later passes.

## Diagnosing an inactive Pattern

1. Does the parsed Operation have the expected structure?
2. Does the Pass run on an anchor containing that Operation?
3. Was the Pattern registered with the Pass?
4. Do Types, Attributes, constants, and Region structure satisfy the match?
5. Did an earlier Pattern already rewrite the target?
6. Did the Driver hit an iteration limit?

Reduce the case to 10–20 lines and run one Pass with one target Pattern.

## Further reading

- [MLIR reference: Pass Management](https://mlir.llvm.org/docs/PassManagement/)
- [MLIR reference: Pattern Rewriting](https://mlir.llvm.org/docs/PatternRewriter/)
- [MLIR reference: Canonicalization](https://mlir.llvm.org/docs/Canonicalization/)
