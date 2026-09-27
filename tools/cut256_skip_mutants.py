#!/usr/bin/env python3
"""Issue #256 Fresh Audit: throwaway "skip CUT on a failed bake" mutants (impact measurement only).

Applies one mutant to a checkout of PR #252 (head d11858a) or later, so that the existing test suite
shows which contracts pin the current "CUT is decided by recipe identity, never by the bake" rule.
Never commit the result. Usage (from the checkout root):

    python3 tools/cut256_skip_mutants.py M1   # then: npx vitest run ; git checkout -- src

M1  base reducer only: a Completion Gate FAILED pizza with UNDERBAKED / OVERBAKED among its
    failures skips POST_BAKE (Guided / Lunch Rush / Dinner share this path).
M2  base reducer only: any Completion Gate FAILED pizza skips POST_BAKE.
M3  M1 plus Dinner Stage B: resolveDinnerAttempt no longer rejects CUT_PENDING when the bake is
    outside the acceptable band (otherwise M1 leaves Dinner stuck in BAKE).
"""
import sys

REDUCER = "src/state/gameReducer.ts"
DINNER = "src/mission/dinner/dinnerResultDetection.ts"
ANCHOR = "const postBake = postBakeSteps(state.cookingProfile);"
BAKE_FAILED = (
    'const bakeFailed = completion.status === "FAILED" && completion.failures.some('
    '(f) => f.reason === "UNDERBAKED" || f.reason === "OVERBAKED");\n      '
)


def patch(path: str, old: str, new: str) -> None:
    src = open(path, encoding="utf-8").read()
    if old not in src:
        sys.exit(f"anchor not found in {path}: {old}")
    open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))


def main(name: str) -> None:
    if name in ("M1", "M3"):
        patch(REDUCER, ANCHOR, BAKE_FAILED + "const postBake = bakeFailed ? [] : postBakeSteps(state.cookingProfile);")
    elif name == "M2":
        patch(REDUCER, ANCHOR, 'const postBake = completion.status === "FAILED" ? [] : postBakeSteps(state.cookingProfile);')
    else:
        sys.exit("usage: cut256_skip_mutants.py M1|M2|M3")
    if name == "M3":
        patch(
            DINNER,
            "if (plan.cutRequired && !input.cutCompleted) return",
            "const dish = evaluateFreeCookCompletion(pizza, plan.bakeWindow.target);\n"
            '  const bakeInvalid = dish.status === "FAILED" && dish.failures.some('
            '(f) => f.reason === "UNDERBAKED" || f.reason === "OVERBAKED");\n'
            "  if (plan.cutRequired && !input.cutCompleted && !bakeInvalid) return",
        )


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
