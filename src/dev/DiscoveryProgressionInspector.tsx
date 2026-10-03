import { useMemo, useState } from "react";
import {
  buildInspectorModel,
  HINT_CLASSIFICATION_LABEL,
  stepMatchesFilter,
  stepMatchesQuery,
  type InspectorFilter,
  type InspectorIngredient,
  type InspectorModel,
  type InspectorPoolMember,
  type InspectorStep,
} from "./discoveryProgressionModel";
import "./discoveryProgressionInspector.css";

/**
 * Discovery Progression Inspector: a DEV / Preview only, READ-ONLY screen. Not a player feature.
 * Reached only through `?inspector=discovery` (src/main.tsx), which exists only in DEV and Preview
 * builds; a production build contains none of this (src/dev/inspectorAccess.gate.test.ts).
 *
 * It renders `buildInspectorModel()` (./discoveryProgressionModel.ts), which calls the production
 * progression / discovery / hint-target authorities. This file holds no game state: only a filter,
 * a search text and which rows are open. It never touches the save.
 */

/** Present in this chunk only. The production-bundle gate looks for it. */
export const INSPECTOR_MARK = "discovery-progression-inspector-v1";

const FILTERS: readonly { id: InspectorFilter; label: string }[] = [
  { id: "all", label: "全step" },
  { id: "multi", label: "複数recipe同時解禁" },
  { id: "open-pool", label: "OPEN_POOL関連" },
];

const names = (list: readonly InspectorIngredient[]) => list.map((i) => i.nameJa).join("・");

function PoolList({ members }: { members: readonly InspectorPoolMember[] }) {
  if (members.length === 0) return <span className="dpi__muted">なし</span>;
  return (
    <ul className="dpi__chips">
      {members.map((m) => (
        <li key={m.recipeId} className={m.carriedOver ? "dpi__chip" : "dpi__chip dpi__chip--new"}>
          {m.nameJa} <code>{m.recipeId}</code>
          {m.carriedOver ? " ↩前から" : " 🆕"}
        </li>
      ))}
    </ul>
  );
}

function ClueView({ step }: { step: InspectorStep }) {
  return (
    <section className="dpi__clue">
      <h4>🆕 材料 → Newly Discoverable（recipe推理の手掛かり）</h4>
      {step.unlocked.map((ing) => {
        const into = step.newlyDiscoverable.filter((r) => r.requirements.some((q) => q.id === ing.id));
        const inPool = step.afterPool.filter((m) => m.requiredIngredientIds.includes(ing.id));
        return (
          <p key={ing.id} className="dpi__small" data-testid={`dpi-clue-${ing.id}`}>
            🆕 {ing.nameJa} → {into.length > 0 ? into.map((r) => r.nameJa).join(" / ") : "（このstepの新規recipeなし）"}。After pool {step.afterPool.length}件のうち、{ing.nameJa}を使うのは{" "}
            <b>{inPool.length}</b>件
            {inPool.length === step.afterPool.length && step.afterPool.length > 1 ? "（全員が使う＝手掛かりにならない）" : ""}。
          </p>
        );
      })}
    </section>
  );
}

function StepDetail({ step }: { step: InspectorStep }) {
  return (
    <div className="dpi__detail" data-testid={`dpi-detail-${step.step}`}>
      <dl className="dpi__kv">
        <dt>step</dt>
        <dd>
          {step.step}（ladder count {step.ladderCount}）
        </dd>
        <dt>解禁材料</dt>
        <dd>
          {step.unlocked.map((i) => (
            <span key={i.id} className="dpi__new-ing">
              🆕 {i.nameJa} <code>{i.id}</code>
            </span>
          ))}
        </dd>
        <dt>Before owned ({step.beforeOwned.length})</dt>
        <dd className="dpi__small">{names(step.beforeOwned) || "（解禁材料なし。スターターのみ）"}</dd>
        <dt>After owned ({step.afterOwned.length})</dt>
        <dd className="dpi__small">{names(step.afterOwned)}</dd>
        <dt>Before pool</dt>
        <dd>
          <b>{step.beforePool.length}</b> <PoolList members={step.beforePool} />
        </dd>
        <dt>After pool</dt>
        <dd>
          <b>{step.afterPool.length}</b> <PoolList members={step.afterPool} />
        </dd>
        <dt>Newly discoverable</dt>
        <dd>
          <b data-testid={`dpi-newly-count-${step.step}`}>{step.newlyDiscoverable.length}</b>
        </dd>
        <dt>Hint target</dt>
        <dd>
          <code>{step.hintTargetKind}</code>
          {step.maintainableTargetIds.length > 0 && <span className="dpi__small"> / 維持できるtarget: {step.maintainableTargetIds.join(", ")}</span>}
        </dd>
      </dl>

      {step.newlyDiscoverable.map((r) => (
        <section key={r.recipeId} className="dpi__recipe" data-testid={`dpi-recipe-${r.recipeId}`}>
          <h4>
            Ch.{r.chapter} No.{String(r.no).padStart(2, "0")} {r.nameJa} <code>{r.recipeId}</code>
          </h4>
          <p className="dpi__small">
            ladderCredit: <b className={r.ladderCredit ? "" : "dpi__warn"}>{String(r.ladderCredit)}</b>
            {!r.ladderCredit && "（発見してもladderは進まない）"} / lunchRush: <b>{String(r.lunchRush)}</b>
            {r.isKeyRecipeOfThisStep && " / このstepのkey recipe"}
          </p>
          <ul className="dpi__req">
            {r.requirements.map((q) => (
              <li key={q.id} className={q.usableBefore ? "" : "dpi__req--missing"}>
                {q.isNewThisStep ? "🆕 " : ""}
                {q.nameJa} <code>{q.id}</code> ×{q.minCount}
                {q.starter ? " (starter)" : q.usableBefore ? " (beforeで所持)" : " (beforeで不足)"}
              </li>
            ))}
          </ul>
          <p className="dpi__small">
            Before不足: <b>{names(r.missingBefore) || "なし"}</b>
            <br />
            After: 必要材料がすべて使用可能 → <code>DISCOVERABLE</code>（不足していた{names(r.missingBefore)}がこのstepで解禁）
          </p>
        </section>
      ))}
      {step.newlyDiscoverable.length === 0 && <p className="dpi__muted">このstepで新しくDISCOVERABLEになるrecipeはありません。</p>}
      <ClueView step={step} />
    </div>
  );
}

function StepRow({ step, open, onToggle }: { step: InspectorStep; open: boolean; onToggle: () => void }) {
  const cls = step.classification;
  return (
    <li className="dpi__row" data-testid={`dpi-row-${step.step}`} data-classification={cls}>
      <button type="button" className="dpi__summary" aria-expanded={open} onClick={onToggle}>
        <span className="dpi__cell dpi__cell--step" data-label="Step">
          {step.step}
        </span>
        <span className="dpi__cell dpi__cell--unlock" data-label="Unlock">
          {step.unlocked.map((i) => (
            <span key={i.id} className="dpi__new-ing">
              🆕 {i.nameJa}
            </span>
          ))}
        </span>
        <span className="dpi__cell dpi__cell--newly" data-label="Newly Discoverable">
          {step.newlyDiscoverable.length === 0 ? (
            <span className="dpi__muted">—</span>
          ) : (
            step.newlyDiscoverable.map((r) => (
              <span key={r.recipeId} className="dpi__recipe-name">
                {r.nameJa}
                {!r.ladderCredit && <span className="dpi__badge dpi__badge--warn">credit:false</span>}
              </span>
            ))
          )}
        </span>
        <span className="dpi__cell dpi__cell--pool" data-label="Pool">
          Pool {step.afterPool.length}
        </span>
        <span className={`dpi__cell dpi__cell--result dpi__result--${cls}`} data-label="Result">
          {HINT_CLASSIFICATION_LABEL[cls]}
        </span>
      </button>
      {open && <StepDetail step={step} />}
    </li>
  );
}

function Summary({ model }: { model: InspectorModel }) {
  return (
    <section className="dpi__summary-box" aria-label="summary">
      <p>
        recipes <b data-testid="dpi-recipe-count">{model.recipeCount}</b> / ingredients <b data-testid="dpi-ingredient-count">{model.ingredientCount}</b> / ladder{" "}
        <code>{model.populationId}</code> <b data-testid="dpi-step-count">{model.stepCount}</b> steps
      </p>
      <p>
        複数recipe同時解禁: <b data-testid="dpi-multi-count">{model.multiRecipeStepNumbers.length}</b> step（{model.multiRecipeStepNumbers.join(", ") || "なし"}）
      </p>
      <p>
        OPEN_POOL: step <b data-testid="dpi-open-pool">{model.openPoolStepNumbers.join(", ") || "なし"}</b> / OPEN_POOL POSSIBLE: step{" "}
        <b data-testid="dpi-open-pool-possible">{model.openPoolPossibleStepNumbers.join(", ") || "なし"}</b>
      </p>
      {model.nonCreditRecipes.map((r) => (
        <p key={r.recipeId} data-testid={`dpi-noncredit-${r.recipeId}`}>
          ladderCredit:false <b>{r.nameJa}</b> <code>{r.recipeId}</code>: step {r.firstDiscoverableStep ?? "—"} からpoolに入り、未発見の間 step {r.poolSteps.join(", ")} のpoolに残る。発見してもladder
          countは進まず、step1–{model.stepCount}の解禁はこのrecipeに依存しない。lunchRush: {String(r.lunchRush)}
        </p>
      ))}
      <p className="dpi__small">
        Hint targetは production の <code>selectHintTarget</code> の結果。NORMAL = pool=1で自動target。OPEN_POOL = pool≥2で、前stepから残るrecipeが無い（維持できるtargetが無い）。OPEN_POOL
        POSSIBLE = pool≥2だが前から残るrecipeがあり、購入済み(sticky) targetがあればそれが維持される。
      </p>
    </section>
  );
}

export function DiscoveryProgressionInspector() {
  const model = useMemo(() => buildInspectorModel(), []);
  const [filter, setFilter] = useState<InspectorFilter>("all");
  const [query, setQuery] = useState("");
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(new Set());
  const visible = model.steps.filter((s) => stepMatchesFilter(s, filter) && stepMatchesQuery(s, query));
  const toggle = (n: number) =>
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <main className="dpi" data-inspector={INSPECTOR_MARK}>
      <header className="dpi__header">
        <h1>Discovery Progression Inspector</h1>
        <p className="dpi__small">DEV / Preview 専用・read-only（saveには触れません）</p>
      </header>
      <Summary model={model} />
      <div className="dpi__controls">
        <div className="dpi__filters" role="group" aria-label="filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="dpi__filter" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <input className="dpi__search" type="search" placeholder="材料 / recipe の id・名前" aria-label="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p className="dpi__small" data-testid="dpi-visible-count">
        {visible.length} / {model.steps.length} step
      </p>
      <ol className="dpi__list">
        <li className="dpi__row dpi__row--head" aria-hidden="true">
          <span className="dpi__summary">
            <span className="dpi__cell dpi__cell--step">Step</span>
            <span className="dpi__cell dpi__cell--unlock">Unlock</span>
            <span className="dpi__cell dpi__cell--newly">Newly Discoverable</span>
            <span className="dpi__cell dpi__cell--pool">Pool</span>
            <span className="dpi__cell dpi__cell--result">Result</span>
          </span>
        </li>
        {visible.map((s) => (
          <StepRow key={s.step} step={s} open={openSteps.has(s.step)} onToggle={() => toggle(s.step)} />
        ))}
      </ol>
    </main>
  );
}
