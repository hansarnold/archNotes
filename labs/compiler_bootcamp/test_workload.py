import random
import unittest

from workload import fused, mapping, quantize, schedule, traffic, unfused


class WorkloadTests(unittest.TestCase):
    def test_known_result(self):
        x, w, bias = [[1, 2, -1], [0, 1, 3]], [[2, -1], [1, 3], [-2, 1]], [-1, 2]
        self.assertEqual(fused(x, w, bias), [[5, 6], [0, 8]])

    def test_fusion_preserves_results(self):
        rng = random.Random(17)
        for m, k, n in ((1, 1, 1), (2, 3, 5), (7, 4, 2)):
            x = [[rng.uniform(-2, 2) for _ in range(k)] for _ in range(m)]
            w = [[rng.uniform(-2, 2) for _ in range(n)] for _ in range(k)]
            bias = [rng.uniform(-1, 1) for _ in range(n)]
            self.assertEqual(fused(x, w, bias), unfused(x, w, bias))

    def test_bad_shapes(self):
        for args in (([], [[1]], [0]), ([[1, 2]], [[1]], [0]),
                     ([[1], [1, 2]], [[1]], [0])):
            with self.assertRaises(ValueError):
                fused(*args)

    def test_traffic_accounting(self):
        model = traffic()
        self.assertEqual(model["matmul_operations"], 8388608)
        self.assertEqual(model["ideal_fused_bytes"], 328192)
        self.assertEqual(model["unfused_bytes_if_two_intermediates_materialize"], 590336)
        self.assertEqual(model["avoided_intermediate_bytes"], 262144)

    def test_capacity_and_schedule(self):
        self.assertEqual(mapping()["working_set_bytes"], 20480)
        self.assertEqual(mapping()["estimated_cycles_one_output_tile"], 5520)
        self.assertEqual(mapping(buffers=1)["estimated_cycles_one_output_tile"], 7056)
        rejected = mapping(bm=64, bn=64)
        self.assertFalse(rejected["feasible"])
        self.assertNotIn("estimated_cycles_one_output_tile", rejected)
        with self.assertRaises(ValueError):
            mapping(k=250)

    def test_dependencies_and_buffer_ownership(self):
        for buffers in (1, 2):
            for load, compute in ((10, 50), (50, 10), (10, 10)):
                result = schedule(7, load, compute, 5, buffers)
                for i, ((ls, le), (cs, ce)) in enumerate(zip(result["load_intervals"], result["compute_intervals"])):
                    self.assertGreaterEqual(cs, le)
                    if i:
                        self.assertGreaterEqual(ls, result["load_intervals"][i-1][1])
                        self.assertGreaterEqual(cs, result["compute_intervals"][i-1][1])
                    if i >= buffers:
                        self.assertGreaterEqual(ls, result["compute_intervals"][i-buffers][1])
                    self.assertEqual(ce - cs, compute)

    def test_rounding_saturation_and_zero_point(self):
        self.assertEqual([quantize(v) for v in (-20, -0.26, 0.24, 20)], [-128, -3, 2, 127])
        self.assertEqual(quantize(0.25, 0.5), 0)
        self.assertEqual(quantize(0.75, 0.5), 2)
        self.assertEqual(quantize(0.0, 0.1, 3), 3)
        with self.assertRaises(ValueError):
            quantize(1, 0)


if __name__ == "__main__":
    unittest.main()
