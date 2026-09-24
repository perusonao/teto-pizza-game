#!/usr/bin/env python3
"""Combine the raw outputs of run.sh / run-e2e.sh into the committed simulation JSON.

Usage: python3 tools/pr206-forward-compat-sim/combine.py <SIM_WORK> <out.json>
"""
import json
import sys
from pathlib import Path

work, out = Path(sys.argv[1]), Path(sys.argv[2])
unit = json.loads((work / "TETO_PR206_FORWARD-COMPAT_SIMULATION.unit.json").read_text())
e2e = {
    label: json.loads((work / f"TETO_PR206_FORWARD-COMPAT_SIMULATION.e2e-{label}.json").read_text())
    for label in ("A", "B")
}
meta = json.loads((Path(__file__).parent / "meta.json").read_text())
out.write_text(
    json.dumps({**meta, "unitSimulation": unit, "browserSession": e2e}, indent=2, ensure_ascii=False)
    + "\n"
)
print(f"wrote {out}")
