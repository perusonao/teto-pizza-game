import type { DialogueLine, Speaker } from "../data/dialogue";
import tetoImg from "../assets/characters/teto.webp";
import mitoImg from "../assets/characters/mito.webp";
import blueImg from "../assets/characters/blue.webp";

const PORTRAITS: Record<Speaker, string> = {
  teto: tetoImg,
  mito: mitoImg,
  blue: blueImg,
};

const SPEAKER_LABEL: Record<Speaker, string> = {
  teto: "テト",
  mito: "ミト",
  blue: "ブルー",
};

export function DialogueBox({ speaker, textJa }: DialogueLine) {
  return (
    <div className={`dialogue-box dialogue-box--${speaker}`}>
      <img className="dialogue-box__portrait" src={PORTRAITS[speaker]} alt={SPEAKER_LABEL[speaker]} />
      <div className="dialogue-box__bubble">
        <span className="dialogue-box__name">{SPEAKER_LABEL[speaker]}</span>
        <p className="dialogue-box__text">{textJa}</p>
      </div>
    </div>
  );
}
