"""Sprint 13 Task 1: G1 signature aggregation over both triage JSONs."""
import json
import re
from collections import Counter

RULES = [
    ("length-typeerror", re.compile(r"reading 'length'|cannot read propert.*length", re.I)),
    ("inline-script", re.compile(r"inline-script\.js|Script error.*inline|executeTestPage", re.I)),
    ("default-vert-xhr", re.compile(r"default\.vert|XMLHttpRequest|404|status.*0", re.I)),
    ("bad-test-description", re.compile(r"bad test description|missing.*description|no test description", re.I)),
    ("unpack-colorspace", re.compile(r"UNPACK_COLORSPACE_CONVERSION_WEBGL", re.I)),
    ("canplaytype", re.compile(r"canPlayType", re.I)),
    ("limit-null", re.compile(r"limit.*null|null.*limit|Was null", re.I)),
]

def bucket(messages):
    """Classify a test's failure messages into the first matching signature bucket.

    Args:
        messages: Failing assertion message strings for one test.

    Returns:
        Signature bucket name from RULES, or "other" when nothing matches.
    """
    text = " | ".join(messages)
    for name, rx in RULES:
        if rx.search(text):
            return name
    return "other"


def agg(path):
    """Aggregate G1 signature counts for one triage JSON file.

    Args:
        path: Workspace-relative path to a triage JSON file.

    Returns:
        Tuple of (total test count, G1 count, per-bucket Counter, per-bucket example).
    """
    data = json.load(open(path, encoding="utf-8"))
    tests = data["tests"]
    g1 = [t for t in tests if t.get("rootCauseGroup") == "G1"]
    c = Counter()
    examples = {}
    for t in g1:
        msgs = [a.get("message", "") for a in (t.get("assertions") or []) if not a.get("success")]
        b = bucket(msgs)
        c[b] += 1
        examples.setdefault(b, (t["id"], msgs[0][:200] if msgs else ""))
    return len(tests), len(g1), c, examples


for path in ("test-results/conformance/webgl1-triage.json", "test-results/conformance/webgl2-triage.json"):
    total, g1n, c, ex = agg(path)
    print(path, "total=", total, "G1=", g1n)
    for k in [r[0] for r in RULES] + ["other"]:
        print("  ", k, c.get(k, 0))
    print("  reconciled:", sum(c.values()), "== G1:", sum(c.values()) == g1n)
    for k, (tid, m) in ex.items():
        print("  ex", k, tid, "|", m[:160])
