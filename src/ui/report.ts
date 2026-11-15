// =============================================================================
// [F12] METERS AND DESCRIPTIONS  /  MEDIDORES E DESCRIÇÕES
// Turns an analysed half + its chord into what people see (meters) and what screen
// readers hear (a sentence). Pure: returns data and HTML strings, touches no DOM.
// Transforma uma metade analisada + o acorde no que se vê (medidores) e no que o leitor
// de tela fala (uma frase). Puro: devolve dados e HTML, não mexe no DOM.
// =============================================================================
import { isMostlyWhite, type Chord, type RegionAnalysis } from "../core/analysis";
import type { Strings } from "../i18n";

export type Level = 0 | 1 | 2;
/** dark, medium, bright, or [F14] mostly white / escuro, médio, claro, ou branco predominante */
export type BrightLevel = Level | 3;
export type Temperature = "warm" | "cold" | "neutral";

export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 0..1 -> low (0), mid (1), high (2) / baixo, médio, alto */
export const level = (v: number): Level => (v < 0.35 ? 0 : v < 0.65 ? 1 : 2);

/** [F1] [F14] brightness level, with "mostly white" as the top step / nível de brilho, com "branco" no topo */
export const brightLevel = (a: RegionAnalysis): BrightLevel => (isMostlyWhite(a) ? 3 : level(a.brightness));

/** [F3] warmth -1..1 -> warm / cold / neutral */
export const temperature = (warmth: number): Temperature =>
  warmth > 0.15 ? "warm" : warmth < -0.15 ? "cold" : "neutral";

export interface Meter {
  label: string;
  value: string;
  /** 0..1 */
  fill: number;
  /** "bar" fills from the left; "scale" places a marker on a cold↔warm scale; "pan" on a left↔right scale */
  kind: "bar" | "scale" | "pan";
}

/** One meter per rule: [F1] brightness, [F2] colour similarity, [F3] warmth. */
export function meters(t: Strings, a: RegionAnalysis, c: Chord): Meter[] {
  const q = t.quality[c.quality];
  return [
    { label: t.meters.brightness, value: `${pct(a.brightness)} · ${t.brightnessWords[brightLevel(a)]}`, fill: a.brightness, kind: "bar" },
    { label: t.meters.similarity, value: `${pct(a.similarity)} · ${t.similarityWords[level(a.similarity)]}`, fill: a.similarity, kind: "bar" },
    { label: t.meters.warmth, value: t.warmthLabel(temperature(a.warmth), q), fill: (a.warmth + 1) / 2, kind: "scale" },
  ];
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** [F4] Where a square sits between the speakers. / Onde o quadrado fica entre as caixas. */
export function panMeter(t: Strings, pan: number): Meter {
  const amount = Math.round(Math.abs(pan) * 100);
  const side = amount === 0 ? "centre" : pan < 0 ? "left" : "right";
  return { label: t.meters.pan, value: t.panLabel(side, amount), fill: (pan + 1) / 2, kind: "pan" };
}

const BAR_CLASS = { bar: "bar", scale: "bar warmth", pan: "bar pan" } as const;

export function meterHtml(m: Meter): string {
  const fill = pct(Math.min(1, Math.max(0, m.fill)));
  const style = m.kind === "bar" ? `width:${fill}` : `left:${fill}`;
  return (
    `<div class="meter"><div class="top"><span>${escape(m.label)}</span><b>${escape(m.value)}</b></div>` +
    `<div class="${BAR_CLASS[m.kind]}" aria-hidden="true"><i style="${style}"></i></div></div>`
  );
}

/** Big chord name with major/minor label, e.g. "Am menor". */
export function chordHtml(t: Strings, c: Chord): string {
  return `${escape(c.name)}<span class="q ${c.quality}">${escape(t.quality[c.quality])}</span>`;
}

/** [F12] Sentence a screen reader reads for one half. / Frase que o leitor de tela lê para uma metade. */
export function describeHalf(t: Strings, a: RegionAnalysis, c: Chord): string {
  return t.describe({
    temp: temperature(a.warmth),
    chord: c.name,
    quality: t.quality[c.quality],
    bright: brightLevel(a),
    similar: level(a.similarity),
  });
}
