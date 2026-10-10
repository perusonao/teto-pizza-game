"""Tests for TETO_POST-W1_COOKING-STEPS_classify.py (docs/data tooling only; not part of the app build).

Run (from anywhere): python3 -I docs/reports/data/TETO_POST-W1_COOKING-STEPS_classify_test.py -v
"""
import json, os, re, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SCRIPT = os.path.join(HERE, "TETO_POST-W1_COOKING-STEPS_classify.py")
COMMITTED_JSON = os.path.join(HERE, "TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION.json")
COMMITTED_MD = os.path.join(ROOT, "docs/reports/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION_ROWS.md")
DESIGN = os.path.join(ROOT, "docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md")


def _read(p):
    with open(p) as f:
        return f.read()


def _load(p):
    return json.loads(_read(p))


def run(sha, out_dir):
    j, m = os.path.join(out_dir, "o.json"), os.path.join(out_dir, "o.md")
    p = subprocess.run([sys.executable, "-I", SCRIPT, ROOT, j, m, sha], capture_output=True, text=True)
    return p, j, m


def committed_sha():
    return _load(COMMITTED_JSON)["summary"]["auditedMainSha"]


def have_commit(sha):
    return subprocess.run(["git", "-C", ROOT, "cat-file", "-e", f"{sha}^{{commit}}"], capture_output=True).returncode == 0


class ClassifyTests(unittest.TestCase):
    def test_rejects_unresolvable_sha(self):
        with tempfile.TemporaryDirectory() as d:
            p, j, _ = run("0" * 40, d)
            self.assertEqual(p.returncode, 2)
            self.assertFalse(os.path.exists(j), "no output may be written for a rejected SHA")

    def test_rejects_garbage_sha(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(run("not-a-sha", d)[0].returncode, 2)

    def test_committed_sha_is_full_and_summary_is_consistent(self):
        d = _load(COMMITTED_JSON)
        self.assertRegex(d["summary"]["auditedMainSha"], r"^[0-9a-f]{40}$")
        self.assertEqual(sum(d["summary"]["byClass"].values()), d["summary"]["rows"])
        self.assertEqual(len(d["rows"]), d["summary"]["rows"])

    def test_committed_outputs_reproduce_from_their_recorded_sha(self):
        sha = committed_sha()
        if not have_commit(sha):
            self.skipTest(f"{sha} not in this clone (shallow?)")
        with tempfile.TemporaryDirectory() as d:
            p, j, m = run(sha, d)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertEqual(_read(j), _read(COMMITTED_JSON))
            self.assertEqual(_read(m), _read(COMMITTED_MD))

    def test_inputs_are_read_only_from_git_not_the_working_tree(self):
        """Static guard (never touches src/): the only file reads of repo inputs go through `git show`."""
        with open(SCRIPT) as f:
            src = f.read()
        self.assertIn('"show", f"{SHA}:{path}"', src)
        self.assertNotRegex(src, r"open\(f?[\"'].*ROOT", "repo inputs must not be opened from the working tree")

    def test_markdown_rows_have_constant_column_count_and_escape_pipes(self):
        md = _read(COMMITTED_MD).splitlines()
        counts = {len(re.split(r"(?<!\\)\|", l)) for l in md}
        self.assertEqual(len(counts), 1, f"ragged table columns: {counts}")
        self.assertIn("unresolved:mid_bake\\|post_bake", "\n".join(md), "eel row must carry an escaped pipe")

    def test_supported_sauce_snapshot_matches_recorded_sha(self):
        """RUNTIME_SAUCES is a fixed snapshot; it must equal the sauce-category ingredients at the recorded SHA."""
        sha = committed_sha()
        if not have_commit(sha):
            self.skipTest(f"{sha} not in this clone (shallow?)")
        m = re.search(r"^RUNTIME_SAUCES = \{([^}]*)\}", _read(SCRIPT), re.M)
        self.assertIsNotNone(m, "RUNTIME_SAUCES snapshot not found")
        snapshot = set(re.findall(r'"([^"]+)"', m.group(1)))
        src = subprocess.run(["git", "-C", ROOT, "show", f"{sha}:src/data/ingredients.ts"],
                             capture_output=True, text=True, check=True).stdout
        at_sha = set(re.findall(r'^\s{4}id: "([^"]+)",\s*\n\s*category: "sauce"', src, re.M))
        self.assertEqual(snapshot, at_sha,
                         f"RUNTIME_SAUCES does not match the sauces at {sha[:7]}; update it when re-baselining")

    def test_no_stale_tq1d_gate_wording(self):
        for path in (SCRIPT, COMMITTED_JSON, DESIGN):
            self.assertNotRegex(_read(path), r"gated by TQ-1D|production = TQ-1D|PR #275 OPEN", path)

    def test_design_doc_numbers_match_generated_json(self):
        s = _load(COMMITTED_JSON)["summary"]
        doc = _read(DESIGN)
        bc, ug = s["byClass"], s["authorityGapRowsByUnderlyingMechanicClass"]
        self.assertIn(
            f"(re-run at `{s['auditedMainSha'][:7]}`: **{bc['CURRENT_ENGINE']} · {bc['DATA_ONLY']} · {bc['SMALL_ENGINE']} "
            f"· {bc['MAJOR']} · {bc['AUTHORITY_GAP']}**", doc)
        row = next(l for l in doc.splitlines() if l.startswith("| AUTHORITY_GAP |"))
        self.assertIn(
            f"CURRENT {ug['CURRENT_ENGINE']} · DATA {ug['DATA_ONLY']} · SMALL {ug['SMALL_ENGINE']} "
            f"· MAJOR {ug['MAJOR']} · (still gap) {ug['AUTHORITY_GAP']}", row)
        self.assertIn(f"| CURRENT_ENGINE | **{bc['CURRENT_ENGINE']}**", doc)
        self.assertIn(f"| DATA_ONLY | **{bc['DATA_ONLY']}**", doc)
        self.assertIn(f"**{bc['AUTHORITY_GAP']}**", row)


if __name__ == "__main__":
    unittest.main()
