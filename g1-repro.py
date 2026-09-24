"""Extract exact triage messages for the three representative G1 cases.

Reads both WebGL1/WebGL2 triage JSONs read-only and prints failing
assertion text for the representative tests plus signature samples.
"""
import json

for path in ("test-results/conformance/webgl1-triage.json", "test-results/conformance/webgl2-triage.json"):
    data = json.load(open(path, encoding="utf-8"))
    print("=" * 20, path)
    for t in data["tests"]:
        tid = t.get("id", "")
        tail = tid.split("/")[-1]
        if tail in ("buffer-bind-test.html", "context-creation.html") or "default.vert" in tid.lower():
            print("--", tid, t.get("rootCauseGroup"))
            for a in t.get("assertions", []) or []:
                if not a.get("success"):
                    print("   FAIL:", (a.get("message") or "")[:400])
    # also: first length-typeerror + first xhr-ish message samples
    n = 0
    for t in data["tests"]:
        if t.get("rootCauseGroup") != "G1":
            continue
        for a in t.get("assertions", []) or []:
            if not a.get("success"):
                m = a.get("message", "")
                if "length" in m.lower() or "xhr" in m.lower() or "default.vert" in m.lower():
                    print("SIG:", t["id"], "|", m[:300])
                    n += 1
                    break
        if n >= 4:
            break
