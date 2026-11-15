import { describe, expect, it } from "vitest";
import { analyzeRect } from "./analysis";
import { analyzeGrid, cellRect, gridSize, moveCell, panForColumn, zoneForColumn } from "./grid";

/** RGBA image where each pixel's colour comes from a function. */
function image(w: number, h: number, colour: (x: number, y: number) => number[]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) d.set([...colour(x, y), 255], (y * w + x) * 4);
  return d;
}

const BLUE = [20, 60, 200], ORANGE = [230, 120, 30];

describe("[F13] matrix size", () => {
  it("keeps squares roughly square for each image shape", () => {
    expect(gridSize(600, 480)).toEqual({ cols: 8, rows: 6 });
    expect(gridSize(640, 320)).toEqual({ cols: 8, rows: 4 });
    expect(gridSize(480, 480)).toEqual({ cols: 8, rows: 8 });
  });

  it("stays between 2 and 8 rows for extreme shapes", () => {
    expect(gridSize(2000, 100).rows).toBe(2);
    expect(gridSize(100, 2000).rows).toBe(8);
  });

  it("tiles the whole image with no gaps and no overlap", () => {
    const size = gridSize(601, 479), w = 601, h = 479;
    const hits = new Uint8Array(w * h);
    for (let i = 0; i < size.cols * size.rows; i++) {
      const r = cellRect(i, size, w, h);
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) hits[y * w + x]++;
    }
    expect(hits.every((n) => n === 1)).toBe(true);
  });
});

describe("[F13] each square follows the same rules", () => {
  const size = { cols: 4, rows: 2 };
  // left half blue, right half orange; top row bright, bottom row dark
  const data = image(40, 20, (x, y) => (x < 20 ? BLUE : ORANGE).map((c) => (y < 10 ? Math.min(255, c + 50) : c * 0.4)));
  const cells = analyzeGrid(data, 40, 20, size, 1);

  it("makes one cell per square, in reading order", () => {
    expect(cells).toHaveLength(8);
    expect(cells.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(cells[5]).toMatchObject({ row: 1, col: 1 });
  });

  it("[F3] cold squares are minor, warm squares are major", () => {
    expect(cells[0].chord.quality).toBe("minor");
    expect(cells[3].chord.quality).toBe("major");
  });

  it("[F1] a brighter square sounds brighter than a darker one", () => {
    expect(cells[0].analysis.brightness).toBeGreaterThan(cells[4].analysis.brightness);
    expect(cells[0].chord.cutoff).toBeGreaterThan(cells[4].chord.cutoff);
  });

  it("[F5] left squares play lower than right squares", () => {
    expect(cells[0].zone).toBe("low");
    expect(cells[3].zone).toBe("high");
    expect(Math.max(...cells[4].chord.notes)).toBeLessThan(Math.min(...cells[7].chord.notes));
  });

  it("[F4] pans from left to right across the columns", () => {
    const pans = cells.slice(0, 4).map((c) => c.pan);
    expect(pans[0]).toBe(-1); // first column: fully left
    expect(pans[3]).toBe(1); // last column: fully right
    expect(pans[1]).toBeCloseTo(-pans[2]); // mirrored around the centre
    expect([...pans].sort((a, b) => a - b)).toEqual(pans);
  });

  it("only looks at its own square", () => {
    // one red pixel block in the top-left square must not change its neighbours
    const spot = image(40, 20, (x, y) => (x < 10 && y < 10 ? [255, 0, 0] : BLUE));
    const g = analyzeGrid(spot, 40, 20, size, 1);
    expect(g[0].chord.quality).toBe("major");
    expect(g[1].chord.quality).toBe("minor");
    expect(g[4].chord.quality).toBe("minor");
  });
});

describe("[F13] helpers", () => {
  it("analyzeRect respects the rectangle's rows", () => {
    const data = image(4, 4, (_x, y) => (y < 2 ? [255, 255, 255] : [0, 0, 0]));
    expect(analyzeRect(data, 4, { x0: 0, y0: 0, x1: 4, y1: 2 }, 1).brightness).toBeCloseTo(1);
    expect(analyzeRect(data, 4, { x0: 0, y0: 2, x1: 4, y1: 4 }, 1).brightness).toBeCloseTo(0);
  });

  it("[F4] moves in even steps across 8 columns", () => {
    const pans = Array.from({ length: 8 }, (_, c) => panForColumn(c, 8));
    expect(pans[0]).toBe(-1);
    expect(pans[7]).toBe(1);
    for (let c = 1; c < 8; c++) expect(pans[c] - pans[c - 1]).toBeCloseTo(2 / 7);
  });

  it("centres a single column and splits zones down the middle", () => {
    expect(panForColumn(0, 1)).toBe(0);
    expect([0, 1, 2, 3].map((c) => zoneForColumn(c, 4))).toEqual(["low", "low", "high", "high"]);
  });
});

describe("[F13] arrow keys", () => {
  const size = { cols: 4, rows: 3 }; // indices 0..11

  it("moves one square in each direction", () => {
    expect(moveCell(5, "ArrowLeft", size)).toBe(4);
    expect(moveCell(5, "ArrowRight", size)).toBe(6);
    expect(moveCell(5, "ArrowUp", size)).toBe(1);
    expect(moveCell(5, "ArrowDown", size)).toBe(9);
  });

  it("stops at the edges instead of wrapping around", () => {
    expect(moveCell(4, "ArrowLeft", size)).toBe(4);
    expect(moveCell(7, "ArrowRight", size)).toBe(7);
    expect(moveCell(2, "ArrowUp", size)).toBe(2);
    expect(moveCell(10, "ArrowDown", size)).toBe(10);
  });

  it("jumps to the start and end of the row", () => {
    expect(moveCell(6, "Home", size)).toBe(4);
    expect(moveCell(5, "End", size)).toBe(7);
  });

  it("ignores other keys", () => {
    expect(moveCell(5, "a", size)).toBe(5);
  });
});
