"""Isolated guardrail tests against the REAL _ids and _snapshot functions.
No MongoDB/network or production data. Run: python3 -m unittest discover -s backend/tests -v
"""
import ast
import asyncio
import pathlib
import unittest


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, limit):
        return self.docs[:limit]


class Collection:
    def __init__(self, docs):
        self.docs = [dict(d) for d in docs]

    def find(self, query, projection=None):
        def eq(actual, rule):
            if isinstance(rule, dict) and "$in" in rule:
                return actual in rule["$in"]
            return actual == rule
        found = [dict(row) for row in self.docs
                 if all(eq(row.get(field), condition) for field, condition in query.items())]
        return FakeCursor(found)


class FakeDatabase:
    def __init__(self, **collections):
        self.collections = {k: Collection(v) for k, v in collections.items()}

    def __getitem__(self, name):
        return self.collections.setdefault(name, Collection([]))

    def __getattr__(self, name):
        return self[name]


def load_real_cleanup_rules(db):
    file = pathlib.Path(__file__).resolve().parents[1] / "routes_test_cleanup.py"
    tree = ast.parse(file.read_text(encoding="utf-8"))
    selected = [n for n in tree.body
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                and n.name in ("_ids", "_snapshot")]
    assert len(selected) == 2, "Missing cleanup guard function"
    namespace = {
        "HTTPException": HTTPException,
        "db": db,
        "MAX_USERS": 25,
        "MAX_DOCS": 5000,
        "USER_FIELDS": {
            "attendance_events": "employee_id",
            "attendance_requests": "employee_id",
            "records": "owner_id",
            "leave_requests": "user_id",
            "planned_exceptions": "user_id",
            "attachments": "owner_id",
            "push_subscriptions": "user_id"
        },
    }
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(file), "exec"), namespace)
    return namespace["_ids"], namespace["_snapshot"]


def user(uid="test-1", role="employee", is_test=True, active=False):
    return {"id": uid, "role": role, "is_test": is_test, "active": active,
            "name": "Fiktivní testovací účet", "email": "fictional@example.invalid"}


class GuardrailTest(unittest.IsolatedAsyncioTestCase):
    async def test_only_explicit_test_employees_allowed(self):
        for role, is_test in (("owner", True), ("admin", True), ("manager", True),
                              ("employee", False), ("employee", None)):
            with self.subTest(role=role, is_test=is_test):
                db = FakeDatabase(users=[user(role=role, is_test=is_test)])
                ids, snapshot = load_real_cleanup_rules(db)
                with self.assertRaises(HTTPException) as cm:
                    await snapshot(ids({"user_ids": ["test-1"]}))
                self.assertEqual(cm.exception.status_code, 403)

    async def test_active_test_employee_is_blocked(self):
        db = FakeDatabase(users=[user(active=True)])
        _, snapshot = load_real_cleanup_rules(db)
        _, blockers, _ = await snapshot(["test-1"])
        self.assertTrue(any("deaktivovat" in s for s in blockers))

    async def test_service_history_is_blocked(self):
        db = FakeDatabase(
            users=[user()],
            records=[{"id": "rec-1", "owner_id": "test-1", "intervalService": True,
                      "date": "2026-10-20"}],
            machines=[{"label": "TEST MACHINERY", "last_service_record_id": "rec-1"}],
        )
        _, snapshot = load_real_cleanup_rules(db)
        _, blockers, _ = await snapshot(["test-1"])
        self.assertTrue(any("servis" in s.lower() for s in blockers))

    async def test_unrelated_real_employee_data_not_in_snapshot(self):
        db = FakeDatabase(
            users=[user(), user("real-2", is_test=False)],
            records=[{"id": "rec-1", "owner_id": "test-1"},
                     {"id": "rec-real", "owner_id": "real-2"}],
            attendance_events=[{"id": "att-1", "employee_id": "test-1"},
                               {"id": "att-real", "employee_id": "real-2"}],
        )
        _, snapshot = load_real_cleanup_rules(db)
        data, blockers, _ = await snapshot(["test-1"])
        self.assertEqual([r["id"] for r in data["records"]], ["rec-1"])
        self.assertEqual([r["id"] for r in data["attendance_events"]], ["att-1"])
        self.assertFalse(blockers)

    async def test_cross_linked_attachment_blocks_cleanup(self):
        db = FakeDatabase(users=[user()], attachments=[
            {"id": "att-1", "owner_id": "test-1", "record_id": "someone-elses-record",
             "storage_path": "sandbox/test/att-1", "sha256": "fake"}])
        _, snapshot = load_real_cleanup_rules(db)
        _, blockers, _ = await snapshot(["test-1"])
        self.assertTrue(any("Příloha" in s for s in blockers))

    async def test_weekly_exports_all_invalidated(self):
        db = FakeDatabase(users=[user()], weekly_exports=[
            {"week": "2026-10-19"}, {"week": "2026-10-12"}])
        _, snapshot = load_real_cleanup_rules(db)
        _, blockers, weeks = await snapshot(["test-1"])
        self.assertFalse(blockers)
        self.assertEqual(weeks, ["2026-10-12", "2026-10-19"])

    async def test_duplicate_or_empty_selection_rejected(self):
        ids, _ = load_real_cleanup_rules(FakeDatabase())
        for invalid in ([], ["x", "x"], "test-1"):
            with self.subTest(invalid=invalid), self.assertRaises(HTTPException):
                ids({"user_ids": invalid})


if __name__ == "__main__":
    unittest.main()
