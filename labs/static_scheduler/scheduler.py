#!/usr/bin/env python3
"""Educational deterministic time-space scheduler.

This models a small, public-concepts subset of a statically scheduled tensor
streaming machine. It is not a Groq compiler or ISA implementation.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path
import sys
from typing import Any


class ScheduleError(ValueError):
    """Raised when an input program cannot be validated or scheduled."""


@dataclass(frozen=True)
class Dependency:
    operation_id: str
    transit_cycles: int


@dataclass(frozen=True)
class Operation:
    operation_id: str
    instruction: str
    resource: str
    latency_cycles: int
    occupancy_cycles: int
    dependencies: tuple[Dependency, ...]
    source_index: int


def require_non_negative_int(value: Any, field: str, operation_id: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ScheduleError(
            f"operation {operation_id!r}: {field} must be a non-negative integer"
        )
    return value


def require_positive_int(value: Any, field: str, operation_id: str) -> int:
    parsed = require_non_negative_int(value, field, operation_id)
    if parsed == 0:
        raise ScheduleError(f"operation {operation_id!r}: {field} must be positive")
    return parsed


def parse_program(document: dict[str, Any]) -> tuple[str, list[str], list[Operation]]:
    name = document.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ScheduleError("program name must be a non-empty string")

    resources_raw = document.get("resources")
    if not isinstance(resources_raw, list) or not resources_raw:
        raise ScheduleError("resources must be a non-empty list")
    if any(not isinstance(resource, str) or not resource for resource in resources_raw):
        raise ScheduleError("every resource must be a non-empty string")
    resources = list(resources_raw)
    if len(resources) != len(set(resources)):
        raise ScheduleError("resource names must be unique")

    operations_raw = document.get("operations")
    if not isinstance(operations_raw, list) or not operations_raw:
        raise ScheduleError("operations must be a non-empty list")

    operations: list[Operation] = []
    seen_ids: set[str] = set()
    for source_index, raw in enumerate(operations_raw):
        if not isinstance(raw, dict):
            raise ScheduleError(f"operation at index {source_index} must be an object")

        operation_id = raw.get("id")
        if not isinstance(operation_id, str) or not operation_id:
            raise ScheduleError(f"operation at index {source_index} has an invalid id")
        if operation_id in seen_ids:
            raise ScheduleError(f"duplicate operation id: {operation_id!r}")
        seen_ids.add(operation_id)

        resource = raw.get("resource")
        if resource not in resources:
            raise ScheduleError(
                f"operation {operation_id!r}: unknown resource {resource!r}"
            )

        instruction = raw.get("instruction", operation_id)
        if not isinstance(instruction, str) or not instruction:
            raise ScheduleError(
                f"operation {operation_id!r}: instruction must be a non-empty string"
            )

        latency = require_non_negative_int(raw.get("latency", 1), "latency", operation_id)
        occupancy = require_positive_int(
            raw.get("occupancy", 1), "occupancy", operation_id
        )

        dependencies_raw = raw.get("dependencies", [])
        if not isinstance(dependencies_raw, list):
            raise ScheduleError(
                f"operation {operation_id!r}: dependencies must be a list"
            )
        dependencies: list[Dependency] = []
        dependency_ids: set[str] = set()
        for dependency_raw in dependencies_raw:
            if not isinstance(dependency_raw, dict):
                raise ScheduleError(
                    f"operation {operation_id!r}: dependency must be an object"
                )
            dependency_id = dependency_raw.get("op")
            if not isinstance(dependency_id, str) or not dependency_id:
                raise ScheduleError(
                    f"operation {operation_id!r}: dependency op must be a string"
                )
            if dependency_id in dependency_ids:
                raise ScheduleError(
                    f"operation {operation_id!r}: duplicate dependency {dependency_id!r}"
                )
            dependency_ids.add(dependency_id)
            transit = require_non_negative_int(
                dependency_raw.get("transit", 0), "transit", operation_id
            )
            dependencies.append(Dependency(dependency_id, transit))

        operations.append(
            Operation(
                operation_id=operation_id,
                instruction=instruction,
                resource=resource,
                latency_cycles=latency,
                occupancy_cycles=occupancy,
                dependencies=tuple(dependencies),
                source_index=source_index,
            )
        )

    for operation in operations:
        for dependency in operation.dependencies:
            if dependency.operation_id not in seen_ids:
                raise ScheduleError(
                    f"operation {operation.operation_id!r}: unknown dependency "
                    f"{dependency.operation_id!r}"
                )
            if dependency.operation_id == operation.operation_id:
                raise ScheduleError(
                    f"operation {operation.operation_id!r}: self dependency"
                )

    return name, resources, operations


def stable_topological_order(operations: list[Operation]) -> list[Operation]:
    scheduled_ids: set[str] = set()
    remaining = list(operations)
    ordered: list[Operation] = []

    while remaining:
        ready = [
            operation
            for operation in remaining
            if all(
                dependency.operation_id in scheduled_ids
                for dependency in operation.dependencies
            )
        ]
        if not ready:
            cycle_members = ", ".join(operation.operation_id for operation in remaining)
            raise ScheduleError(f"dependency cycle detected among: {cycle_members}")

        operation = min(ready, key=lambda candidate: candidate.source_index)
        remaining.remove(operation)
        ordered.append(operation)
        scheduled_ids.add(operation.operation_id)

    return ordered


def build_resource_queues(
    resources: list[str], scheduled_operations: list[dict[str, Any]]
) -> dict[str, list[dict[str, Any]]]:
    queues: dict[str, list[dict[str, Any]]] = {resource: [] for resource in resources}
    by_resource: dict[str, list[dict[str, Any]]] = {resource: [] for resource in resources}
    for operation in scheduled_operations:
        by_resource[operation["resource"]].append(operation)

    for resource in resources:
        cursor = 0
        for operation in sorted(
            by_resource[resource], key=lambda item: (item["start_cycle"], item["source_index"])
        ):
            start = operation["start_cycle"]
            if start > cursor:
                queues[resource].append(
                    {
                        "kind": "NOP",
                        "start_cycle": cursor,
                        "cycles": start - cursor,
                    }
                )
            queues[resource].append(
                {
                    "kind": "instruction",
                    "operation_id": operation["operation_id"],
                    "instruction": operation["instruction"],
                    "start_cycle": start,
                    "occupancy_cycles": operation["occupancy_cycles"],
                    "result_cycle": operation["result_cycle"],
                }
            )
            cursor = start + operation["occupancy_cycles"]

    return queues


def schedule_document(document: dict[str, Any]) -> dict[str, Any]:
    name, resources, operations = parse_program(document)
    ordered = stable_topological_order(operations)

    resource_available = {resource: 0 for resource in resources}
    results_by_id: dict[str, dict[str, Any]] = {}
    scheduled_operations: list[dict[str, Any]] = []

    for operation in ordered:
        dependency_arrivals = []
        for dependency in operation.dependencies:
            producer = results_by_id[dependency.operation_id]
            dependency_arrivals.append(
                {
                    "operation_id": dependency.operation_id,
                    "producer_result_cycle": producer["result_cycle"],
                    "transit_cycles": dependency.transit_cycles,
                    "arrival_cycle": producer["result_cycle"]
                    + dependency.transit_cycles,
                }
            )

        operands_ready = max(
            (dependency["arrival_cycle"] for dependency in dependency_arrivals),
            default=0,
        )
        start_cycle = max(operands_ready, resource_available[operation.resource])
        result_cycle = start_cycle + operation.latency_cycles
        issue_end_cycle = start_cycle + operation.occupancy_cycles

        scheduled = {
            "operation_id": operation.operation_id,
            "instruction": operation.instruction,
            "resource": operation.resource,
            "start_cycle": start_cycle,
            "result_cycle": result_cycle,
            "issue_end_cycle": issue_end_cycle,
            "latency_cycles": operation.latency_cycles,
            "occupancy_cycles": operation.occupancy_cycles,
            "operands_ready_cycle": operands_ready,
            "dependency_arrivals": dependency_arrivals,
            "source_index": operation.source_index,
        }
        scheduled_operations.append(scheduled)
        results_by_id[operation.operation_id] = scheduled
        resource_available[operation.resource] = issue_end_cycle

    makespan = max(operation["result_cycle"] for operation in scheduled_operations)
    queues = build_resource_queues(resources, scheduled_operations)
    return {
        "model": "educational-groq-inspired-static-scheduler-v1",
        "disclaimer": "Not a Groq compiler, simulator, binary format, or performance model.",
        "program": name,
        "description": document.get("description"),
        "makespan_cycles": makespan,
        "resources": resources,
        "operations": scheduled_operations,
        "resource_queues": queues,
    }


def format_schedule(schedule: dict[str, Any]) -> str:
    rows = [
        ("operation", "resource", "start", "ready", "issue_end", "instruction")
    ]
    for operation in schedule["operations"]:
        rows.append(
            (
                operation["operation_id"],
                operation["resource"],
                str(operation["start_cycle"]),
                str(operation["result_cycle"]),
                str(operation["issue_end_cycle"]),
                operation["instruction"],
            )
        )

    widths = [max(len(row[index]) for row in rows) for index in range(len(rows[0]))]
    formatted_rows = []
    for row_index, row in enumerate(rows):
        formatted_rows.append(
            "  ".join(value.ljust(widths[index]) for index, value in enumerate(row))
        )
        if row_index == 0:
            formatted_rows.append("  ".join("-" * width for width in widths))

    formatted_rows.append("")
    formatted_rows.append(f"predicted makespan: {schedule['makespan_cycles']} cycles")
    formatted_rows.append("model: educational; not Groq performance")
    return "\n".join(formatted_rows)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("program", type=Path, help="input program JSON")
    parser.add_argument("--json", action="store_true", help="print schedule as JSON")
    parser.add_argument("--output", type=Path, help="write schedule JSON to a file")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        with args.program.open(encoding="utf-8") as stream:
            document = json.load(stream)
        if not isinstance(document, dict):
            raise ScheduleError("program document must be a JSON object")
        schedule = schedule_document(document)
    except (OSError, json.JSONDecodeError, ScheduleError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("w", encoding="utf-8") as stream:
            json.dump(schedule, stream, ensure_ascii=False, indent=2)
            stream.write("\n")

    if args.json:
        print(json.dumps(schedule, ensure_ascii=False, indent=2))
    else:
        print(format_schedule(schedule))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

