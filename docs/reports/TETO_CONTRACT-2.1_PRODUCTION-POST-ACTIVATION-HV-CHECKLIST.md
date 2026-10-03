# Contract 2.1 — Production Post-Activation Human Verification (checklist + record)

Status: **record of the completed Owner Production HV + reusable re-check list.** Docs only; no code, flag, economy or deploy change.
Authority (not copied here): `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md` (§3 disclosure, §4 invariants, §6 persistence, §7 Notebook, §13 Gate) and
`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` (390×844 primary, 360×800 secondary; videos are never committed).
Gate evidence: `docs/reports/TETO_CONTRACT-2.1_ACTIVATION-GATE-C_Result.md`.

## 1. Production record

| Item | Value |
|---|---|
| Audited main / deployed source | `fbd5305fb9452e0a6d38b188dd6f3099898a7ae8` (PR #366, MERGED; `origin/main` contains it) |
| Flag | `RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = true` (`src/logic/discovery/researchIdentifyFlag.ts`); Production build has no opt-out |
| Production Pages deploy | run **#262 — SUCCESS** (as reported by the Owner) |
| Contract 2.1 | Production **ON** |
| Owner Production HV | real iPhone, Production URL, Owner-supplied screenshots |
| Result | **PRODUCTION HUMAN VERIFICATION = PASS · Production blocker = NONE** (Owner Decision) |

## 2. Evidence, kept separate

### 2.1 Directly confirmed in the Owner Production HV (screenshots)

Flow that completed: Research Target → trial → RESULT → × → Trial Notebook → retry → ○ → next attempt shows the known ingredient ✓ → new ○ / × → NEW PIZZA discovery.

| # | Operation → expected result | Observed in Production | Priority |
|---|---|---|---|
| 1 | Production shows no Preview badge | Not separately recorded by the Owner as a checked item (the screenshots are Production). Re-check in Part A. | Critical |
| 2 | Cook screen with a Research Target → 「研究中 ？？？ピザ①」 stays through cooking | Confirmed | Critical |
| 3 | Hint sheet → known info consistent with the research | Confirmed: known info shown (tomato sauce, 「全部で5種類」, sub-topping class) | Important |
| 4 | Research trial → RESULT shows 「今回の試作結果」 (= flag really ON in Production) | Confirmed | Critical |
| 5 | Wrong ingredient → × | Confirmed: バジル×, ペパロニ×, マッシュルーム× | Critical |
| 6 | Trial Notebook → attempts and Research result recorded | Confirmed: 試作 #1 / #2, used ingredients, change from previous, Research result | Critical |
| 7 | Retry → new correct ingredient ○ | Confirmed: オレガノ○ (with トマト×, ベーコン×) | Critical |
| 8 | Next attempt → prior ○ shows as known ✓; new ○ / × | Confirmed: オレガノ ✓ (prior-known), ソーセージ○, ナス× | Critical |
| 9 | Reproduce the pizza → NEW PIZZA | Confirmed: ブラジリアン・カラブレーザ, No.10, 第2章 10/10, +100 Pitz (392 → 492) | Critical |
| 10 | After discovery → no stale Research result panel | Confirmed | Critical |
| 11 | Layout: no breakage, RESULT action CTA not hidden, operable (390×844 iPhone) | No serious layout break, hidden CTA or inoperability seen in the screenshots | Critical |

### 2.2 Automated evidence only — NOT repeated in the Owner Production HV

These were deliberately not reproduced on the real save. Do not read them as Owner-confirmed.

| Item | Where it is covered |
|---|---|
| × is not persisted (does not survive reload); only ○ persists as `ing:` | Not observed on a real device. Contract §6; `gameReducer.researchRows.test.ts` ("positives persist as ing:, negatives never", "transient result is not persisted"); Gate C §9 |
| ○ survives save → reload | Not reload-tested by the Owner in this HV. `gameReducer.researchRows.test.ts` (persistence via `persistProgress` / `loadSave`); `discovery-hint-facts-save.spec.ts` |
| HOME / Dex reflection | The Owner's record covers the NEW PIZZA screen (No.10, 10/10, Pitz); a separate HOME / Dex check is not recorded. `discovery-research-dex.spec.ts` |
| Last-stock boundary (OD-RB-18) | Not exercised in Production. `contract-2-1-final.spec.ts` test G; `gameReducer.researchRows.test.ts` / `researchLoop.test.ts` (`researchTargetValidAtStart`) |
| Topping over K = 3 | Not exercised in Production. `researchResultRows.test.ts`; `contract-2-1-final.spec.ts` tests B / C |
| 360×800 | Not tested on a real device. Chromium 360×800 project in `contract-2-1-final.spec.ts` (Activation PR CI) |
| No 「なし」/ count wording, oracle parity, Notebook line shape | Unit / e2e (`discovery3-oracle-neutralization.spec.ts`, `trialRecord.gate.test.ts`) |
| Console / runtime errors | No console was inspected in the Owner HV; no failure was reported. |

## 3. Re-check lists (for a future Production change; Owner iPhone, 390×844 primary)

Format: operation → expected result. 🔴 Critical / 🟠 Important / 🟡 Optional.

### Part A — minimal post-publish smoke (~5 min)

- 🔴 Open Production → no 「PREVIEW · …」 badge.
- 🔴 Start a Research Target trial → RESULT shows 「今回の試作結果」 (absent = flag OFF or wrong build).
- 🔴 Place a correct new ingredient → ○ chip; a wrong one → × chip; no 「なし / 全部 / あと」, no counts.
- 🔴 Retry with that ○ ingredient → ✓ (known), not ○ again.
- 🔴 Open 「📓 試作ノート」 (before reloading) → the attempt line shows the same judgments as RESULT.
- 🔴 Reload → ○ stays known in the Research header; × is gone (not kept). The Trial Notebook is session-only (Contract §7), so it is empty after a reload — expected, not a failure.
- 🔴 No visible error / white screen; if devtools are available, no console error.
- 🔴 Deployed commit = the intended merge commit (Pages run SHA).

### Part B — fuller HV

- 🔴 Research context 「研究中 ？？？ピザ①」 stays through DOUGH–BAKE.
- 🔴 Header ✓ list matches stored ○ plus the unlock fact; Hint rung for an already-known fact is ALREADY_KNOWN / 0 Pitz.
- 🔴 Last stock: use up the target's last stock → that attempt keeps its result, Notebook line and ○; the next retry shows no result. (Needs a prepared save; see §4.)
- 🔴 Reproduce the pizza → NEW PIZZA; no Research panel on that screen; Pitz = previous + reward.
- 🟠 4+ unknown toppings → no topping chips, only 「トッピングは一度に3種類まで調べられるよ」; sauce / cheese rows remain.
- 🟠 HOME / Dex → new discovery reflected; Research Entry count updates.
- 🟠 Save → reload after discovery → Dex, Pitz, ladder unchanged.
- 🟡 360×800 (secondary): chips wrap, RESULT action bar not hidden.
- 🟡 Trial Notebook readability (known non-blocking UX follow-up).

## 4. Safety notes

- Production `?hv=` seeds are no-ops; boundary cases need a deliberately prepared real save. They were intentionally not forced on the Owner's real save in this HV.
- A Production smoke changes the real save (Pitz, stock, Dex). Back it up first if the state matters.
- **Rollback:** set `RESEARCH_IDENTIFY_PRODUCTION_DEFAULT` back to `false` in `src/logic/discovery/researchIdentifyFlag.ts` (one line, via a normal PR + deploy). OFF = pre-Contract-2.1 behavior; the save schema is unchanged (`schemaVersion` 2), so no migration. Roll back on any Critical failure.
- **Owner exception OD-HV-SCREENSHOT (this Production HV only).** Screenshots are **not committed** under an explicit Owner exception; this is **not** a Policy §6-compliant record, and Policy §6 is not changed for any future HV. The Owner ran the HV on a real iPhone in Production and reviewed the screenshots in a ChatGPT conversation; the repository records the Owner HV evidence and the Owner Decision (PASS, blocker NONE), not the images. Videos are not committed either (Policy §6). Images can be added later under `docs/reports/screenshots/<task-name>/` if the Owner wants.

## 5. Out of scope / still open

#360 (Hint knowledge duplication), the 53 / 172 Scale Audit, Trial Notebook readability UX, and post-Production re-evaluation of ★3-FULL replay / refill cost (Gate C §12.1) are unchanged by this record.
