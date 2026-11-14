// Image patterns -> sound patterns. Pure functions (no DOM, no audio) so they are easy to test.
//
// Mapping rules (from the team's sketch):
//   brighter image            -> more treble (higher register, brighter filter)
//   colours close together    -> more harmonic (plain triad); varied colours -> extra/dissonant notes
//   warm colours              -> major chord; cold colours -> minor chord
//   image split in half       -> left half plays in the left speaker, right half in the right

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
      lum += p.lum;
      const t = hueTemperature(p.hue) * p.chroma;
      if (t > 0) warm += t; else cold -= t;
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
  // How close the colours are: 1 when every coloured pixel shares one hue, 0 when hues point
  // all around the colour wheel. Greys/whites barely count (they have almost no hue), so
  // clouds over the sea do not make the sea "clash" - only genuinely different colours do.
  const concentration = chromaSum > 1e-6 ? Math.hypot(hx, hy) / chromaSum : 1;
  return {
    brightness: lum / n,
    warmth: warm + cold > 1e-6 ? (warm - cold) / (warm + cold) : 0,
    similarity: Math.min(1, Math.max(0, (concentration - 0.3) / 0.65)),
    hue,
  };
}

/** Splits the image down the middle and analyses each half. */
export function analyzeHalves(data: Uint8ClampedArray, width: number, height: number) {
  const mid = Math.floor(width / 2);
  return {
    left: analyzeRegion(data, width, height, 0, mid),
    right: analyzeRegion(data, width, height, mid, width),
  };
}

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

export function buildChord(a: RegionAnalysis): Chord {
  const quality: Quality = a.warmth >= 0 ? "major" : "minor";
  const root = rootFromHue(a.hue, quality);
  // brighter -> higher register: octave 3 (dark) .. octave 5 (bright)
  const octave = 3 + Math.min(2, Math.floor(a.brightness * 3));
  const base = 12 * (octave + 1) + root;
  const third = quality === "major" ? 4 : 3;
  const intervals = [0, third, 7];
  let suffix = quality === "major" ? "" : "m";
  // colours close together -> pure triad; more varied colours -> richer, then dissonant
  if (a.similarity < 0.7) {
    intervals.push(quality === "major" ? 11 : 10);
    suffix += "7";
  }
  if (a.similarity < 0.45) {
    intervals.push(14);
    suffix = suffix.replace("7", "9");
  }
  if (a.similarity < 0.25) {
    intervals.push(1, 6); // minor second + tritone: clashing colours, clashing notes
    suffix += " (clash)";
  }
  // very bright -> add the root an octave up for extra treble
  if (a.brightness > 0.55) intervals.push(12);
  const notes = [...new Set(intervals)].sort((x, y) => x - y).map((i) => base + i);
  return {
    name: `${NOTE_NAMES[root]}${suffix}`,
    quality,
    notes,
    cutoff: Math.round(500 * 2 ** (a.brightness * 4.5)), // ~500 Hz (dark) .. ~11 kHz (bright)
    dissonance: 1 - a.similarity,
  };
}
