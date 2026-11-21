/**
 * BUILD 04 (Doc 03 §9.1): single TS source of truth for the UI palette values
 * that canvas painters need (2D portrait/subject/thumbnail painters cannot read
 * CSS custom properties). Values mirror `index.css` `@theme` byte-for-byte;
 * the `uiTokenDiscipline` test bans re-introducing the raw literals anywhere
 * else in the UI layer so the token adoption stays adopted.
 */
export const UI_PALETTE = {
  linen: '#FAF5EC',
  linenDeep: '#F1E8D9',
  pageGround: '#E7DFCF',
  espresso: '#2D241E',
  espressoMuted: '#6A5B50',
  umber: '#5E5046',
  terracotta: '#C86446',
  terracottaDeep: '#B45539',
  sage: '#5E8062',
  honey: '#E5A93C',
  stoneLine: '#D4C4AE',
  parchment: '#E2D4C0',
  cardWarm: '#F4ECE0',
} as const;

export type UiPaletteToken = keyof typeof UI_PALETTE;
