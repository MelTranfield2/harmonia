import { describe, expect, it } from "vitest";
import type { Chord, RegionAnalysis } from "../core/analysis";
import { STRINGS } from "../i18n";
import { chordHtml, describeHalf, level, meterHtml, meters, temperature } from "./report";

const ocean: RegionAnalysis = { brightness: 0.53, warmth: -0.8, similarity: 0.72, hue: 220, white: 0.1 };
const cloud: RegionAnalysis = { brightness: 0.93, warmth: 0, similarity: 1, hue: null, white: 0.9 };
const c: Chord = { name: "C", quality: "major", notes: [84, 88, 91, 96], cutoff: 9000, dissonance: 0 };
const am: Chord = { name: "Am", quality: "minor", notes: [57, 60, 64], cutoff: 2600, dissonance: 0.28 };

describe("[F12] levels", () => {
  it("splits 0..1 into low / mid / high", () => {
    expect([0, 0.34, 0.35, 0.64, 0.65, 1].map(level)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it("[F3] reads warm / cold / neutral", () => {
    expect(temperature(0.5)).toBe("warm");
    expect(temperature(-0.5)).toBe("cold");
    expect(temperature(0.1)).toBe("neutral");
  });
});

describe("[F12] meters", () => {
  it("gives one meter per rule, in each language", () => {
    const en = meters(STRINGS.en, ocean, am);
    expect(en.map((m) => m.label)).toEqual([
      "Brightness → treble", "Colour similarity → harmony", "Cold ↔ warm → minor / major",
    ]);
    expect(en[0].value).toBe("53% · mid");
    expect(en[1].value).toBe("72% · harmonic");
    expect(en[2].value).toBe("cold → minor");
    expect(en[2].fill).toBeCloseTo(0.1); // -0.8 on a -1..1 scale

    const pt = meters(STRINGS.pt, ocean, am);
    expect(pt[0].value).toBe("53% · médio");
    expect(pt[2].value).toBe("frio → menor");
  });

  it("[F14] says when white predominates, in each language", () => {
    expect(meters(STRINGS.en, cloud, c)[0].value).toBe("93% · white → highest");
    expect(meters(STRINGS.pt, cloud, c)[0].value).toBe("93% · branco → mais agudo");
    expect(describeHalf(STRINGS.en, cloud, c)).toBe(
      "neutral colours, so C major. Mostly white, so the highest notes. Colours close together, so harmonic sound.",
    );
    expect(describeHalf(STRINGS.pt, cloud, c)).toBe(
      "Cores neutras, então C maior. Branco predominante, então as notas mais agudas. Cores próximas, então som harmônico.",
    );
  });

  it("draws bars and scale markers", () => {
    expect(meterHtml({ label: "a", value: "b", fill: 0.4, kind: "bar" })).toContain('style="width:40%"');
    const scale = meterHtml({ label: "a", value: "b", fill: 0.1, kind: "scale" });
    expect(scale).toContain('style="left:10%"');
    expect(scale).toContain('class="bar warmth"');
  });

  it("keeps fills between 0% and 100%", () => {
    expect(meterHtml({ label: "a", value: "b", fill: 1.7, kind: "bar" })).toContain("width:100%");
    expect(meterHtml({ label: "a", value: "b", fill: -1, kind: "bar" })).toContain("width:0%");
  });

  it("escapes text so it can't break the page", () => {
    const html = meterHtml({ label: "<script>", value: "a & b", fill: 0, kind: "bar" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b");
  });
});

describe("[F12] chord name and description", () => {
  it("shows the chord with its quality in the chosen language", () => {
    expect(chordHtml(STRINGS.en, am)).toBe('Am<span class="q minor">minor</span>');
    expect(chordHtml(STRINGS.pt, am)).toBe('Am<span class="q minor">menor</span>');
  });

  it("describes a half for screen readers", () => {
    expect(describeHalf(STRINGS.en, ocean, am)).toBe(
      "cold colours, so Am minor. Medium, so middle notes. Colours close together, so harmonic sound.",
    );
    expect(describeHalf(STRINGS.pt, ocean, am)).toBe(
      "Cores frias, então Am menor. Média, então notas médias. Cores próximas, então som harmônico.",
    );
  });
});
