// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { cellElement, cellIndexOf, renderGrid, setActiveCell, setGridLabels } from "./grid";

const size = { cols: 4, rows: 3 };
const labels = Array.from({ length: 12 }, (_, i) => `square ${i}`);

describe("[F13] matrix overlay", () => {
  let box: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<div id="g"></div>';
    box = document.getElementById("g")!;
    renderGrid(box, size, labels, "the matrix");
  });

  it("draws one square per cell, in rows", () => {
    expect(box.querySelectorAll(".grid-row")).toHaveLength(3);
    expect(box.querySelectorAll(".cell")).toHaveLength(12);
    expect(box.style.getPropertyValue("--cols")).toBe("4");
    expect(box.style.getPropertyValue("--rows")).toBe("3");
  });

  it("is a grid screen readers can understand", () => {
    expect(box.getAttribute("role")).toBe("grid");
    expect(box.getAttribute("aria-label")).toBe("the matrix");
    expect(box.querySelector(".grid-row")!.getAttribute("role")).toBe("row");
    const cell = cellElement(box, 5)!;
    expect(cell.getAttribute("role")).toBe("gridcell");
    expect(cell.getAttribute("aria-label")).toBe("square 5");
  });

  it("lets Tab land on exactly one square", () => {
    const tabbable = () => [...box.querySelectorAll<HTMLElement>(".cell")].filter((c) => c.tabIndex === 0).map((c) => c.dataset.cell);
    expect(tabbable()).toEqual(["0"]);
    setActiveCell(box, 7);
    expect(tabbable()).toEqual(["7"]);
    setActiveCell(box, null);
    expect(tabbable()).toEqual(["0"]);
  });

  it("marks only the selected square", () => {
    setActiveCell(box, 3);
    setActiveCell(box, 9);
    const active = [...box.querySelectorAll(".cell.active")];
    expect(active).toHaveLength(1);
    expect((active[0] as HTMLElement).dataset.cell).toBe("9");
    expect(active[0].getAttribute("aria-selected")).toBe("true");
    expect(cellElement(box, 3)!.getAttribute("aria-selected")).toBe("false");
  });

  it("re-labels the squares, e.g. when the language changes", () => {
    setGridLabels(box, labels.map((l) => l.replace("square", "quadrado")), "a matriz");
    expect(box.getAttribute("aria-label")).toBe("a matriz");
    expect(cellElement(box, 2)!.getAttribute("aria-label")).toBe("quadrado 2");
  });

  it("finds which square an element belongs to", () => {
    expect(cellIndexOf(cellElement(box, 6))).toBe(6);
    expect(cellIndexOf(box)).toBeNull();
    expect(cellIndexOf(null)).toBeNull();
  });

  it("replaces the old squares when a new image has a different shape", () => {
    renderGrid(box, { cols: 2, rows: 2 }, ["a", "b", "c", "d"], "small");
    expect(box.querySelectorAll(".cell")).toHaveLength(4);
  });
});
