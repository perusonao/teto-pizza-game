# Issue #216 — Deadlock / Economy Simulation

All prices and gates are comparison inputs. Unknown future `k` is simulated symbolically: grant `10k`, consume `k`; using coefficient 1 does not assert a piece count.

| Fee curve | Capability | Quality | Result | Reach | Bakes | Grind | Unlock fees | First stock | Dough/pan | Refills | Re-lock |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| F0_NO_FEE_CONTROL | A_PAID | ★1 | COMPLETE | 101/101 | 483 | 382 | 0 | 12760 | 1700 | 180 | False |
| F0_NO_FEE_CONTROL | A_PAID | ★3 | COMPLETE | 101/101 | 122 | 21 | 0 | 12760 | 1700 | 180 | False |
| F0_NO_FEE_CONTROL | B_AUTO | ★1 | COMPLETE | 101/101 | 483 | 382 | 0 | 12760 | 1700 | 180 | False |
| F0_NO_FEE_CONTROL | B_AUTO | ★3 | COMPLETE | 101/101 | 122 | 21 | 0 | 12760 | 1700 | 180 | False |
| F0_NO_FEE_CONTROL | C_TUTORIAL | ★1 | COMPLETE | 101/101 | 483 | 382 | 0 | 12760 | 1700 | 180 | False |
| F0_NO_FEE_CONTROL | C_TUTORIAL | ★3 | COMPLETE | 101/101 | 122 | 21 | 0 | 12760 | 1700 | 180 | False |
| F1_LIGHT | A_PAID | ★1 | COMPLETE | 101/101 | 684 | 583 | 4010 | 12760 | 1700 | 180 | False |
| F1_LIGHT | A_PAID | ★3 | COMPLETE | 101/101 | 172 | 71 | 4010 | 12760 | 1700 | 180 | False |
| F1_LIGHT | B_AUTO | ★1 | COMPLETE | 101/101 | 668 | 567 | 3700 | 12760 | 1700 | 180 | False |
| F1_LIGHT | B_AUTO | ★3 | COMPLETE | 101/101 | 168 | 67 | 3700 | 12760 | 1700 | 180 | False |
| F1_LIGHT | C_TUTORIAL | ★1 | COMPLETE | 101/101 | 668 | 567 | 3700 | 12760 | 1700 | 180 | False |
| F1_LIGHT | C_TUTORIAL | ★3 | COMPLETE | 101/101 | 168 | 67 | 3700 | 12760 | 1700 | 180 | False |
| F2_BALANCED | A_PAID | ★1 | COMPLETE | 101/101 | 828 | 727 | 6900 | 12760 | 1700 | 180 | False |
| F2_BALANCED | A_PAID | ★3 | COMPLETE | 101/101 | 208 | 107 | 6900 | 12760 | 1700 | 180 | False |
| F2_BALANCED | B_AUTO | ★1 | COMPLETE | 101/101 | 802 | 701 | 6380 | 12760 | 1700 | 180 | False |
| F2_BALANCED | B_AUTO | ★3 | COMPLETE | 101/101 | 202 | 101 | 6380 | 12760 | 1700 | 180 | False |
| F2_BALANCED | C_TUTORIAL | ★1 | COMPLETE | 101/101 | 802 | 701 | 6380 | 12760 | 1700 | 180 | False |
| F2_BALANCED | C_TUTORIAL | ★3 | COMPLETE | 101/101 | 202 | 101 | 6380 | 12760 | 1700 | 180 | False |
| F3_HEAVY | A_PAID | ★1 | COMPLETE | 101/101 | 1173 | 1072 | 13800 | 12760 | 1700 | 180 | False |
| F3_HEAVY | A_PAID | ★3 | COMPLETE | 101/101 | 294 | 193 | 13800 | 12760 | 1700 | 180 | False |
| F3_HEAVY | B_AUTO | ★1 | COMPLETE | 101/101 | 1121 | 1020 | 12760 | 12760 | 1700 | 180 | False |
| F3_HEAVY | B_AUTO | ★3 | COMPLETE | 101/101 | 281 | 180 | 12760 | 12760 | 1700 | 180 | False |
| F3_HEAVY | C_TUTORIAL | ★1 | COMPLETE | 101/101 | 1121 | 1020 | 12760 | 12760 | 1700 | 180 | False |
| F3_HEAVY | C_TUTORIAL | ★3 | COMPLETE | 101/101 | 281 | 180 | 12760 | 12760 | 1700 | 180 | False |

## Machine checks

- Scenarios: 24
- Deadlocks: 0
- Re-locks: 0
- Unreachable targets: 0 in every scenario
- Capability coverage: all 11 represented; LAMINATE intentionally has 0 current target gain
- Full Chromium/WebKit: not run (docs/data/tooling only)
