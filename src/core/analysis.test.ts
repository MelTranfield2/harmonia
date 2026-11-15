import { describe, expect, it } from "vitest";
import {
  analyzeHalves, analyzeRegion, buildChord, hueTemperature, isMostlyWhite, octaveLift, pixelInfo, rootFromHue,
} from "./analysis";

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

  it("plays the left half in a lower octave than the right half", () => {
    const a = analyzeRegion(image(10, 10, () => [250, 200, 150]), 10, 10, 0, 10);
    const low = buildChord(a, "low"), high = buildChord(a, "high");
    expect(Math.min(...high.notes) - Math.min(...low.notes)).toBe(24);
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

  it("treats white cloud with faint random tints as neutral and harmonic, not clashing", () => {
    // near-white pixels whose tiny tint flips between bluish and yellowish, like JPEG noise
    const cloud = analyzeRegion(
      image(10, 10, (x, y) => ((x + y) % 2 ? [250, 250, 246] : [246, 248, 252])), 10, 10, 0, 10, 1,
    );
    expect(cloud.hue).toBeNull();
    expect(cloud.warmth).toBe(0);
    expect(cloud.similarity).toBe(1);
    const chord = buildChord(cloud);
    expect(chord.notes.map((n) => n % 12)).toEqual([0, 4, 7, 0]); // plain C major, plus the bright octave
    expect(chord.name).toBe("C");
  });

  it("fades clashing in gradually as a region gets more colourful", () => {
    const mixed = (strength: number) =>
      analyzeRegion(
        image(10, 10, (x, y) => ((x + y) % 2 ? [128 + strength, 128 + strength, 128 - strength] : [128 - strength, 128 - strength, 128 + strength])),
        10, 10, 0, 10, 1,
      ).similarity;
    expect(mixed(4)).toBe(1); // nearly grey
    expect(mixed(8)).toBeLessThan(1);
    expect(mixed(8)).toBeGreaterThan(mixed(60)); // strongly coloured opposites clash most
  });
});

describe("[F14] white -> highest notes", () => {
  const solid = (rgb: number[]) => analyzeRegion(image(10, 10, () => rgb), 10, 10, 0, 10, 1);
  const WHITE = [250, 250, 248], SAND = [230, 190, 140], NAVY = [10, 20, 60];
  const top = (c: { notes: number[] }) => Math.max(...c.notes);
  const bottom = (c: { notes: number[] }) => Math.min(...c.notes);

  it("measures how much of a region is white", () => {
    expect(solid(WHITE).white).toBe(1);
    expect(solid(SAND).white).toBe(0); // bright, but coloured
    expect(solid([128, 128, 128]).white).toBe(0); // grey, but not bright
    const half = analyzeRegion(image(10, 10, () => WHITE, () => NAVY), 10, 10, 0, 10, 1);
    expect(half.white).toBeCloseTo(0.5);
  });

  it("only counts as mostly white when more than half is white", () => {
    const share = (whiteCols: number) =>
      analyzeRegion(image(10, 10, (x) => (x < whiteCols ? WHITE : NAVY)), 10, 10, 0, 10, 1);
    expect(isMostlyWhite(share(5))).toBe(false);
    expect(isMostlyWhite(share(6))).toBe(true);
  });

  it("climbs dark -> bright -> white, one octave at a time", () => {
    expect([NAVY, SAND, WHITE].map((c) => octaveLift(solid(c)))).toEqual([0, 1, 2]);
    for (const zone of ["low", "high"] as const) {
      const dark = buildChord({ ...solid(WHITE), brightness: 0.2, white: 0 }, zone);
      const bright = buildChord({ ...solid(WHITE), white: 0 }, zone);
      const white = buildChord(solid(WHITE), zone);
      expect(bottom(bright) - bottom(dark)).toBe(12);
      expect(bottom(white) - bottom(bright)).toBe(12);
    }
  });

  it("plays white above every other colour on the same side", () => {
    for (const zone of ["low", "high"] as const) {
      const white = buildChord(solid(WHITE), zone);
      for (const other of [SAND, NAVY, [20, 60, 200], [230, 120, 30], [40, 160, 60]]) {
        expect(bottom(white)).toBeGreaterThan(bottom(buildChord(solid(other), zone)));
      }
    }
  });

  it("puts white in octave 4 on the left and octave 6 on the right, as plain C major", () => {
    expect(buildChord(solid(WHITE), "low").notes).toEqual([60, 64, 67, 72]); // C4 E4 G4 C5
    expect(buildChord(solid(WHITE), "high").notes).toEqual([84, 88, 91, 96]); // C6 E6 G6 C7
  });

  it("[F5] still keeps a white left side no higher than a white right side", () => {
    expect(top(buildChord(solid(WHITE), "low"))).toBeLessThan(bottom(buildChord(solid(WHITE), "high")));
  });

  it("never plays above the top of the piano (C8), even for the richest chord", () => {
    for (const hue of [null, 0, 40, 180, 220, 280, 330]) {
      for (const warmth of [1, -1]) {
        const a = { brightness: 0.95, warmth, similarity: 0, hue, white: 0.9 };
        expect(top(buildChord(a, "high"))).toBeLessThanOrEqual(108);
      }
    }
  });
});
