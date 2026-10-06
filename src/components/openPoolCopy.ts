/** Discovery 3.0 IP-1: the OPEN_POOL next-action guidance. Fixed copy: it names no ingredient, family or recipe and
 *  reads nothing of the hidden pool (OD-IP1-1). The notebook is the header entry that is always there. (The 食材庫 line
 *  went with the pantry: the Cooking Tray now lists every owned ingredient.) */
export const OPEN_POOL_ACTIONS = {
  notebook: "\u{1F4D3} これまでの試作は、上の「試作ノートを見る」で見返せるよ。",
} as const;

/** #353: the sheet shown with 2+ registered Research Entries and no Research Target. Fixed copy: it names no recipe, count,
 *  ingredient or fact; the player picks one of the Dex's anonymous Research cards. */
export const CHOOSE_RESEARCH_COPY = {
  title: "\u{1F50E} 研究するピザを選ぼう",
  body: "図鑑の「研究中のピザ」から、研究するピザを選ぶと、そのピザのヒントが見られるよ。",
  button: "\u{1F50E} 研究するピザを選ぶ",
} as const;
