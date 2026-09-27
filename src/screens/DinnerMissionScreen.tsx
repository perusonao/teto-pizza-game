import { useState } from "react";
import { DINNER_MISSIONS, getDinnerMission, type DinnerMissionDefinition } from "../mission/dinner/dinnerMission";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";
import {
  dinnerMissionCardView,
  dinnerReadiness,
  formatDinnerClock,
  type DinnerMissionCardView,
} from "../state/dinnerView";

interface DinnerMissionScreenProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  /** The START duration for a mission, or `null` while no time limit exists (OD-DM3-1). */
  durationFor: (mission: DinnerMissionDefinition) => number | null;
  onStart: (missionId: string, durationMs: number) => void;
  onBack: () => void;
  onOpenShop: () => void;
  missions?: readonly DinnerMissionDefinition[];
}

/**
 * Dinner Mission DM-3 (Issue #242): Mission Select and Mission Detail. A locked card never carries
 * a target's identity (`dinnerMissionCardView` gives it counts only), and Detail opens only for an
 * unlocked mission, so no undiscovered recipe can reach the DOM from this screen.
 */
export function DinnerMissionScreen({
  dex,
  ownedIngredientIds,
  inventory,
  durationFor,
  onStart,
  onBack,
  onOpenShop,
  missions = DINNER_MISSIONS,
}: DinnerMissionScreenProps) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const cards = missions.map((m) => dinnerMissionCardView(m, dex));
  const detailMission = detailId ? getDinnerMission(detailId) : undefined;
  const detailCard = cards.find((c) => c.missionId === detailId);

  return (
    <div className="dinner-screen">
      <header className="app-header">
        <button
          type="button"
          className="app-header__home-button"
          onClick={detailId ? () => setDetailId(null) : onBack}
        >
          {detailId ? "← もどる" : `${"\u{1F3E0}"} ホーム`}
        </button>
        <h1 className="app-header__title">{"\u{1F319}"} ディナーミッション</h1>
      </header>

      {detailMission && detailCard?.unlocked ? (
        <DinnerMissionDetail
          mission={detailMission}
          card={detailCard}
          readiness={dinnerReadiness(detailMission, { dex, ownedIngredientIds, inventory }, durationFor(detailMission))}
          onStart={onStart}
          onOpenShop={onOpenShop}
        />
      ) : (
        <div className="dinner-screen__body">
          <p className="dinner-screen__lead">指定されたピザを、時間内に全部作ろう！</p>
          <ul className="dinner-mission-list">
            {cards.map((card) => (
              <li key={card.missionId}>
                <DinnerMissionCard card={card} onOpen={() => setDetailId(card.missionId)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DinnerMissionCard({ card, onOpen }: { card: DinnerMissionCardView; onOpen: () => void }) {
  if (!card.unlocked) {
    return (
      <div className="dinner-mission-card dinner-mission-card--locked" aria-disabled="true">
        <span className="dinner-mission-card__title">
          {"\u{1F512}"} {card.titleJa}
        </span>
        <span className="dinner-mission-card__count">ピザ {card.totalTargets} 種類</span>
        <span className="dinner-mission-card__lock">あと{card.undiscoveredCount}種類のピザを発見すると解放</span>
      </div>
    );
  }
  return (
    <button type="button" className="dinner-mission-card" onClick={onOpen}>
      <span className="dinner-mission-card__title">
        {"\u{1F319}"} {card.titleJa}
      </span>
      <span className="dinner-mission-card__count">ピザ {card.totalTargets} 種類</span>
      <span className="dinner-mission-card__targets">{card.targets.map((t) => t.nameJa).join("・")}</span>
      <span className="dinner-mission-card__cta">くわしく見る {"→"}</span>
    </button>
  );
}

function DinnerMissionDetail({
  mission,
  card,
  readiness,
  onStart,
  onOpenShop,
}: {
  mission: DinnerMissionDefinition;
  card: Extract<DinnerMissionCardView, { unlocked: true }>;
  readiness: ReturnType<typeof dinnerReadiness>;
  onStart: (missionId: string, durationMs: number) => void;
  onOpenShop: () => void;
}) {
  return (
    <div className="dinner-detail">
      <div className="dinner-detail__body">
        <h2 className="dinner-detail__title">{card.titleJa}</h2>
        <p className="dinner-detail__lead">この {card.totalTargets} 種類を、好きな順番で全部作ろう！</p>
        <ul className="dinner-detail__targets">
          {card.targets.map((t) => (
            <li key={t.recipeId} className="dinner-detail__target">
              {"\u{1F355}"} {t.nameJa}
            </li>
          ))}
        </ul>
        <p className="dinner-detail__row">
          制限時間{" "}
          <strong>{readiness.kind === "READY" ? formatDinnerClock(readiness.durationMs) : "調整中"}</strong>
        </p>
        {readiness.kind === "READY" && (
          <p className="dinner-detail__ready" role="status">
            {"\u{2705}"} 材料はそろっています
          </p>
        )}
        {readiness.kind === "SHORTAGE" && (
          <div className="dinner-detail__shortage" role="alert">
            <p className="dinner-detail__shortage-title">{"\u{26A0}\u{FE0F}"} 材料が足りません</p>
            <ul className="dinner-detail__shortage-list">
              {readiness.shortages.map((s) => (
                <li key={s.ingredientId}>
                  {s.nameJa} 必要 {s.need} / 所持 {s.have}
                </li>
              ))}
            </ul>
            <button type="button" className="cta-button cta-button--secondary" onClick={onOpenShop}>
              {"\u{1F6D2}"} ショップで補充する
            </button>
          </div>
        )}
        {readiness.kind === "NO_TIME_LIMIT" && (
          <p className="dinner-detail__note" role="status">
            制限時間を調整中のため、まだ始められません
          </p>
        )}
        <p className="dinner-detail__note">
          材料を使いすぎて残りのピザが作れなくなると失敗です。始めたらショップには行けません。
        </p>
      </div>
      <div className="action-row dinner-detail__cta-bar">
        <button
          type="button"
          className="cta-button cta-button--primary"
          disabled={readiness.kind !== "READY"}
          aria-disabled={readiness.kind !== "READY"}
          onClick={() => {
            if (readiness.kind === "READY") onStart(mission.missionId, readiness.durationMs);
          }}
        >
          {"\u{1F319}"} スタート
        </button>
      </div>
    </div>
  );
}
