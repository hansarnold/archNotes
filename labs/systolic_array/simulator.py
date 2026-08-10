#!/usr/bin/env python3
"""Teaching model of a tiled output-stationary systolic array.

This is not a Google TPU simulator and is not cycle-accurate for any TPU
generation. It models one rectangular array executing output tiles
sequentially so learners can inspect wavefront fill/drain and partial-tile
utilization.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SystolicConfig:
    m: int
    k: int
    n: int
    array_rows: int
    array_cols: int

    @classmethod
    def from_dict(cls, values: dict[str, Any]) -> "SystolicConfig":
        config = cls(**values)
        config.validate()
        return config

    def validate(self) -> None:
        values = asdict(self)
        invalid_types = [
            name
            for name, value in values.items()
            if not isinstance(value, int) or isinstance(value, bool)
        ]
        if invalid_types:
            raise ValueError(
                "values must be integers: " + ", ".join(invalid_types)
            )

        non_positive = [name for name, value in values.items() if value <= 0]
        if non_positive:
            raise ValueError(
                "values must be positive: " + ", ".join(non_positive)
            )


@dataclass(frozen=True)
class OutputTile:
    tile_row: int
    tile_col: int
    active_rows: int
    active_cols: int
    compute_cycles: int
    useful_macs: int
    utilization_against_full_array: float


@dataclass(frozen=True)
class WavefrontCycle:
    cycle: int
    active_pes: tuple[tuple[int, int], ...]
    completed_pes: tuple[tuple[int, int], ...]


@dataclass(frozen=True)
class SimulationResult:
    config: SystolicConfig
    output_tiles: tuple[OutputTile, ...]
    total_cycles: int
    scalar_mac_cycles: int
    speedup_over_one_mac_per_cycle: float
    output_padding_utilization: float
    wavefront_utilization: float
    combined_array_utilization: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "config": asdict(self.config),
            "output_tiles": [asdict(tile) for tile in self.output_tiles],
            "total_cycles": self.total_cycles,
            "scalar_mac_cycles": self.scalar_mac_cycles,
            "speedup_over_one_mac_per_cycle": self.speedup_over_one_mac_per_cycle,
            "output_padding_utilization": self.output_padding_utilization,
            "wavefront_utilization": self.wavefront_utilization,
            "combined_array_utilization": self.combined_array_utilization,
        }


def _tile_extent(total: int, tile_size: int, tile_index: int) -> int:
    start = tile_index * tile_size
    return min(tile_size, total - start)


def _tile_cycles(k: int, active_rows: int, active_cols: int) -> int:
    # With A skewed by row and B skewed by column, PE(i, j) receives its first
    # matching pair at i+j. The final pair reaches the bottom-right active PE
    # after K + rows + cols - 2 counted cycles.
    return k + active_rows + active_cols - 2


def simulate(config: SystolicConfig) -> SimulationResult:
    """Simulate sequential output tiles on one rectangular systolic array."""

    config.validate()

    tile_rows = math.ceil(config.m / config.array_rows)
    tile_cols = math.ceil(config.n / config.array_cols)
    array_area = config.array_rows * config.array_cols
    output_tiles: list[OutputTile] = []

    total_cycles = 0
    active_array_slot_cycles = 0

    for tile_row in range(tile_rows):
        active_rows = _tile_extent(config.m, config.array_rows, tile_row)
        for tile_col in range(tile_cols):
            active_cols = _tile_extent(config.n, config.array_cols, tile_col)
            cycles = _tile_cycles(config.k, active_rows, active_cols)
            useful_macs = active_rows * active_cols * config.k
            full_array_slots = array_area * cycles

            output_tiles.append(
                OutputTile(
                    tile_row=tile_row,
                    tile_col=tile_col,
                    active_rows=active_rows,
                    active_cols=active_cols,
                    compute_cycles=cycles,
                    useful_macs=useful_macs,
                    utilization_against_full_array=useful_macs / full_array_slots,
                )
            )
            total_cycles += cycles
            active_array_slot_cycles += active_rows * active_cols * cycles

    useful_macs = config.m * config.k * config.n
    padded_output_slots = len(output_tiles) * array_area
    output_padding_utilization = (config.m * config.n) / padded_output_slots
    wavefront_utilization = useful_macs / active_array_slot_cycles
    combined_utilization = useful_macs / (array_area * total_cycles)

    return SimulationResult(
        config=config,
        output_tiles=tuple(output_tiles),
        total_cycles=total_cycles,
        scalar_mac_cycles=useful_macs,
        speedup_over_one_mac_per_cycle=useful_macs / total_cycles,
        output_padding_utilization=output_padding_utilization,
        wavefront_utilization=wavefront_utilization,
        combined_array_utilization=combined_utilization,
    )


def wavefront_for_tile(
    config: SystolicConfig, tile_row: int, tile_col: int
) -> tuple[WavefrontCycle, ...]:
    """Return PE activity for one output tile in local array coordinates."""

    config.validate()
    tile_rows = math.ceil(config.m / config.array_rows)
    tile_cols = math.ceil(config.n / config.array_cols)
    if not 0 <= tile_row < tile_rows or not 0 <= tile_col < tile_cols:
        raise ValueError(
            f"tile ({tile_row}, {tile_col}) outside "
            f"{tile_rows}x{tile_cols} output-tile grid"
        )

    active_rows = _tile_extent(config.m, config.array_rows, tile_row)
    active_cols = _tile_extent(config.n, config.array_cols, tile_col)
    cycles = _tile_cycles(config.k, active_rows, active_cols)
    timeline: list[WavefrontCycle] = []

    for cycle in range(cycles):
        active: list[tuple[int, int]] = []
        completed: list[tuple[int, int]] = []
        for row in range(active_rows):
            for col in range(active_cols):
                local_step = cycle - row - col
                if 0 <= local_step < config.k:
                    active.append((row, col))
                if local_step == config.k - 1:
                    completed.append((row, col))
        timeline.append(
            WavefrontCycle(
                cycle=cycle,
                active_pes=tuple(active),
                completed_pes=tuple(completed),
            )
        )

    return tuple(timeline)


def load_config(path: Path) -> SystolicConfig:
    with path.open(encoding="utf-8") as handle:
        values = json.load(handle)
    if not isinstance(values, dict):
        raise ValueError("configuration must be a JSON object")
    return SystolicConfig.from_dict(values)


def print_report(result: SimulationResult) -> None:
    config = result.config
    tile_rows = math.ceil(config.m / config.array_rows)
    tile_cols = math.ceil(config.n / config.array_cols)
    print(f"matmul: ({config.m}x{config.k}) @ ({config.k}x{config.n})")
    print(f"array: {config.array_rows}x{config.array_cols} PEs")
    print(f"output-tile grid: {tile_rows}x{tile_cols}")
    print(f"total systolic cycles: {result.total_cycles}")
    print(f"one-MAC-per-cycle baseline: {result.scalar_mac_cycles} cycles")
    print(
        "teaching speedup over scalar MAC: "
        f"{result.speedup_over_one_mac_per_cycle:.3f}x"
    )
    print("utilization:")
    print(f"  output padding: {result.output_padding_utilization:.1%}")
    print(f"  wavefront fill/drain: {result.wavefront_utilization:.1%}")
    print(f"  combined full-array: {result.combined_array_utilization:.1%}")
    print("tiles:")
    for tile in result.output_tiles:
        print(
            f"  ({tile.tile_row},{tile.tile_col}) "
            f"active={tile.active_rows}x{tile.active_cols} "
            f"cycles={tile.compute_cycles} "
            f"full-array-util={tile.utilization_against_full_array:.1%}"
        )


def print_wavefront(timeline: tuple[WavefrontCycle, ...]) -> None:
    print("wavefront:")
    for state in timeline:
        print(
            f"  cycle {state.cycle:>3}: "
            f"active={list(state.active_pes)} "
            f"completed={list(state.completed_pes)}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="matmul/array JSON configuration")
    parser.add_argument(
        "--timeline",
        nargs=2,
        type=int,
        metavar=("TILE_ROW", "TILE_COL"),
        help="print the local PE wavefront for one output tile",
    )
    parser.add_argument("--json", action="store_true", help="emit JSON report")
    args = parser.parse_args()

    config = load_config(args.config)
    result = simulate(config)
    if args.json:
        payload = result.to_dict()
        if args.timeline is not None:
            payload["wavefront"] = [
                asdict(state)
                for state in wavefront_for_tile(config, *args.timeline)
            ]
        print(json.dumps(payload, indent=2))
        return

    print_report(result)
    if args.timeline is not None:
        print_wavefront(wavefront_for_tile(config, *args.timeline))


if __name__ == "__main__":
    main()
