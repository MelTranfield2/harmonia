import { describe, expect, it } from "vitest";
import { arpeggioStep, STEPS_PER_BAR } from "./sequence";

const LEFT = [45, 48, 52]; // A2 C3 E3
const RIGHT = [67, 71, 74]; // G4 B4 D5

describe("[F7] arpeggio pattern", () => {
  it("restrikes the chords only on the first step of each bar", () => {
    const bars = Array.from({ length: STEPS_PER_BAR * 2 }, (_, i) => arpeggioStep(i, LEFT, RIGHT).newBar);
    expect(bars.filter(Boolean)).toHaveLength(2);
    expect(bars[0]).toBe(true);
    expect(bars[STEPS_PER_BAR]).toBe(true);
  });

  it("[F4] alternates left (on the beat) and right (off the beat)", () => {
    const sides = Array.from({ length: 4 }, (_, i) => arpeggioStep(i, LEFT, RIGHT).side);
    expect(sides).toEqual(["left", "right", "left", "right"]);
  });

  it("only plays notes from that side's own chord", () => {
    for (let i = 0; i < 32; i++) {
      const s = arpeggioStep(i, LEFT, RIGHT);
      expect(s.side === "left" ? LEFT : RIGHT).toContain(s.note);
    }
  });

  it("walks up the chord", () => {
    const leftNotes = [0, 2, 4].map((i) => arpeggioStep(i, LEFT, RIGHT).note);
    expect(leftNotes).toEqual([45, 48, 52]);
    const rightNotes = [1, 3, 5].map((i) => arpeggioStep(i, LEFT, RIGHT).note);
    expect(rightNotes).toEqual([71, 74, 67]); // starts one note up
  });

  it("is silent on a side with no chord", () => {
    expect(arpeggioStep(0, null, RIGHT).note).toBeNull();
    expect(arpeggioStep(1, LEFT, []).note).toBeNull();
  });

  it("repeats every bar", () => {
    for (let i = 0; i < STEPS_PER_BAR; i++) {
      expect(arpeggioStep(i + STEPS_PER_BAR * 3, LEFT, RIGHT)).toEqual(arpeggioStep(i, LEFT, RIGHT));
    }
  });
});
