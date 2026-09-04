---
title: "MLIR Dialect Conversion"
description: "Use ConversionTarget, conversion patterns, and TypeConverter to define target legality and build diagnosable progressive lowering."
outline: deep
products: ["MLIR", "AI Accelerator"]
documentType: "Tutorial Chapter"
topics: ["Dialect Conversion", "Legalization", "TypeConverter", "Lowering"]
---

# MLIR Dialect Conversion

An ordinary Rewrite finds and replaces a Pattern. Dialect Conversion also defines a stage exit contract: the Operations and Types that must be legal when conversion finishes.

## Three core components

1. `ConversionTarget` declares Legal, Illegal, and Dynamic Legal IR.
2. Conversion Patterns transform Illegal IR into Legal IR.
3. `TypeConverter` transforms Types, BlockArguments, and function boundaries and provides materializations.

## Target legality

```cpp
// Declare the exit contract for this tutorial stage.
ConversionTarget target(context);
target.addLegalDialect<minibpu::MiniBPUDialect>();
target.addLegalOp<ModuleOp>();
target.addIllegalOp<linalg::MatmulOp>();
target.addDynamicallyLegalOp<arith::AddIOp>([](arith::AddIOp op) {
  return op.getType().isInteger(32);
});
```

| Classification | Meaning |
| --- | --- |
| Legal | Every instance may remain in output |
| Illegal | Every instance must be eliminated |
| Dynamic Legal | Legality depends on the instance |
| Unknown | Unclassified; behavior depends on conversion mode |

Do not hide omissions by declaring every unknown Operation legal. That removes the value of legalization as a stage contract.

## Three conversion modes

| Mode | Use | Failure condition |
| --- | --- | --- |
| Partial | Staged lowering with some unclassified IR remaining | An explicitly Illegal Operation cannot be eliminated |
| Full | A stable boundary requiring a complete contract | Required legalization leaves unsupported IR |
| Analysis | Determine what can be legalized without changing IR | Used for diagnosis and planning |

Partial Conversion is common early in a pipeline. Full Conversion is valuable at stable target boundaries because it exposes missing coverage.

## Adaptors and remapped operands

After Type Conversion, an old Operation still exposes its original operand and result Types. The Conversion Pattern adaptor provides current remapped operands:

```cpp
struct LowerFoo : OpConversionPattern<FooOp> {
  using OpConversionPattern::OpConversionPattern;

  // Consume operands after type remapping.
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

A Pattern should not keep using old operands after their Types have been converted.

## Unrealized conversion casts

During progressive lowering, `builtin.unrealized_conversion_cast` may temporarily connect values from old and new Type systems. It is a bridge, not a long-term storage mechanism.

Pipelines often end with `reconcile-unrealized-casts`. Remaining casts usually indicate an incomplete Type rule, materialization, or conversion sequence.

## MatMul to MiniBPU

Assume the Matrix Engine supports only 16×16×16 tiles and `i8 × i8 → i32`:

```text
linalg.matmul              English walkthrough
  → Quantize and legalize element types
  → Pad or create boundary handling
  → Tile M/N/K
  → Bufferize and select layout
  → Insert minibpu.dma_start / minibpu.wait
  → Emit minibpu.matmul_tile
```

This path normally requires several preparation passes rather than one universal Conversion Pattern. Each stage should have a testable input and output contract.

## Legality versus profitability

- Legality asks whether the hardware or IR permits a mapping.
- Profitability asks whether that legal mapping is worthwhile.

A small MatMul may be legal on a Matrix Engine but slower because of setup and DMA cost. Verifiers and ConversionTarget encode hard constraints; a Cost Model selects among legal alternatives.

## Actionable diagnostics

`failed to legalize operation` is not enough. A useful Diagnostic identifies the violated rule:

```text
minibpu.matmul_tile requires K to be a multiple of 16;
received M=64, N=64, K=30 after shape specialization
```

Unsupported cases should also specify whether the compiler uses padding, decomposition, a library call, or CPU fallback.

## Review questions

1. Why can canonicalization not replace Dialect Conversion?
2. Where do Partial and Full Conversion fit?
3. Why does TypeConverter need materialization?
4. What do persistent unrealized casts indicate?
5. Which component decides whether a legal mapping is too slow?

## Further reading

- [Dialect Conversion](https://mlir.llvm.org/docs/DialectConversion/)
- [LLVM IR Target](https://mlir.llvm.org/docs/TargetLLVMIR/)
