// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPiano, HIGHEST, LOWEST, noteName, pulseKey, showChords } from "./piano";

const key = (svg: SVGSVGElement, midi: number) => svg.querySelector<SVGGElement>(`.key[data-midi="${midi}"]`)!;

describe("[F8] note names", () => {
  it("names notes with their octave", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(57)).toBe("A3");
    expect(noteName(LOWEST)).toBe("C2");
    expect(noteName(HIGHEST)).toBe("C7");
  });
});

describe("[F8] piano", () => {
  let svg: SVGSVGElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="p"></div>';
    svg = createPiano(document.getElementById("p")!);
  });

  it("draws every key from C2 to C7", () => {
    expect(svg.querySelectorAll(".key")).toHaveLength(HIGHEST - LOWEST + 1);
    expect(svg.querySelectorAll(".key.white")).toHaveLength(36);
    expect(svg.querySelectorAll(".key.black")).toHaveLength(25);
  });

  it("labels every C so octaves are easy to count", () => {
    const labels = [...svg.querySelectorAll(".c-key text")].map((t) => t.textContent);
    expect(labels).toEqual(["C2", "C3", "C4", "C5", "C6", "C7"]);
  });

  it("[F5] lights the left chord and the right chord in different colours", () => {
    showChords(svg, [57, 60, 64], [67, 71, 74], "label");
    expect(key(svg, 57).classList.contains("on-left")).toBe(true);
    expect(key(svg, 71).classList.contains("on-right")).toBe(true);
    expect(key(svg, 62).classList.contains("on-left")).toBe(false);
    expect(key(svg, 57).querySelector("text")!.textContent).toBe("A3");
    expect(svg.getAttribute("aria-label")).toBe("label");
  });

  it("marks a note shared by both chords", () => {
    showChords(svg, [60, 64], [64, 67], "");
    expect(key(svg, 64).classList.contains("on-both")).toBe(true);
    expect(key(svg, 64).classList.contains("on-left")).toBe(false);
  });

  it("clears the old chord when a new one is shown", () => {
    showChords(svg, [57], [71], "");
    showChords(svg, [48], [72], "");
    expect(key(svg, 57).classList.contains("on-left")).toBe(false);
    expect(key(svg, 57).querySelector("text")!.textContent).toBe("");
    expect(key(svg, 48).querySelector("text")!.textContent).toBe("C3");
  });

  it("[F7] flashes a key while it plays", () => {
    vi.useFakeTimers();
    pulseKey(svg, 60);
    expect(key(svg, 60).classList.contains("hit")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(key(svg, 60).classList.contains("hit")).toBe(false);
    vi.useRealTimers();
  });
});
