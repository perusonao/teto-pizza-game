# Steam Gameplay V2 — five-shell rescue Pilot (#755 / PR #757)

Status: **draft implementation; automated checks and Owner Safari HV pending**. Production remains OFF. The existing V1 published at PR #756 SHA `8dfca29` is unchanged.

## Why V2

Owner's feedback after trying V1 on iPhone: **「簡単すぎる」**. V1 permits a near-perfect outcome by simply holding high fire for a memorized ~4 seconds, without making an interesting decision.

V2 changes the decision: shells open **independently**, and the player must **tap each plump/orange shell to save it** before it shrivels. High heat opens faster with a shorter rescue window; low heat is forgiving but takes longer. Tapping an unopened shell does not punish the player; a spoiled shell cannot be rescued afterward. Each rescued shell displays a ✓ and freezes its state.

## Two disclosed batches

- `clam` — **あさり・大小まざり**: five small-to-large shell sizes, staggered opening levels.
- `mussel` — **ムール貝・大粒**: shells visibly larger, different opening thresholds.

The player **chooses the batch before playing**; no hidden random values. Observe shell color and opening rather than a numeric timer or gauge.

## Play and interpretation

1. Select a batch, tap **ふたをして蒸す**.
2. Use **強火 / 弱火** according to what is opening. Tap each **orange/open** shell while its flesh looks plump.
3. Press **ふたを開ける** when finished, see 0–5 rescued and the distinct verdict.
4. **もう一度蒸す** and **やり直す** reset without writing player data.

Comparison model cases pinned by tests:

| Input | Expected |
|---|---|
| High heat, **no shell pickup**, open at ~4.2s | 0/5 rescued, some shells overcooked |
| Low heat, **no pickup**, open at ~7.5s | 0/5 rescued, some shells overcooked |
| High heat, pick each orange shell quickly at ~1.35/1.9/2.5/3.1/3.85s | 5/5 |
| High fire to 2.0s, then weak and pick each orange shell | 5/5 with a more forgiving response time |
| Same clock timing but switch batch from clam to mussel | Different shells are still closed |

Seconds are **model examples, not instructions displayed to the player**. Difficulty is provisional and must be assessed on an actual iPhone; 5/5 should be achievable by observation, not a punishing sub-0.2s reflex window.

## Scope & safety

- V1: `?steamGameLab=on` — unchanged.
- V2: `?steamGameLab=on&steamGameMode=v2` — **only in DEV/Preview builds**. `src/main.tsx` unchanged.
- No `gameReducer`, real score, recipe, scoring, Firebase, save, inventory, Dex, or Steam #738 changes.
- The new route is in the Preview-only SteamGameLab module; existing production build isolation gate must pass.
- iPhone single-screen test: 390×844 / 360×800 / 390×664, touch targets ≥44 CSS px, no horizontal/vertical scroll, no Safari accidental selection, keyboard shell action via Enter/Space, reduced-motion handling.
- V2 is stacked on Draft PR #756; #757 must **not merge before #756**, and PR #756 itself remains Draft until Owner adoption. Branch comparison to main triggers CI while V2 is independently reviewed.
- Shared Preview currently publishes exact V1 HEAD `8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`; updating it requires new explicit approval. Do not imply real-device HV success from Chromium/WebKit automation.

## Gate

Technical CI/WebKit + Codex + Owner hands-on iPhone **gameplay** are separate. V2 adoption is HOLD until the Owner compares V1 with V2 and reports whether decision-making now feels sufficiently engaging.
