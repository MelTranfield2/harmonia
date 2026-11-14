// Pure maths on a decoded image: no DOM, no audio. Easy to unit-test.
import type { BBox, Projection } from "./gibs";

export interface Grid {
  width: number;
  height: number;
  /** one value per pixel, row-major, NaN = no data */
  values: Float32Array;
}

export type Metric =
  /** area-weighted average of every valid pixel (e.g. temperature) */
  | { kind: "mean" }
  /** area covered by pixels >= threshold (e.g. sea ice extent, >= 15 % concentration) */
  | { kind: "extent"; threshold: number };

export interface Column {
  /** aggregated value of the column, or null when the column has no data (silence) */
  value: number | null;
  /** 0..1, share of the column with valid data (used as loudness) */
  coverage: number;
}

/**
 * Pixel weights per row. On a lat/lon grid, pixels near the poles cover much less
 * area than at the equator, so each row is weighted by cos(latitude).
 */
export function rowWeights(projection: Projection, bbox: BBox, height: number): Float32Array {
  const w = new Float32Array(height).fill(1);
  if (projection !== "4326") return w;
  const step = (bbox.north - bbox.south) / height;
  for (let r = 0; r < height; r++) {
    const lat = bbox.north - (r + 0.5) * step;
    w[r] = Math.max(0, Math.cos((lat * Math.PI) / 180));
  }
  return w;
}

/** Area of one pixel in km² (only meaningful for equal-ish area projections such as 3413). */
export function pixelAreaKm2(bbox: BBox, width: number, height: number): number {
  return (((bbox.east - bbox.west) / width) * (bbox.north - bbox.south)) / height / 1e6;
}

/** One number per frame: the global/regional summary that the drone follows. */
export function frameMetric(grid: Grid, weights: Float32Array, metric: Metric, pixelKm2 = 0): number {
  const { width, height, values } = grid;
  if (metric.kind === "extent") {
    let count = 0;
    for (let i = 0; i < values.length; i++) if (values[i] >= metric.threshold) count++;
    return (count * pixelKm2) / 1e6; // million km²
  }
  let sum = 0;
  let wsum = 0;
  for (let r = 0; r < height; r++) {
    const w = weights[r];
    for (let c = 0; c < width; c++) {
      const v = values[r * width + c];
      if (!Number.isNaN(v)) {
        sum += v * w;
        wsum += w;
      }
    }
  }
  return wsum > 0 ? sum / wsum : NaN;
}

/** Splits the image into `steps` vertical slices: the needle plays one slice per beat. */
export function columns(grid: Grid, weights: Float32Array, steps: number, metric: Metric): Column[] {
  const { width, height, values } = grid;
  const out: Column[] = [];
  for (let s = 0; s < steps; s++) {
    const x0 = Math.floor((s * width) / steps);
    const x1 = Math.floor(((s + 1) * width) / steps);
    let sum = 0, wsum = 0, valid = 0, hits = 0, total = 0;
    for (let r = 0; r < height; r++) {
      const w = weights[r];
      for (let c = x0; c < x1; c++) {
        total++;
        const v = values[r * width + c];
        if (Number.isNaN(v)) continue;
        valid++;
        sum += v * w;
        wsum += w;
        if (metric.kind === "extent" && v >= metric.threshold) hits++;
      }
    }
    const coverage = total ? valid / total : 0;
    if (metric.kind === "extent") {
      const frac = total ? hits / total : 0;
      out.push({ value: hits > 0 ? frac : null, coverage: Math.min(1, frac * 4) });
    } else {
      out.push({ value: wsum > 0 ? sum / wsum : null, coverage });
    }
  }
  return out;
}

/** Average of valid pixels in a small square around (x, y). */
export function valueAt(grid: Grid, x: number, y: number, radius = 2): number | null {
  let sum = 0, n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const cx = Math.round(x) + dx, cy = Math.round(y) + dy;
      if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) continue;
      const v = grid.values[cy * grid.width + cx];
      if (!Number.isNaN(v)) {
        sum += v;
        n++;
      }
    }
  }
  return n ? sum / n : null;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const normalize = (v: number, [lo, hi]: [number, number]) => clamp01((v - lo) / (hi - lo));

/** Pixel -> latitude/longitude, for narrating where the explorer cursor is. */
export function pixelToLatLon(
  projection: Projection, bbox: BBox, width: number, height: number, px: number, py: number,
): { lat: number; lon: number } {
  const x = bbox.west + ((px + 0.5) / width) * (bbox.east - bbox.west);
  const y = bbox.north - ((py + 0.5) / height) * (bbox.north - bbox.south);
  if (projection === "4326") return { lat: y, lon: x };
  // EPSG:3413: polar stereographic, true scale at 70°N, central meridian -45°.
  // Spherical approximation (good to well under a degree; fine for narration).
  const R = 6371008.8;
  const k = R * (1 + Math.sin((70 * Math.PI) / 180));
  const rho = Math.hypot(x, y);
  const lat = 90 - (2 * Math.atan(rho / k) * 180) / Math.PI;
  let lon = -45 + (Math.atan2(x, -y) * 180) / Math.PI;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

export function formatLatLon({ lat, lon }: { lat: number; lon: number }): string {
  const la = `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lon).toFixed(0)}°${lon >= 0 ? "E" : "W"}`;
  return `${la} ${lo}`;
}
