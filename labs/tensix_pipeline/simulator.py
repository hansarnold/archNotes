#!/usr/bin/env python3
"""Teaching model of a Tensix reader/compute/writer tile pipeline.

This is not a cycle-accurate Tenstorrent simulator.  It models three device
kernel stages connected by bounded circular buffers so learners can observe
overlap, backpressure, and bottleneck service rates.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PipelineConfig:
    tiles: int
    reader_cycles: int
    compute_cycles: int
    writer_cycles: int
    input_cb_capacity: int = 2
    output_cb_capacity: int = 2

    @classmethod
    def from_dict(cls, values: dict[str, Any]) -> "PipelineConfig":
        config = cls(**values)
        config.validate()
        return config

    def validate(self) -> None:
        fields = {
            "tiles": self.tiles,
            "reader_cycles": self.reader_cycles,
            "compute_cycles": self.compute_cycles,
            "writer_cycles": self.writer_cycles,
            "input_cb_capacity": self.input_cb_capacity,
            "output_cb_capacity": self.output_cb_capacity,
        }
        invalid = [name for name, value in fields.items() if value <= 0]
        if invalid:
            raise ValueError(f"values must be positive: {', '.join(invalid)}")


@dataclass
class ActiveTile:
    tile: int
    remaining: int


@dataclass(frozen=True)
class CycleState:
    cycle: int
    reader_tile: int | None
    compute_tile: int | None
    writer_tile: int | None
    input_cb: tuple[int, ...]
    output_cb: tuple[int, ...]


@dataclass(frozen=True)
class SimulationResult:
    config: PipelineConfig
    makespan: int
    sequential_makespan: int
    speedup: float
    completed_tiles: tuple[int, ...]
    stage_busy_cycles: dict[str, int]
    stage_utilization: dict[str, float]
    stalls: dict[str, int]
    max_input_cb_occupancy: int
    max_output_cb_occupancy: int
    timeline: tuple[CycleState, ...]

    def to_dict(self, include_timeline: bool = False) -> dict[str, Any]:
        result: dict[str, Any] = {
            "config": asdict(self.config),
            "makespan": self.makespan,
            "sequential_makespan": self.sequential_makespan,
            "speedup": self.speedup,
            "completed_tiles": list(self.completed_tiles),
            "stage_busy_cycles": self.stage_busy_cycles,
            "stage_utilization": self.stage_utilization,
            "stalls": self.stalls,
            "max_input_cb_occupancy": self.max_input_cb_occupancy,
            "max_output_cb_occupancy": self.max_output_cb_occupancy,
        }
        if include_timeline:
            result["timeline"] = [asdict(state) for state in self.timeline]
        return result


def simulate(config: PipelineConfig) -> SimulationResult:
    """Run the bounded three-stage pipeline until every tile is written."""

    config.validate()

    input_cb: deque[int] = deque()
    output_cb: deque[int] = deque()
    reader: ActiveTile | None = None
    compute: ActiveTile | None = None
    writer: ActiveTile | None = None
    next_tile = 0
    completed: list[int] = []
    cycle = 0
    timeline: list[CycleState] = []

    busy = {"reader": 0, "compute": 0, "writer": 0}
    stalls = {
        "reader_input_cb_full": 0,
        "compute_input_cb_empty": 0,
        "compute_output_cb_full": 0,
        "writer_output_cb_empty": 0,
    }
    max_input_occupancy = 0
    max_output_occupancy = 0

    while len(completed) < config.tiles:
        # Retire work that finished at the previous cycle boundary.
        if writer is not None and writer.remaining == 0:
            completed.append(writer.tile)
            writer = None

        if compute is not None and compute.remaining == 0:
            output_cb.append(compute.tile)
            compute = None

        if reader is not None and reader.remaining == 0:
            input_cb.append(reader.tile)
            reader = None

        if len(completed) == config.tiles:
            break

        # Start downstream stages first so a consumer can free buffer capacity
        # at the same cycle boundary that an upstream producer needs it.
        if writer is None and output_cb:
            writer = ActiveTile(output_cb.popleft(), config.writer_cycles)
        elif writer is None and (compute is not None or input_cb or reader is not None):
            stalls["writer_output_cb_empty"] += 1

        output_slots_reserved = len(output_cb) + (1 if compute is not None else 0)
        if compute is None and input_cb and output_slots_reserved < config.output_cb_capacity:
            compute = ActiveTile(input_cb.popleft(), config.compute_cycles)
        elif compute is None and not input_cb and (reader is not None or next_tile < config.tiles):
            stalls["compute_input_cb_empty"] += 1
        elif compute is None and input_cb:
            stalls["compute_output_cb_full"] += 1

        input_slots_reserved = len(input_cb) + (1 if reader is not None else 0)
        if reader is None and next_tile < config.tiles:
            if input_slots_reserved < config.input_cb_capacity:
                reader = ActiveTile(next_tile, config.reader_cycles)
                next_tile += 1
            else:
                stalls["reader_input_cb_full"] += 1

        max_input_occupancy = max(max_input_occupancy, len(input_cb))
        max_output_occupancy = max(max_output_occupancy, len(output_cb))
        timeline.append(
            CycleState(
                cycle=cycle,
                reader_tile=None if reader is None else reader.tile,
                compute_tile=None if compute is None else compute.tile,
                writer_tile=None if writer is None else writer.tile,
                input_cb=tuple(input_cb),
                output_cb=tuple(output_cb),
            )
        )

        for name, stage in (("reader", reader), ("compute", compute), ("writer", writer)):
            if stage is not None:
                busy[name] += 1
                stage.remaining -= 1

        cycle += 1

    sequential = config.tiles * (
        config.reader_cycles + config.compute_cycles + config.writer_cycles
    )
    utilization = {name: cycles / cycle for name, cycles in busy.items()}

    return SimulationResult(
        config=config,
        makespan=cycle,
        sequential_makespan=sequential,
        speedup=sequential / cycle,
        completed_tiles=tuple(completed),
        stage_busy_cycles=busy,
        stage_utilization=utilization,
        stalls=stalls,
        max_input_cb_occupancy=max_input_occupancy,
        max_output_cb_occupancy=max_output_occupancy,
        timeline=tuple(timeline),
    )


def load_config(path: Path) -> PipelineConfig:
    with path.open(encoding="utf-8") as handle:
        values = json.load(handle)
    if not isinstance(values, dict):
        raise ValueError("configuration must be a JSON object")
    return PipelineConfig.from_dict(values)


def _format_tile(tile: int | None) -> str:
    return "-" if tile is None else str(tile)


def print_report(result: SimulationResult, show_timeline: bool = False) -> None:
    print(f"tiles: {result.config.tiles}")
    print(f"pipeline makespan: {result.makespan} cycles")
    print(f"sequential makespan: {result.sequential_makespan} cycles")
    print(f"speedup: {result.speedup:.3f}x")
    print("stage utilization:")
    for stage, utilization in result.stage_utilization.items():
        print(f"  {stage}: {utilization:.1%}")
    print("stalls:")
    for reason, count in result.stalls.items():
        print(f"  {reason}: {count}")
    print(
        "max CB occupancy: "
        f"input={result.max_input_cb_occupancy}, "
        f"output={result.max_output_cb_occupancy}"
    )

    if show_timeline:
        print("timeline:")
        print("cycle  reader  compute  writer  input_cb  output_cb")
        for state in result.timeline:
            print(
                f"{state.cycle:>5}  "
                f"{_format_tile(state.reader_tile):>6}  "
                f"{_format_tile(state.compute_tile):>7}  "
                f"{_format_tile(state.writer_tile):>6}  "
                f"{str(list(state.input_cb)):>8}  "
                f"{str(list(state.output_cb)):>9}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="pipeline JSON configuration")
    parser.add_argument("--timeline", action="store_true", help="print every simulated cycle")
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()

    result = simulate(load_config(args.config))
    if args.json:
        print(json.dumps(result.to_dict(include_timeline=args.timeline), indent=2))
    else:
        print_report(result, show_timeline=args.timeline)


if __name__ == "__main__":
    main()
