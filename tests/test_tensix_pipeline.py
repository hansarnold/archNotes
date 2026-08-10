import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "labs" / "tensix_pipeline" / "simulator.py"
SPEC = importlib.util.spec_from_file_location("tensix_pipeline_simulator", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

PipelineConfig = MODULE.PipelineConfig
simulate = MODULE.simulate


class TensixPipelineTests(unittest.TestCase):
    def test_single_tile_matches_sequential_latency(self):
        result = simulate(
            PipelineConfig(
                tiles=1,
                reader_cycles=2,
                compute_cycles=3,
                writer_cycles=4,
                input_cb_capacity=1,
                output_cb_capacity=1,
            )
        )

        self.assertEqual(result.makespan, 9)
        self.assertEqual(result.sequential_makespan, 9)
        self.assertEqual(result.completed_tiles, (0,))

    def test_pipeline_overlaps_multiple_tiles(self):
        config = PipelineConfig(
            tiles=12,
            reader_cycles=3,
            compute_cycles=5,
            writer_cycles=2,
            input_cb_capacity=2,
            output_cb_capacity=2,
        )
        result = simulate(config)

        self.assertLess(result.makespan, result.sequential_makespan)
        self.assertGreater(result.speedup, 1.0)
        self.assertEqual(result.completed_tiles, tuple(range(config.tiles)))

    def test_circular_buffer_capacity_is_respected(self):
        config = PipelineConfig(
            tiles=10,
            reader_cycles=1,
            compute_cycles=2,
            writer_cycles=8,
            input_cb_capacity=1,
            output_cb_capacity=1,
        )
        result = simulate(config)

        self.assertLessEqual(result.max_input_cb_occupancy, config.input_cb_capacity)
        self.assertLessEqual(result.max_output_cb_occupancy, config.output_cb_capacity)
        self.assertGreater(result.stalls["compute_output_cb_full"], 0)

    def test_non_positive_values_are_rejected(self):
        with self.assertRaises(ValueError):
            simulate(
                PipelineConfig(
                    tiles=0,
                    reader_cycles=1,
                    compute_cycles=1,
                    writer_cycles=1,
                )
            )


if __name__ == "__main__":
    unittest.main()
