import json
from pathlib import Path
import unittest

from labs.static_scheduler import scheduler


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


class VectorAddScheduleTests(unittest.TestCase):
    def setUp(self):
        path = REPOSITORY_ROOT / "labs/static_scheduler/programs/vector_add.json"
        self.document = json.loads(path.read_text(encoding="utf-8"))

    def test_vector_add_schedule_is_deterministic(self):
        first = scheduler.schedule_document(self.document)
        second = scheduler.schedule_document(self.document)
        self.assertEqual(first, second)

    def test_vector_add_respects_functional_and_transport_delay(self):
        schedule = scheduler.schedule_document(self.document)
        operations = {
            operation["operation_id"]: operation
            for operation in schedule["operations"]
        }

        self.assertEqual(operations["read_x"]["start_cycle"], 0)
        self.assertEqual(operations["read_y"]["start_cycle"], 0)
        self.assertEqual(operations["add"]["start_cycle"], 4)
        self.assertEqual(operations["write_z"]["start_cycle"], 9)
        self.assertEqual(schedule["makespan_cycles"], 10)

    def test_resource_queue_contains_explicit_nop_interval(self):
        schedule = scheduler.schedule_document(self.document)
        vxm_queue = schedule["resource_queues"]["VXM"]
        self.assertEqual(
            vxm_queue[0], {"kind": "NOP", "start_cycle": 0, "cycles": 4}
        )
        self.assertEqual(vxm_queue[1]["operation_id"], "add")


class ConstraintTests(unittest.TestCase):
    def test_same_resource_operations_do_not_overlap(self):
        document = {
            "name": "resource_collision",
            "resources": ["VXM"],
            "operations": [
                {
                    "id": "a",
                    "resource": "VXM",
                    "latency": 5,
                    "occupancy": 3,
                },
                {
                    "id": "b",
                    "resource": "VXM",
                    "latency": 1,
                    "occupancy": 1,
                },
            ],
        }
        schedule = scheduler.schedule_document(document)
        operations = schedule["operations"]
        self.assertEqual(operations[0]["start_cycle"], 0)
        self.assertEqual(operations[1]["start_cycle"], 3)

    def test_cycle_is_rejected(self):
        document = {
            "name": "cycle",
            "resources": ["VXM"],
            "operations": [
                {
                    "id": "a",
                    "resource": "VXM",
                    "dependencies": [{"op": "b"}],
                },
                {
                    "id": "b",
                    "resource": "VXM",
                    "dependencies": [{"op": "a"}],
                },
            ],
        }
        with self.assertRaisesRegex(scheduler.ScheduleError, "cycle"):
            scheduler.schedule_document(document)

    def test_unknown_dependency_is_rejected(self):
        document = {
            "name": "unknown_dependency",
            "resources": ["MEM"],
            "operations": [
                {
                    "id": "read",
                    "resource": "MEM",
                    "dependencies": [{"op": "missing"}],
                }
            ],
        }
        with self.assertRaisesRegex(scheduler.ScheduleError, "unknown dependency"):
            scheduler.schedule_document(document)


if __name__ == "__main__":
    unittest.main()
