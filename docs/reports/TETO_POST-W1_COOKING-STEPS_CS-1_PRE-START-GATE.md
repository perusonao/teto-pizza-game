# TETO Post-W1 Cooking Steps — CS-1 Pre-Start Gate (Owner Decision prep, docs-only)

Status: **Fresh Check complete — STOP at Owner Decisions.** CS-1 has not started. No `src/**`,
`e2e/**`, CSS, runtime, tooling or test change. Nothing is merged. No Owner Decision is made here.

| Item | Value |
|---|---|
| **Audited `main` SHA** | `86b48fd51423a8f76db5398ab88ecfd944e2ae10` (fresh `git fetch origin`, 2026-09-28) |
| Starting point | Issue #294, PR #295 (head `a30526a`) — `docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md` |
| Branch | `claude/post-w1-cooking-steps-design-2nomy3` (same branch as PR #295) |
| Resume note | Resumed after a session limit. `main`, PR #275 (`21fbedf`), Issue #294 and PR #295 re-checked: unchanged, no new comments, so nothing was re-audited. Added §4.1 (OD-CS-2 per-aspect matrix incl. reload / abandon / CUT / post-bake steps) and §6.1 (#275 semantic sequencing). |
| Parallel work, not touched | Hint 5.0 H5-3 (`claude/hint-5-0-fresh-audit-cdgm9e`, head `abce62a`, read only), Cooking Techniques 1.0 Fresh Design (no new branch visible at audit time), Taxonomy Human Review (PR #293, read only), PR #275 (read only) |

---

## 1. Delta since PR #295

**`main` has not moved:** `origin/main` = `86b48fd`, the same SHA PR #295 audited, and
`git log 86b48fd..origin/main` is empty. Every code fact in the design's §1 is therefore unchanged
(re-checked below). Issue #294 and PR #295 have no comments.

What **did** move is outside `main`:

| Item | State now | Relevance to CS-1 |
|---|---|---|
| PR #275 (#256) | **OPEN**, head `21fbedf`, base `4f7443a` (47 commits behind `main`), GitHub `mergeable_state: clean`. A local trial merge onto `86b48fd` merges with **no textual conflict**. | Edits the exact CONFIRM_BAKE post-BAKE line and the Dinner guard that CS-1 would extract (§6). |
| Hint 5.0 branch | H5-1 (pure layer) and H5-2 (reducer, behind an off flag) committed on `claude/hint-5-0-fresh-audit-cdgm9e`; not PR'd to `main` yet; H5-3 in progress | Touches `gameReducer.ts`, but only the hint actions, the `PURCHASE_HINT5_RUNG` case and `DINNER_BLOCKED_ACTIONS` — disjoint from CONFIRM_BAKE / POST_BAKE hunks. H5-3 (UI) may touch the hint sheet; watch `GameScreen.tsx` / `App.tsx` at CS-1 start. |
| PR #293 (taxonomy) | OPEN, docs only | None for CS-1. |
| Techniques | TQ-1A/1B/1C on `main`; TQ-1D not started; TQ-2 / TQ-3 only named in the OWNER-DECISION-GATE §9.2 ("その後") | Unchanged authority for OD-CS-1. |

## 2. Re-verified on `86b48fd`

| Check | Result |
|---|---|
| GameScreen post-bake / CUT wiring | `phase === "POST_BAKE" && makingStep === "CUT"` at **6** sites: `GameScreen.tsx:325, 423, 509, 626, 641, 674`; `nextReady` picks `cutConfirmReady` for any POST_BAKE (`:515`). Score / completion render only in RESULT (`:853`, `:880`) — nothing on the CUT screen reads them. |
| CONFIRM_BAKE finalization | One block (`gameReducer.ts:1144-1253`): free-cook match → Scoring 2.0 → Completion Gate → `consumePizzaInventory` → post-BAKE entry. Non-matched free-cook rounds finalize in an early branch (`:1163-1188`). |
| Save coupling | `state.inventory` is written by `persistProgress` whenever it changes (`App.tsx:353`). Consumption at CONFIRM_BAKE is therefore **saved before CUT starts**. |
| Dinner timing | Identity = composition at **START_BAKE** (`dinnerStartBake` → `planDinnerBake`, `gameReducer.ts:1858`, `dinnerResultDetection.ts:88`); the pre-consumption stock is captured at CONFIRM_BAKE; resolution at the last CUT confirm or at CONFIRM_BAKE when no CUT follows. |
| Lunch Rush coupling | `handleMissionServeNext` reads `state.score` / `state.completion` after RESULT (`App.tsx:614-629`); `cookingTiming` is null in Lunch Rush; the mission clock runs through CUT. |
| Tab count | 18 recipes × 6 tabs, 7 × 5 tabs (§5). No unit invariant exists; E2E only. |
| Reload | The round in progress is never persisted (`App.tsx:166`): a reload always lands on HOME with a fresh round. Only the progression fields (incl. `inventory`) survive. |
| Abandon (HOME) | FREE: `isRoundInProgress()` (`App.tsx:797-805`) covers PREPARE (once started) and BAKE only — **POST_BAKE is not covered**, so 🏠ホーム during CUT leaves with no confirm dialog; stock is already spent (CONFIRM_BAKE) and REGISTER_TO_DEX (deferred to the end of POST_BAKE) never runs, so no Dex / BEST / Pitz. Lunch Rush: always confirmed (mission PLAYING). Dinner: its own abandon dialog → run ABANDONED. |

---

## 3. OD-CS-1 — late-addition ownership

| | **A. Cooking Steps = engine (inert); TQ-2 = production enable** | B. Cooking Steps owns everything to production | C1. Everything waits and ships inside TQ-2 | C2. Split by mode: CS owns scatter, TQ-2 owns identity only |
|---|---|---|---|---|
| Fit with OD-TQ-2 (後乗せ = technique) | ✅ technique identity, `late` axis, content and near-miss stay with TQ-2 | ❌ ships a technique outside the Techniques track, or ships late content with no technique — needs an OD-TQ-2 re-decision | ✅ | ⚠ splits one technique's surface across two tracks (content without identity would ship first) |
| Fit with TQ-1D ordering (TQ-2 after TQ-1D) | ✅ engine can land before TQ-1D because it is inert | ❌ production late recipes before TQ-1D; the DH4 / Hint 5.0 tripwires would fire | ✅ | ⚠ |
| INV-TQ-4-style inertness | ✅ same pattern as TQ-1C (inert until activation) | ❌ | n/a | ⚠ |
| PR size / risk | small, staged (CS-1 → CS-2 → TQ-2) | medium–large; mixes engine, content and identity | **one large PR** (engine + content + technique + HV) | medium |
| Hint 5.0 / DH4 re-audit owner | TQ-2 recipe PR (as the design §10 H11 says) | Cooking Steps (not its authority) | TQ-2 | unclear |
| Dinner / Lunch Rush policy | decided at TQ-2 activation (OD-CS-5 / 6) | decided by Cooking Steps | TQ-2 | split |

**Recommendation (not a decision): A.** It is the only option that matches OD-TQ-2 and the TQ-1D →
TQ-2 order without a re-decision, and it keeps the reducer-risk slices (CS-1, CS-2) away from any
player-visible change. If the Owner prefers B, OD-TQ-2 must be re-decided first.

---

## 4. OD-CS-2 — finalize semantics

"Finalize" = Scoring 2.0 + Completion Gate + inventory consumption + free-cook match (the four
CONFIRM_BAKE computations).

| Impact | **A. All final at CONFIRM_BAKE** | **B. Normal recipes final at CONFIRM_BAKE; post-bake-requirement recipes provisional → final at FINISH exit** | **C. All final at round end (FINISH / last post-bake step)** |
|---|---|---|---|
| Existing 25 recipes | byte-identical | **byte-identical by construction** (no current profile has a post-bake requirement) | **changes** for 24 CUT recipes: finalization moves after CUT |
| Scoring | late pieces placed in FINISH are **never scored** → late addition is pointless | late pieces scored at FINISH exit through existing Pieces / Q / Recipe; the provisional score is never shown (score UI is RESULT-only) | late pieces scored; every recipe's score now computed after CUT (same number, later) |
| Completion Gate | a late requirement is **MISSING at CONFIRM_BAKE** → recipe FAILS before the player can add it | provisional gate excludes post-bake requirements; final gate at FINISH exit checks all | checks all at round end |
| Bake failure (PR #275) | compatible | compatible: #275 needs only the bake verdict, which the provisional gate still produces at CONFIRM_BAKE; whether FINISH is skipped too is OD-CS-7 | **conflicts**: #275's single verdict point is CONFIRM_BAKE; C needs a separate provisional bake verdict anyway |
| Dinner | unchanged | unchanged for Dinner targets; a late recipe cannot be identified at Stage A (START_BAKE) regardless → OD-CS-5 | `preConsumptionInventory` capture and Stage B inputs move; DM-3R / DM-4 invariants need re-proof |
| Lunch Rush | unchanged | unchanged (serve reads `state.score` / `state.completion` at RESULT, after the final value); only matters if late recipes enter the pool (OD-CS-6) | unchanged at serve time; inventory timing moves |
| Save / inventory | unchanged | base consumption saved at CONFIRM_BAKE as today; **late pieces consumed at FINISH exit** (one delta write). Quit during FINISH: base stock already spent, late items not spent | **consumption moves after CUT**: bake then quit / reload during CUT returns every ingredient — a new stock exploit and a visible save-behaviour change |
| Free-cook match | unchanged | provisional match cannot see late pieces; final match at FINISH exit (needed so a late recipe is discoverable, OD-CS-4) | match after CUT for all |
| UI | none | none on the CUT screen (it reads no score); RESULT reads the final value | none visible, but E2E timing of RESULT data shifts |
| Reducer complexity | none | one extra finalize call site guarded by "profile has a post-bake requirement" | moves four computations; every POST_BAKE exit becomes a finalize point |
| Late addition possible? | **no** | yes | yes |

**Recommendation (not a decision): B.** A cannot express late addition at all; C changes today's
behaviour (save/stock exploit, #275 conflict, Dinner re-proof) for no gain on current recipes. B is
byte-identical for everything shipped and confines the new path to recipes that do not exist yet.
CS-1's `finalizeRound()` extraction is the same under A/B/C, so CS-1 does not pre-empt this choice.

### 4.1 OD-CS-2 — per-aspect matrix (required rows)

"FINISH" below = the exit of the post-bake requirement step (CS-2); for C it means "the last
post-bake step, or CONFIRM_BAKE when a recipe has none".

| Aspect | A. all final at CONFIRM_BAKE | B. normal = CONFIRM_BAKE final; post-bake recipe = provisional → final at FINISH | C. all final at FINISH / round end |
|---|---|---|---|
| **Scoring** | computed once at CONFIRM_BAKE; late pieces never scored | normal: as today. Post-bake recipe: provisional at CONFIRM_BAKE (never displayed), final at FINISH with late pieces in Pieces / Q / Recipe | every CUT recipe scored after CUT (same number, later) |
| **Inventory consumption** | once at CONFIRM_BAKE; late pieces never consumed (free ingredients) | base pieces at CONFIRM_BAKE (as today) + late pieces as one delta at FINISH | once at round end for every recipe |
| **Persistence** | as today (`persistProgress` fires on the CONFIRM_BAKE inventory change) | as today + one extra write at FINISH for post-bake recipes | the consumption write moves after CUT for 24 recipes |
| **Reload** | mid-CUT reload: stock already spent; round lost (as today) | same as today for normal recipes; mid-FINISH reload: base spent, late items not spent (nothing placed was kept anyway) | mid-CUT reload **refunds the whole pizza's stock** — new exploit (bake → reload → ingredients back) |
| **Abandon (HOME)** | as today (no confirm during POST_BAKE in FREE; stock spent; no Dex) | as today; FINISH inherits the POST_BAKE "no confirm" gap unless CS-2 extends `isRoundInProgress` (design note, not a CS-1 change) | leaving during CUT refunds stock with **no confirm dialog** in FREE — the refund exploit needs no reload |
| **Dinner** | unchanged | unchanged for current targets; late recipes still unidentifiable at Stage A (START_BAKE) → OD-CS-5 | `preConsumptionInventory` capture and the Stage B resolve point move; DM-3R-2 / DM-4 invariants must be re-proved |
| **Lunch Rush** | unchanged | unchanged (serve reads RESULT values, which are final); late recipes in the pool = OD-CS-6 | serve values unchanged; stock consumption moves after CUT (mission shortage checks see stock later) |
| **Bake failure (#275)** | compatible (verdict at CONFIRM_BAKE) | compatible: the provisional Completion Gate still yields the bake verdict at CONFIRM_BAKE; FINISH skip = OD-CS-7 | **conflicts**: #275's single verdict point would need a separate provisional bake check |
| **CUT** | unchanged (separate `cutScore`, evaluated at the CUT confirm) | unchanged; CUT follows FINISH (Cooking Steps 1.0 §1.1); a late piece is cut like any other | unchanged evaluation; but #288 CUT-S4 (CUT into the total) would naturally sit at this finalize point — a coupling, not a decision |
| **Post-bake steps** | a post-bake step cannot change the result → FINISH is meaningless | only profiles with a post-bake requirement get the second finalize; CUT-only profiles unchanged | every post-bake step sits before finalization; the general model for any future post-bake step |
| **Existing 25 recipes** | byte-identical | byte-identical by construction | behaviour change (timing of consume / save; refund on reload / HOME) |

Summary: **A** blocks late addition; **C** changes shipped behaviour and opens a stock refund
exploit through reload or HOME during CUT; **B** is the only option that is byte-identical for all
shipped recipes and still makes late addition work. **Recommendation (advice only): B.**

---

## 5. OD-CS-9 (a) — `tabs ≤ 6` invariant for current production

**Measured on `86b48fd`** (tabs = `preBakeSteps` + 焼く + `postBakeSteps` from `getCookingProfile`):

| Tabs | Recipes |
|---:|---|
| **6** (18) | margherita, genovese, bismarck, funghi, salsiccia, pepperoni, napoletana, tonno-e-cipolla, breakfast-pizza, capricciosa, meat-lovers, melanzane-pizza, parmigiana-pizza, bambino, hawaiian, pizza-portuguesa, pesto-caprese, pesto-patate |
| 5 (7) | marinara, fugazza, pizza-bianca, pesto-tonno, puttanesca-pizza, quattro-formaggi, new-haven-apizza (no CUT) |
| Free Cooking | D·S·C·T·焼く = 5 (no CUT) |
| Dinner | pre-bake steps + the identified recipe's post-bake steps → max 6 today |

Max = 6. Nothing exceeds it today.

**Future candidates for 7+** (estimates from the 172 matrix; new-ingredient categories assumed):

| Candidate | Why | Est. tabs |
|---|---|---:|
| wasabi-beef | post-bake wasabi + thin dough → CUT | 7 |
| buffalo-chicken, hot-honey-pepperoni, teriyaki | post-bake spread (FINISH drizzle) + CUT | 7 |
| burrata / crudaiola / pesto-burrata | only if the oil layer becomes a FINISH drizzle | 7 |
| mentaiko-cream | mid-bake in-oven step + CUT | 7 |
| yakiniku | PREP step + CUT | 7 |
| calzone | FOLD + SEAL (no CUT) | 7 |
| BBQ チキン | FINISH, no CUT (no dough evidence, OD-W2-4) | 6 |
| black-truffle | no sauce + FINISH + CUT | 5 |

**Impact of fixing it as a test-only invariant** (a unit test over every `RECIPES` id plus the
Free Cooking profile, in `src/data/cookingProfiles.test.ts`):

- Production: none (test only). No UI, save or data change.
- It turns the I5b-4 finding (≤6 OK at 360 px, 7 tight, 8 impossible) into a machine-checked rule;
  today it lives only in E2E and in unmerged reports.
- It deliberately **fails** the first recipe PR that would need 7 tabs, forcing CS-4 (T2 / T3 tab
  strip) first. Wasabi-beef, drizzle recipes, prep, mid-bake and calzone are all blocked by it
  until then — intended.
- It must not be weakened to pass; raising the ceiling is an Owner decision tied to CS-4
  (OD-CS-9 b).

**Recommendation (not a decision): yes, fix ≤6 as a test-only invariant in CS-1.**

---

## 6. PR #275 dependency

| Question | Answer |
|---|---|
| State | **OPEN** (not merged, not closed, not superseded; no newer PR for #256). Waiting on Owner Human Verification per its own §15. |
| Same code as CS-1? | **Yes.** #275 changes `const postBake = …` in CONFIRM_BAKE to skip post-BAKE steps on a bake failure, adds `bakeCompletionFailure()` in `completionGate.ts`, and changes `dinnerResolve` / `dinnerGuardedReducer`. CS-1 (c) extracts exactly that CONFIRM_BAKE block into `finalizeRound()`. CS-1 (b) does **not** overlap (#275 does not touch `GameScreen.tsx`). |
| Textual conflict today? | #275 merges cleanly onto `86b48fd` (trial merge, discarded). |
| Merge-order conflict? | **Yes, if both are in flight.** CS-1 first → #275 rebases onto a moved block (textual conflict in `gameReducer.ts`) and CS-1's golden must be re-pinned (failed-bake CUT recipes change from POST_BAKE to RESULT). #275 first → CS-1 pins the post-#275 behaviour once. |
| Semantic coupling | The golden is the behaviour contract. Pinning it before #275 lands would pin behaviour #275 is about to change. |

### 6.1 Semantic dependency (not a text-merge question)

The trial merge is clean, but the two changes act on the **same meaning**: "what CONFIRM_BAKE
decides and which post-BAKE path follows". #275 changes that decision (bake failure → no post-BAKE
steps, and a Dinner CUT waiver). CS-1b moves the decision into `finalizeRound()` and freezes it
with a golden.

| Sequencing | What happens | Cost / risk |
|---|---|---|
| **CS-1 before #275** | CS-1b pins the pre-#275 behaviour (failed bake → CUT). #275 must then be rebased onto the moved block (textual conflict in `gameReducer.ts`), re-apply its skip inside `finalizeRound`, rewrite the Dinner waiver path, and **change CS-1's golden** (every failed-bake CUT row flips POST_BAKE → RESULT). | #275 is waiting on Owner HV; forcing a rebase can invalidate its verified head and its 10,452-case D-P invariant evidence. The golden is edited right after it lands. **Not recommended.** |
| **CS-1 after #275 merges** | CS-1b extracts the post-#275 block as-is (skip + waiver included) and pins it once. | Only waiting time. **Recommended** for CS-1b. |
| **CS-1 re-designed to absorb #275's content** | CS-1b would re-implement the skip / waiver itself. | Duplicates an open PR's scope (#256), bypasses its Owner HV, and changes behaviour inside a slice meant to be byte-identical. **Forbidden by this task's scope (PR #275 unchanged) and not recommended.** |
| **If #275 is closed without merge** | CS-1b pins today's behaviour; #256 stays open with its own future PR. | Fine; re-check #256's direction first. |

CS-1a (tab invariant + GameScreen seam) has **no** semantic overlap with #275 (#275 does not
touch `GameScreen.tsx` or `cookingProfiles`) and can proceed on its own decisions.

## 7. CS-1 scope — Fresh Check

| Item | Still valid? | Note |
|---|---|---|
| (a) `tabs ≤ 6` invariant test | ✅ | Include the Free Cooking profile; Dinner is covered because its post-bake steps come from the same profiles. Depends on OD-CS-9 (a). |
| (b) GameScreen CUT hard-code → generic post-bake rendering | ✅ with a narrowed rule | 6 sites (not 5). Render must stay byte-identical: CUT is the only consumer; a non-CUT post-bake step must render nothing new in CS-1 (no FINISH UI). `nextReady` (`:515`) must stay CUT-gated. Independent of #275. |
| (c) CONFIRM_BAKE finalize extraction | ✅ but **after #275** | Pure extraction, same call site, identical under OD-CS-2 A/B/C. Must include #275's `bakeCompletionFailure` skip if #275 lands first. |
| (d) Current 25 recipes golden | ✅ widened | Cover FREE guided, Free Cooking (matched / original / failed), Lunch Rush and Dinner, × raw / perfect / burnt bake, and the POST_BAKE entry decision. |
| Scope change | **Split recommended:** CS-1a = (a) + (b) (no #275 dependency); CS-1b = (c) + (d) (after #275). Reason: (b) and (c) have different dependencies; splitting lets the tab invariant and GameScreen seam land without waiting on #275. Still no FINISH, no new action, no state field. |

## 8. CS-1 start gate

| Gate (design §11) | Result |
|---|---|
| G-CS-A Owner answered OD-CS-1 / OD-CS-2 / OD-CS-9 (a) | **WAIT** (not answered) |
| G-CS-B PR #275 merged or closed | **WAIT** (OPEN) |
| G-CS-C fresh `main` re-verified | PASS for `86b48fd` (re-run at start) |
| G-CS-D no forbidden authority needed | PASS (CS-1 touches none of Hint 5.0, TQ, taxonomy, W1, #275, #293) |

**CS-1 start: WAIT.** (Not forced to PASS: PR #275 is OPEN with a semantic overlap, §6.1, and
the gating Owner Decisions are unanswered.)

**Unlock conditions:**

| To start | Needs |
|---|---|
| **CS-1a** (tab invariant + generic post-bake rendering) | OD-CS-1 answered · OD-CS-9 (a) answered · OD-CS-20 (split) = yes · fresh `main` re-check (tab counts, 6 GameScreen sites, Hint 5.0 H5-3 not touching the same `GameScreen` lines) |
| **CS-1b** (`finalizeRound` extraction + 25-recipe golden) | everything for CS-1a · OD-CS-2 answered · **PR #275 merged or closed** (then re-audit CONFIRM_BAKE / Dinner guard on the new `main`) |
| **CS-1 as one PR** (if OD-CS-20 = no) | all of the above, i.e. #275 must be resolved first |

## 9. Owner Decisions needed now

| ID | Question | Recommended (advice only) | Blocks |
|---|---|---|---|
| OD-CS-1 | Late-addition ownership (§3) | A | CS-1a, CS-2 |
| OD-CS-2 | Finalize semantics (§4) | B | CS-1b (golden framing), CS-2 |
| OD-CS-9 (a) | `≤ 6` tabs as a test-only invariant (§5) | yes | CS-1a |
| (new) OD-CS-20 | Split CS-1 into CS-1a / CS-1b (§7) | yes | CS-1 plan |
| (external) | PR #275 merge / close (Owner HV) | — | CS-1b |

**STOP.** CS-1 is not started. Nothing is merged.
