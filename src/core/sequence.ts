// =============================================================================
// [F7] ARPEGGIO PATTERN  /  PADRÃO DO ARPEJO
// Pure: decides which note plays on each eighth note. No audio here, so it can be tested.
// Puro: decide qual nota toca em cada colcheia. Sem áudio aqui, então dá para testar.
//
//   - 8 steps per bar; on step 0 both chords restrike   / 8 passos por compasso; no passo 0 os dois acordes tocam de novo
//   - [F4] even steps = left half, odd steps = right half / passos pares = esquerda, ímpares = direita
//   - each side walks up its own chord                   / cada lado sobe pelas notas do seu acorde
// =============================================================================

export const STEPS_PER_BAR = 8;

export type Side = "left" | "right";

export interface Step {
  /** true on the first eighth note of a bar: restrike the held chords / primeira colcheia do compasso */
  newBar: boolean;
  side: Side;
  /** MIDI note to play, or null if that side has no chord yet / nota MIDI, ou null se não houver acorde */
  note: number | null;
}

export function arpeggioStep(step: number, left: readonly number[] | null, right: readonly number[] | null): Step {
  const s = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const side: Side = s % 2 === 0 ? "left" : "right";
  const notes = side === "left" ? left : right;
  if (!notes || notes.length === 0) return { newBar: s === 0, side, note: null };
  const idx = Math.floor(s / 2) % notes.length;
  // the right side starts one note higher, so the two sides don't mirror each other
  // o lado direito começa uma nota acima, para os lados não ficarem espelhados
  const offset = side === "right" ? 1 : 0;
  return { newBar: s === 0, side, note: notes[(idx + offset) % notes.length] };
}
