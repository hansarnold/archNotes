import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "labs"
    / "systolic_array"
    / "simulator.py"
)
SPEC = importlib.util.spec_from_file_location("systolic_array", MODULE_PATH)
systolic_array = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = systolic_array
SPEC.loader.exec_module(systolic_array)


class SystolicArrayTests(unittest.TestCase):
    def test_single_pe_single_mac_takes_one_cycle(self):
        config = systolic_array.SystolicConfig(1, 1, 1, 1, 1)
        result = systolic_array.simulate(config)

        self.assertEqual(result.total_cycles, 1)
        self.assertEqual(result.scalar_mac_cycles, 1)
        self.assertEqual(result.combined_array_utilization, 1.0)

    def test_full_tile_includes_wavefront_fill_and_drain(self):
        config = systolic_array.SystolicConfig(2, 3, 2, 2, 2)
        result = systolic_array.simulate(config)

        self.assertEqual(result.total_cycles, 5)
        self.assertEqual(result.scalar_mac_cycles, 12)
        self.assertEqual(result.output_padding_utilization, 1.0)
        self.assertAlmostEqual(result.wavefront_utilization, 0.6)
        self.assertAlmostEqual(result.combined_array_utilization, 0.6)

    def test_partial_output_tile_reduces_full_array_utilization(self):
        config = systolic_array.SystolicConfig(3, 4, 2, 2, 2)
        result = systolic_array.simulate(config)

        self.assertEqual(len(result.output_tiles), 2)
        self.assertEqual(result.total_cycles, 11)
        self.assertEqual(result.scalar_mac_cycles, 24)
        self.assertAlmostEqual(result.output_padding_utilization, 0.75)
        self.assertAlmostEqual(result.wavefront_utilization, 24 / 34)
        self.assertAlmostEqual(result.combined_array_utilization, 24 / 44)

    def test_wavefront_reports_last_pe_completion(self):
        config = systolic_array.SystolicConfig(2, 3, 2, 2, 2)
        timeline = systolic_array.wavefront_for_tile(config, 0, 0)

        self.assertEqual(len(timeline), 5)
        self.assertEqual(timeline[0].active_pes, ((0, 0),))
        self.assertIn((1, 1), timeline[-1].completed_pes)

    def test_invalid_values_and_tile_coordinates_are_rejected(self):
        with self.assertRaises(ValueError):
            systolic_array.SystolicConfig(0, 1, 1, 1, 1).validate()

        config = systolic_array.SystolicConfig(2, 2, 2, 2, 2)
        with self.assertRaises(ValueError):
            systolic_array.wavefront_for_tile(config, 1, 0)


if __name__ == "__main__":
    unittest.main()
