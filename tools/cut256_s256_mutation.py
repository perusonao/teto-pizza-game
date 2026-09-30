#!/usr/bin/env python3
"""Issue #256 S-256: the 7 mutation / adversarial cases (tooling only; never commit a mutant).

Each mutant rewrites one production anchor, runs the focused suites, records whether any test
failed ("detected"), then restores the file with `git checkout`. Run from the repo root:

    python3 tools/cut256_s256_mutation.py [--out docs/reports/data/.../s256-mutation.json]
"""
import argparse
import json
import subprocess
import sys

REDUCER = "src/state/gameReducer.ts"
RESOLVER = "src/mission/dinner/dinnerResultDetection.ts"
GATE = "src/logic/completionGate.ts"
SUITES = [
    "src/state/gameReducer.cutSkipFailedBake.test.ts",
    "src/state/gameReducer.cutStep.test.ts",
    "src/state/gameReducer.dinner.test.ts",
    "src/mission/dinner/dinnerResultDetection.test.ts",
]
SKIP = "const postBake = bakeCompletionFailure(completion) ? [] : postBakeSteps(state.cookingProfile);"

MUTANTS = [
    ("MU-1 skip keyed on the bakeState badge", REDUCER, SKIP,
     'const postBake = bakeState !== "perfect" ? [] : postBakeSteps(state.cookingProfile);'),
    ("MU-2 skip on any Completion Gate FAILED", REDUCER, SKIP,
     'const postBake = completion.status === "FAILED" ? [] : postBakeSteps(state.cookingProfile);'),
    ("MU-3 base-only: the Dinner guard forwards no waiver", REDUCER,
     "const cutWaivedFor = bakeCompletionFailure(baked.completion);", "const cutWaivedFor = null;"),
    ("MU-4 resolver ignores the waiver", RESOLVER,
     "const cutWaivedFor = cutPending ? (input.cutWaivedFor ?? null) : null;", "const cutWaivedFor = null;"),
    ("MU-5 resolver trusts the waiver (no mismatch guard)", RESOLVER,
     "    cutWaivedFor !== null &&\n", "    false &&\n"),
    ("MU-6 selector reads only the primary reason", GATE,
     "  for (const failure of completion.failures) {",
     "  for (const failure of [{ reason: completion.reason }]) {"),
    ("MU-7 selector ignores OVERBAKED", GATE,
     'if (failure.reason === "UNDERBAKED" || failure.reason === "OVERBAKED") return failure.reason;',
     'if (failure.reason === "UNDERBAKED") return failure.reason;'),
]


def run_suites() -> tuple[bool, list[str]]:
    proc = subprocess.run(["npx", "vitest", "run", *SUITES], capture_output=True, text=True)
    out = proc.stdout + proc.stderr
    failing = sorted({line.strip() for line in out.splitlines() if line.strip().startswith("FAIL ")})
    return proc.returncode != 0, failing


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    results = []
    for name, path, old, new in MUTANTS:
        src = open(path, encoding="utf-8").read()
        if src.count(old) != 1:
            sys.exit(f"{name}: anchor not found exactly once in {path}")
        open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))
        try:
            detected, failing = run_suites()
        finally:
            subprocess.run(["git", "checkout", "--", path], check=True)
        results.append({"mutant": name, "detected": detected, "failingTests": failing})
        print(f"{'DETECTED' if detected else 'SURVIVED'}  {name}  ({len(failing)} failing)")
    clean, _ = run_suites()
    print("baseline after restore:", "FAIL" if clean else "PASS")
    if args.out:
        open(args.out, "w", encoding="utf-8").write(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    if not all(r["detected"] for r in results) or clean:
        sys.exit(1)


if __name__ == "__main__":
    main()
