// =============================================================================
// IMAGE ANALYSIS -> CHORDS  /  ANÁLISE DA IMAGEM -> ACORDES
// Pure functions (no DOM, no audio) so they are easy to test.
// Funções puras (sem DOM, sem áudio), fáceis de testar.
//
// Features in this file / Funcionalidades neste arquivo:
//   [F1] Brighter image -> more treble        / Imagem mais brilhante -> mais agudos
//   [F2] Close colours -> more harmonic       / Cores próximas -> som mais harmônico
//   [F3] Warm -> major, cold -> minor         / Cores quentes -> maior, frias -> menor
//   [F4] Image split in half (left / right)   / Imagem dividida ao meio (esquerda / direita)
//   [F5] Each half in its own octave zone     / Cada metade na sua faixa de oitavas
//   [F6] Both halves stay in one key          / As duas metades ficam no mesmo tom
// Search for a tag (e.g. "[F2]") to find every part of that feature.
// Busque uma etiqueta (ex.: "[F2]") para achar todas as partes da funcionalidade.
// =============================================================================

export type Quality = "major" | "minor";

export interface RegionAnalysis {
  /** 0..1 average luminance */
  brightness: number;
  /** -1 (all cold colours) .. +1 (all warm colours) */
  warmth: number;
  /** 0..1, 1 = colours very close to each other */
  similarity: number;
  /** dominant hue in degrees, or null if the region is almost grey */
  hue: number | null;
}

export interface Chord {
  name: string;
  quality: Quality;
  /** MIDI note numbers, low to high */
  notes: number[];
  /** lowpass cutoff in Hz: brighter image -> more treble */
  cutoff: number;
  /** 0..1, used for detune/roughness */
  dissonance: number;
}

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// -----------------------------------------------------------------------------
// Pixel basics / Básico de cada pixel
//   hue -> [F3] warm/cold and [F6] chord root   / matiz -> quente/frio e fundamental
//   chroma -> [F2] how "colourful" a pixel is   / croma -> quão colorido é o pixel
//   lum -> [F1] brightness                      / luminância -> brilho
// -----------------------------------------------------------------------------

/** RGB 0..255 -> hue (deg), chroma 0..1, luminance 0..1 */
export function pixelInfo(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const chroma = max - min;
  let hue = 0;
  if (chroma > 0) {
    if (max === R) hue = 60 * (((G - B) / chroma + 6) % 6);
    else if (max === G) hue = 60 * ((B - R) / chroma + 2);
    else hue = 60 * ((R - G) / chroma + 4);
  }
  const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return { hue, chroma, lum };
}

// [F3] Warm / cold colours  ·  Cores quentes / frias
/** Warm = reds, oranges, yellows, magentas. Cold = cyans, blues, violets. Greens sit in between. */
export function hueTemperature(hue: number): number {
  if (hue < 70 || hue >= 320) return 1; // red, orange, yellow, magenta
  if (hue >= 160 && hue < 280) return -1; // cyan, blue, indigo
  if (hue >= 70 && hue < 160) return -0.3; // greens: slightly cool
  return -0.3; // violet 280..320
}

/** Analyse the pixels between columns x0 (inclusive) and x1 (exclusive). Samples every `stride` pixels. */
export function analyzeRegion(
  data: Uint8ClampedArray, width: number, height: number, x0: number, x1: number, stride = 2,
): RegionAnalysis {
  let n = 0, lum = 0, warm = 0, cold = 0;
  let hx = 0, hy = 0, chromaSum = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 128) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const p = pixelInfo(r, g, b);
      n++;
      lum += p.lum; // [F1] add up brightness / soma o brilho
      // [F3] add up warm vs cold colour, weighted by how colourful the pixel is
      //      soma cor quente vs fria, com peso pelo quanto o pixel é colorido
      const t = hueTemperature(p.hue) * p.chroma;
      if (t > 0) warm += t; else cold -= t;
      // [F2] each pixel's hue as an arrow on the colour wheel (greys are short arrows)
      //      o matiz de cada pixel vira uma seta no círculo de cores (cinzas = setas curtas)
      const rad = (p.hue * Math.PI) / 180;
      hx += Math.cos(rad) * p.chroma;
      hy += Math.sin(rad) * p.chroma;
      chromaSum += p.chroma;
    }
  }
  if (n === 0) return { brightness: 0, warmth: 0, similarity: 1, hue: null };
  const meanChroma = chromaSum / n;
  let hue: number | null = null;
  if (meanChroma > 0.04) hue = ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360;
  // [F2] How close the colours are: 1 when every coloured pixel shares one hue, 0 when hues point
  // all around the colour wheel. Greys/whites barely count (they have almost no hue), so
  // clouds over the sea do not make the sea "clash" - only genuinely different colours do.
  // [F2] Quão próximas são as cores: 1 quando todos os pixels coloridos têm o mesmo matiz, 0 quando
  // os matizes apontam para todo o círculo de cores. Cinza/branco quase não contam, então nuvens
  // sobre o mar não deixam o mar "dissonante" - só cores realmente diferentes.
  const concentration = chromaSum > 1e-6 ? Math.hypot(hx, hy) / chromaSum : 1;
  return {
    brightness: lum / n, // [F1]
    warmth: warm + cold > 1e-6 ? (warm - cold) / (warm + cold) : 0, // [F3]
    similarity: Math.min(1, Math.max(0, (concentration - 0.3) / 0.65)), // [F2]
    hue, // [F6]
  };
}

// [F4] Image split in half  ·  Imagem dividida ao meio
/** Splits the image down the middle and analyses each half. / Divide a imagem ao meio e analisa cada metade. */
export function analyzeHalves(data: Uint8ClampedArray, width: number, height: number) {
  const mid = Math.floor(width / 2); // left half -> low zone, right half -> high zone
  return {
    left: analyzeRegion(data, width, height, 0, mid),
    right: analyzeRegion(data, width, height, mid, width),
  };
}

// [F6] Both halves in one key  ·  As duas metades no mesmo tom
// (Dó maior / Lá menor: as fundamentais nunca brigam entre si)
/**
 * Hue -> root note. Every root stays inside one key (C major / A minor), so the left and
 * right halves always blend; only mixed colours *within* a half add clashing notes.
 *   warm  -> C (red), G (orange/yellow), F (magenta/violet)
 *   cold  -> Em (cyan), Am (blue), Dm (indigo/violet)
 */
export function rootFromHue(hue: number | null, quality: Quality): number {
  const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9;
  if (hue === null) return quality === "major" ? C : A;
  if (quality === "major") {
    if (hue < 20 || hue >= 340) return C;
    if (hue < 160) return G;
    return F;
  }
  if (hue >= 160 && hue < 205) return E;
  if (hue >= 205 && hue < 255) return A;
  if (hue >= 255 && hue < 340) return D;
  return A;
}

// [F5] Octave zones  ·  Faixas de oitavas
// Esquerda = grave (oitavas 2-3), direita = aguda (oitavas 4-5).
/**
 * Each half gets its own octave zone so the two chords never sit on top of each other:
 * the left half plays low (octaves 2-3) and the right half plays high (octaves 4-5).
 * Inside its zone, a brighter half moves up an octave.
 */
export type Zone = "low" | "high";
export const ZONE_OCTAVE: Record<Zone, number> = { low: 2, high: 4 };

// -----------------------------------------------------------------------------
// Analysis -> chord  ·  Análise -> acorde   (uses / usa [F1] [F2] [F3] [F5] [F6])
// -----------------------------------------------------------------------------
export function buildChord(a: RegionAnalysis, zone: Zone = "low"): Chord {
  // [F3] warm -> major, cold -> minor / quente -> maior, frio -> menor
  const quality: Quality = a.warmth >= 0 ? "major" : "minor";
  const root = rootFromHue(a.hue, quality); // [F6]
  // [F5] start of the half's octave zone + [F1] brighter -> one octave higher
  //      início da faixa da metade + mais brilho -> uma oitava acima
  const octave = ZONE_OCTAVE[zone] + (a.brightness >= 0.5 ? 1 : 0);
  const base = 12 * (octave + 1) + root;
  // [F3] major third (4 semitones) or minor third (3) / terça maior (4 semitons) ou menor (3)
  const third = quality === "major" ? 4 : 3;
  const intervals = [0, third, 7];
  let suffix = quality === "major" ? "" : "m";
  // [F2] colours close together -> pure triad; more varied colours -> richer, then dissonant
  //      cores próximas -> tríade pura; cores variadas -> acorde mais rico, depois dissonante
  if (a.similarity < 0.7) {
    intervals.push(quality === "major" ? 11 : 10);
    suffix += "7";
  }
  if (a.similarity < 0.45) {
    intervals.push(14);
    suffix = suffix.replace("7", "9");
  }
  if (a.similarity < 0.25) {
    // minor second + tritone: clashing colours, clashing notes
    // segunda menor + trítono: cores que brigam, notas que brigam
    intervals.push(1, 6);
    suffix += " (clash)";
  }
  // [F1] very bright -> add the root an octave up for extra treble
  //      muito brilhante -> repete a fundamental uma oitava acima (mais agudo)
  if (a.brightness > 0.55) intervals.push(12);
  const notes = [...new Set(intervals)].sort((x, y) => x - y).map((i) => base + i);
  return {
    name: `${NOTE_NAMES[root]}${suffix}`,
    quality,
    notes,
    // [F1] tone colour: ~500 Hz (dark) .. ~11 kHz (bright) / timbre: escuro abafado, claro brilhante
    cutoff: Math.round(500 * 2 ** (a.brightness * 4.5)),
    dissonance: 1 - a.similarity, // [F2] -> detune in sonify.ts / desafinação em sonify.ts
  };
}
