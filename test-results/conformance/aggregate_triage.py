import json
from collections import Counter

with open("test-results/conformance/webgl2-triage.json", encoding="utf-8") as f:
    data = json.load(f)

tests = data["tests"]
cls = Counter(t.get("classification") for t in tests)
grp = Counter(t.get("rootCauseGroup") for t in tests)

print("totals:", data["totals"])
print("reconciliation valid:", data["verdictReconciliation"]["valid"])
print("tests in array:", len(tests))
print("byClassification:", dict(cls))
print("byRootCauseGroup:", dict(grp))
print("missing classification:", sum(1 for t in tests if t.get("classification") is None))
print("missing rootCauseGroup:", sum(1 for t in tests if t.get("rootCauseGroup") is None))