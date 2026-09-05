"""CPU numerical references and explicit analytical models, not GPU benchmarks."""
import argparse
import json
import math


def dimensions(x, w, bias):
    if not x or not w or not x[0] or not w[0]:
        raise ValueError("non-empty matrices required")
    m, k, n = len(x), len(x[0]), len(w[0])
    if len(w) != k or len(bias) != n:
        raise ValueError("incompatible MatMul or bias shape")
    if any(len(row) != k for row in x) or any(len(row) != n for row in w):
        raise ValueError("ragged matrix")
    return m, k, n


def unfused(x, w, bias):
    m, k, n = dimensions(x, w, bias)
    product = [[sum(x[i][r] * w[r][j] for r in range(k)) for j in range(n)] for i in range(m)]
    shifted = [[product[i][j] + bias[j] for j in range(n)] for i in range(m)]
    return [[max(0.0, shifted[i][j]) for j in range(n)] for i in range(m)]


def fused(x, w, bias):
    m, k, n = dimensions(x, w, bias)
    output = [[0.0] * n for _ in range(m)]
    for i in range(m):
        for j in range(n):
            acc = sum(x[i][r] * w[r][j] for r in range(k))
            output[i][j] = max(0.0, acc + bias[j])
    return output


def traffic(m=128, k=256, n=128, element_bytes=4):
    # Ideal distinct-array traffic: each input/bias read once, final output once.
    fused_bytes = element_bytes * (m * k + k * n + n + m * n)
    return {"matmul_operations": 2 * m * k * n,
            "ideal_fused_bytes": fused_bytes,
            "unfused_bytes_if_two_intermediates_materialize": fused_bytes + 4 * m * n * element_bytes,
            "avoided_intermediate_bytes": 4 * m * n * element_bytes,
            "arithmetic_intensity_ops_per_byte": 2 * m * k * n / fused_bytes}


def schedule(chunks, load_cycles, compute_cycles, store_cycles, buffers):
    if min(chunks, load_cycles, compute_cycles, store_cycles) <= 0 or buffers not in (1, 2):
        raise ValueError("positive costs and one or two buffers required")
    loads, computes = [], []
    for i in range(chunks):
        # One DMA queue; a buffer is reusable only after its prior compute ends.
        dma_available = loads[-1][1] if loads else 0
        buffer_available = computes[i - buffers][1] if i >= buffers else 0
        load_start = max(dma_available, buffer_available)
        loads.append((load_start, load_start + load_cycles))
        compute_start = max(loads[-1][1], computes[-1][1] if computes else 0)
        computes.append((compute_start, compute_start + compute_cycles))
    return {"load_intervals": loads, "compute_intervals": computes,
            "estimated_cycles_one_output_tile": computes[-1][1] + store_cycles}


def mapping(bm=32, bn=32, bk=64, k=256, buffers=2, sram_kib=32):
    if min(bm, bn, bk, k, sram_kib) <= 0 or buffers not in (1, 2):
        raise ValueError("positive shapes/capacity and one or two buffers required")
    if k % bk:
        raise ValueError("this model requires K divisible by BK; tail policy is not implemented")
    # Hypothetical target: fp16 operands, fp32 accumulator, usable SRAM budget.
    a_bytes, b_bytes, acc_bytes = bm * bk * 2, bk * bn * 2, bm * bn * 4
    working_set = buffers * (a_bytes + b_bytes) + acc_bytes
    # A+B are modeled as one batched DMA load: 80-cycle setup, 8 bytes/cycle.
    load = 80 + math.ceil((a_bytes + b_bytes) / 8)
    compute = math.ceil((2 * bm * bn * bk) / 256)
    store = 80 + math.ceil(acc_bytes / 8)
    result = {"hypothetical_target": True, "tile": [bm, bn, bk], "buffers": buffers,
              "working_set_bytes": working_set, "usable_sram_bytes": sram_kib * 1024,
              "feasible": working_set <= sram_kib * 1024,
              "load_cycles_per_k_chunk": load, "compute_cycles_per_k_chunk": compute,
              "final_store_cycles": store}
    if result["feasible"]:
        result.update(schedule(k // bk, load, compute, store, buffers))
    else:
        result["reason"] = "working set exceeds usable SRAM; no schedule claimed"
    return result


def quantize(value, scale=0.1, zero_point=0):
    if not math.isfinite(value) or not math.isfinite(scale) or scale <= 0:
        raise ValueError("finite input and positive finite scale required")
    if not isinstance(zero_point, int) or not -128 <= zero_point <= 127:
        raise ValueError("zero point must be a signed INT8 integer")
    # Python round: nearest, ties to even. A real backend must match its contract.
    return max(-128, min(127, round(value / scale) + zero_point))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("model", "mapping", "quant"))
    parser.add_argument("--tile-m", type=int, default=32)
    parser.add_argument("--tile-n", type=int, default=32)
    parser.add_argument("--tile-k", type=int, default=64)
    parser.add_argument("--k", type=int, default=256)
    parser.add_argument("--buffers", type=int, choices=(1, 2), default=2)
    parser.add_argument("--sram-kib", type=int, default=32)
    args = parser.parse_args()
    try:
        if args.mode == "model":
            x, w, bias = [[1, 2, -1], [0, 1, 3]], [[2, -1], [1, 3], [-2, 1]], [-1, 2]
            result = {"reference_output": unfused(x, w, bias), "fused_output": fused(x, w, bias),
                      "traffic_for_M128_K256_N128_f32": traffic(), "timing_measured": False}
        elif args.mode == "mapping":
            result = mapping(args.tile_m, args.tile_n, args.tile_k, args.k, args.buffers, args.sram_kib)
        else:
            values = [-20.0, -0.26, 0.24, 20.0]
            quantized = [quantize(v) for v in values]
            result = {"input": values, "scale": 0.1, "zero_point": 0,
                      "rounding": "nearest, ties to even", "int8": quantized,
                      "reconstructed": [0.1 * q for q in quantized]}
        print(json.dumps(result, indent=2))
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
