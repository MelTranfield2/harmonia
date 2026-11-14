// Turns GIBS colours back into scientific values using the layer's colormap XML.
// Each <ColorMapEntry rgb="r,g,b" value="[lo,hi)"> says which colour stands for
// which value range. We map every colour to the middle of its range.

export interface Colormap {
  /** rgb key -> value (NaN for "no data" / classification colours) */
  exact: Map<number, number>;
  /** entries that carry a real value, for nearest-colour fallback */
  valued: { r: number; g: number; b: number; value: number }[];
  units: string;
}

const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m?.[1];
}

/** "[220,221)" -> 220.5, "[-INF,220)" -> 220, "[100]" -> 100 */
export function parseRange(range: string): number {
  const nums = range.replace(/[[\]()\s]/g, "").split(",");
  const parsed = nums.map((n) => (/INF/i.test(n) ? NaN : Number(n)));
  if (parsed.length === 1) return parsed[0];
  const [lo, hi] = parsed;
  if (Number.isNaN(lo)) return hi;
  if (Number.isNaN(hi)) return lo;
  return (lo + hi) / 2;
}

export function parseColormap(xml: string): Colormap {
  const exact = new Map<number, number>();
  const valued: Colormap["valued"] = [];
  let units = "";
  const unitMatch = xml.match(/<ColorMap[^>]*units="([^"]*)"/);
  if (unitMatch) units = unitMatch[1];

  for (const tag of xml.match(/<ColorMapEntry\b[^>]*>/g) ?? []) {
    const rgb = attr(tag, "rgb");
    if (!rgb) continue;
    const [r, g, b] = rgb.split(",").map(Number);
    const valueAttr = attr(tag, "value");
    const nodata = attr(tag, "nodata") === "true";
    if (!valueAttr || nodata) {
      if (!exact.has(key(r, g, b))) exact.set(key(r, g, b), NaN);
      continue;
    }
    const value = parseRange(valueAttr);
    exact.set(key(r, g, b), value);
    valued.push({ r, g, b, value });
  }
  return { exact, valued, units };
}

/**
 * Gives a value to classification colours, e.g. the satellite "pole hole", which
 * NSIDC treats as ice-covered when computing sea ice extent. Keys are "r,g,b".
 */
export function withOverrides(cmap: Colormap, overrides?: Record<string, number>): Colormap {
  if (!overrides) return cmap;
  const exact = new Map(cmap.exact);
  for (const [rgb, value] of Object.entries(overrides)) {
    const [r, g, b] = rgb.split(",").map(Number);
    exact.set(key(r, g, b), value);
  }
  return { ...cmap, exact };
}

/** Max squared RGB distance accepted for a nearest-colour match (rejects coastline/antialias pixels). */
const MAX_DIST2 = 3 * 14 * 14;

/** Decodes RGBA pixels into a value per pixel (NaN = no data / transparent). */
export function decodePixels(
  data: Uint8ClampedArray,
  cmap: Colormap,
  transform: (v: number) => number = (v) => v,
): Float32Array {
  const out = new Float32Array(data.length / 4);
  const cache = new Map<number, number>();
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) {
      out[i] = NaN;
      continue;
    }
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const k = key(r, g, b);
    let v = cmap.exact.get(k);
    if (v === undefined) v = cache.get(k);
    if (v === undefined) {
      let best = NaN;
      let bestD = MAX_DIST2;
      for (const e of cmap.valued) {
        const d = (e.r - r) ** 2 + (e.g - g) ** 2 + (e.b - b) ** 2;
        if (d <= bestD) {
          bestD = d;
          best = e.value;
        }
      }
      cache.set(k, best);
      v = best;
    }
    out[i] = Number.isNaN(v) ? NaN : transform(v);
  }
  return out;
}
