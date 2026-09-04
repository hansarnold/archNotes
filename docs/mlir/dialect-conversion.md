---
title: "MLIR Dialect Conversion"
description: "使用 ConversionTarget、Conversion Pattern 和 TypeConverter 定义 Target legality，并构建可诊断的 Progressive Lowering。"
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "教程章节"
topics: ["Dialect Conversion", "Legalization", "TypeConverter", "Lowering"]
---

# MLIR Dialect Conversion

普通 Rewrite 关注“发现并替换一个 Pattern”。Dialect Conversion 进一步定义阶段出口：哪些 Operation 和 Type 在结束时必须合法。

## 三个核心组件

1. `ConversionTarget`：定义 Legal、Illegal 和 Dynamic Legal。
2. Conversion Pattern：把 Illegal IR 变成 Legal IR。
3. `TypeConverter`：转换 Type、BlockArgument 和 Function boundary，并提供 Materialization。

## Target Legality

```cpp
ConversionTarget target(context);
target.addLegalDialect<minibpu::MiniBPUDialect>();
target.addLegalOp<ModuleOp>();
target.addIllegalOp<linalg::MatmulOp>();
target.addDynamicallyLegalOp<arith::AddIOp>([](arith::AddIOp op) {
  return op.getType().isInteger(32);
});
```

| 分类 | 含义 |
| --- | --- |
| Legal | 该 Operation 的所有实例都可留在输出 |
| Illegal | 必须被消除 |
| Dynamic Legal | 是否允许取决于具体实例 |
| Unknown | 未分类，行为取决于 Conversion mode |

不要用“所有 Unknown Operation 都 Legal”掩盖遗漏，否则 Legalization 失去验收作用。

## 三种 Conversion Mode

| Mode | 使用场景 | 失败条件 |
| --- | --- | --- |
| Partial | 分阶段 Lowering，保留未分类 Operation | 显式 Illegal Operation 无法消除 |
| Full | 稳定阶段出口必须满足完整 Contract | 任意要求 Legalize 的 IR 残留 |
| Analysis | 分析可 Legalize 范围而不修改 IR | 用于诊断和规划 |

早期 Pipeline 常使用 Partial Conversion；进入稳定 Target boundary 时，Full Conversion 更能暴露缺口。

## Adaptor 与 Remapped Operand

Type Conversion 后，旧 Operation 仍带原始 Operand/Result Type，而 Conversion Pattern 的 Adaptor 提供最新的 Remapped Operand：

```cpp
struct LowerFoo : OpConversionPattern<FooOp> {
  using OpConversionPattern::OpConversionPattern;

  LogicalResult matchAndRewrite(
      FooOp op,
      OpAdaptor adaptor,
      ConversionPatternRewriter &rewriter) const override {
    rewriter.replaceOpWithNewOp<minibpu::FooOp>(
        op,
        getTypeConverter()->convertType(op.getType()),
        adaptor.getInput());
    return success();
  }
};
```

Pattern 不应在 Type 已转换后继续盲目使用旧 Operand。

## Unrealized Conversion Cast

Progressive Lowering 中，新旧 Type 世界可能临时通过 `builtin.unrealized_conversion_cast` 连接。它是过渡桥梁，不应成为最终 IR 的长期残留。

Pipeline 末尾常运行 `reconcile-unrealized-casts`。若仍有 Cast，通常说明 Type rule、Materialization 或 Conversion 顺序没有闭合。

## MatMul 到 MiniBPU

假设 Matrix Engine 只支持 16×16×16 Tile 和 `i8 × i8 → i32`：

```text
linalg.matmul
  → Quantize and legalize element types
  → Pad or create boundary handling
  → Tile M/N/K
  → Bufferize and select layout
  → Insert minibpu.dma_start / minibpu.wait
  → Emit minibpu.matmul_tile
```

这条路径通常需要多个 Preparation Pass，而不是一个万能 Conversion Pattern。每个阶段都应该有独立的输入/输出 Contract 和测试。

## Legality 与 Profitability

- Legality 回答硬件或 IR 是否允许。
- Profitability 回答这个合法 Mapping 是否值得。

例如一个小 MatMul 可能合法使用 Matrix Engine，但 Setup/DMA Cost 使其他实现更快。硬约束应由 Verifier/ConversionTarget 表达，选择策略由 Cost Model 决定。

## 可行动的诊断

仅报告 `failed to legalize operation` 不足以调试。更好的 Diagnostic 应指出：

```text
minibpu.matmul_tile requires K to be a multiple of 16;
received M=64, N=64, K=30 after shape specialization
```

Unsupported case 还应说明采用 Padding、Decomposition、Library Call 还是 CPU Fallback。

## 验收问题

1. Canonicalization 为什么不能替代 Dialect Conversion？
2. Partial 与 Full Conversion 分别适合哪个阶段？
3. TypeConverter 为什么需要 Materialization？
4. Unrealized Cast 长期残留说明什么？
5. “合法但更慢”的方案由哪个组件判断？

## 延伸阅读

- [Dialect Conversion](https://mlir.llvm.org/docs/DialectConversion/)
- [LLVM IR Target](https://mlir.llvm.org/docs/TargetLLVMIR/)
