import { describe, expect, it } from "vitest";
import { analyzeHalves, analyzeRegion, buildChord, hueTemperature, pixelInfo, rootFromHue } from "./analysis";

/** Builds RGBA pixels: left half one colour, right half another. */
function image(w: number, h: number, left: (x: number, y: number) => number[], right = left) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = x < w / 2 ? left(x, y) : right(x, y);
      d.set([r, g, b, 255], (y * w + x) * 4);
    }
  return d;
}

describe("colour basics", () => {
  it("reads hue and brightness", () => {
    expect(pixelInfo(255, 0, 0).hue).toBe(0);
    expect(pixelInfo(0, 0, 255).hue).toBe(240);
    expect(pixelInfo(255, 255, 255).lum).toBeCloseTo(1);
  });
  it("classifies warm and cold hues", () => {
    expect(hueTemperature(30)).toBe(1); // orange
    expect(hueTemperature(220)).toBe(-1); // blue
  });
});

describe("mapping rules", () => {
  it("warm colours -> major, cold colours -> minor", () => {
    const d = image(20, 10, () => [20, 60, 200], () => [230, 120, 30]);
    const { left, right } = analyzeHalves(d, 20, 10);
    expect(buildChord(left).quality).toBe("minor");
    expect(buildChord(right).quality).toBe("major");
  });

  it("keeps both halves in the same key (C major / A minor)", () => {
    const inKey = [0, 2, 4, 5, 7, 9, 11];
    for (let hue = 0; hue < 360; hue += 15)
      for (const q of ["major", "minor"] as const) expect(inKey).toContain(rootFromHue(hue, q));
  });

  it("brighter image -> higher notes and more treble", () => {
    const dark = analyzeRegion(image(10, 10, () => [40, 20, 10]), 10, 10, 0, 10);
    const bright = analyzeRegion(image(10, 10, () => [250, 200, 150]), 10, 10, 0, 10);
    const a = buildChord(dark), b = buildChord(bright);
    expect(Math.max(...b.notes)).toBeGreaterThan(Math.max(...a.notes));
    expect(b.cutoff).toBeGreaterThan(a.cutoff);
  });

  it("close colours -> plain triad; varied colours -> extra and clashing notes", () => {
    const flat = analyzeRegion(image(10, 10, () => [200, 100, 50]), 10, 10, 0, 10, 1);
    const noisy = analyzeRegion(
      image(10, 10, (x, y) => ((x + y) % 2 ? [255, 255, 0] : [0, 0, 255])), 10, 10, 0, 10, 1,
    );
    expect(flat.similarity).toBeCloseTo(1);
    expect(noisy.similarity).toBeLessThan(0.25);
    expect(buildChord(flat).notes).toHaveLength(3);
    expect(buildChord(noisy).notes.length).toBeGreaterThan(5);
    expect(buildChord(noisy).dissonance).toBeGreaterThan(buildChord(flat).dissonance);
  });
});
