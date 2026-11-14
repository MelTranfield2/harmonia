import { describe, expect, it } from "vitest";
import { columns, frameMetric, normalize, pixelToLatLon, rowWeights, valueAt, type Grid } from "./analysis";
import { decodePixels, parseColormap, parseRange, withOverrides } from "./colormap";
import { wmsUrl } from "./gibs";
import { RECORDS } from "./records";
import { noteFor } from "./sonify";

const XML = `<ColorMaps>
  <ColorMap title="No Data"><Entries>
    <ColorMapEntry rgb="255,0,255" transparent="true" nodata="true" ref="0"/>
  </Entries></ColorMap>
  <ColorMap title="Air Temperature" units="K"><Entries>
    <ColorMapEntry rgb="0,0,200" transparent="false" sourceValue="[-INF,220)" value="[-INF,220)" ref="1"/>
    <ColorMapEntry rgb="0,200,0" transparent="false" sourceValue="[250,260)" value="[250,260)" ref="2"/>
    <ColorMapEntry rgb="200,0,0" transparent="false" sourceValue="[300,INF)" value="[300,INF)" ref="3"/>
    <ColorMapEntry rgb="0,0,1" transparent="false" sourceValue="[251]" ref="4"/>
  </Entries></ColorMap>
</ColorMaps>`;

describe("colormap", () => {
  it("parses value ranges", () => {
    expect(parseRange("[220,221)")).toBe(220.5);
    expect(parseRange("[-INF,220)")).toBe(220);
    expect(parseRange("[300,INF)")).toBe(300);
    expect(parseRange("[100]")).toBe(100);
  });

  it("decodes exact, near and no-data colours", () => {
    const cmap = parseColormap(XML);
    expect(cmap.units).toBe("K");
    const px = new Uint8ClampedArray([
      0, 200, 0, 255, // exact -> 255
      205, 3, 2, 255, // near red -> 300
      0, 0, 1, 255, // classification colour (pole hole) -> NaN
      0, 200, 0, 0, // transparent -> NaN
      120, 120, 120, 255, // unknown, far from everything -> NaN
    ]);
    const out = decodePixels(px, cmap, (k) => k - 273.15);
    expect(out[0]).toBeCloseTo(-18.15);
    expect(out[1]).toBeCloseTo(26.85);
    expect(Number.isNaN(out[2])).toBe(true);
    expect(Number.isNaN(out[3])).toBe(true);
    expect(Number.isNaN(out[4])).toBe(true);
  });

  it("lets a record give the pole hole a value", () => {
    const cmap = withOverrides(parseColormap(XML), { "0,0,1": 100 });
    expect(decodePixels(new Uint8ClampedArray([0, 0, 1, 255]), cmap)[0]).toBe(100);
  });
});

describe("analysis", () => {
  // 4 x 2 grid: left half 10, right half 30, one no-data pixel
  const grid: Grid = { width: 4, height: 2, values: new Float32Array([10, 10, 30, NaN, 10, 10, 30, 30]) };
  const flat = new Float32Array([1, 1]);

  it("averages valid pixels", () => {
    expect(frameMetric(grid, flat, { kind: "mean" })).toBeCloseTo(130 / 7);
  });

  it("measures extent above a threshold", () => {
    // 3 pixels >= 15, each 1e6 km² -> 3 million km²
    expect(frameMetric(grid, flat, { kind: "extent", threshold: 15 }, 1e6)).toBe(3);
  });

  it("splits into needle slices", () => {
    const cols = columns(grid, flat, 2, { kind: "mean" });
    expect(cols[0]).toEqual({ value: 10, coverage: 1 });
    expect(cols[1].value).toBeCloseTo(30);
    expect(cols[1].coverage).toBeCloseTo(0.75);
    const empty: Grid = { width: 2, height: 1, values: new Float32Array([NaN, NaN]) };
    expect(columns(empty, new Float32Array([1]), 1, { kind: "mean" })[0].value).toBeNull();
  });

  it("weights rows by latitude on the global grid", () => {
    const w = rowWeights("4326", { west: -180, south: -90, east: 180, north: 90 }, 2);
    expect(w[0]).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(rowWeights("3413", { west: 0, south: 0, east: 1, north: 1 }, 2)[0]).toBe(1);
  });

  it("reads a point and normalizes", () => {
    expect(valueAt(grid, 0, 0, 0)).toBe(10);
    expect(valueAt(grid, 3, 0, 0)).toBeNull();
    expect(normalize(15, [10, 20])).toBe(0.5);
    expect(normalize(99, [10, 20])).toBe(1);
  });

  it("converts pixels to lat/lon", () => {
    const world = { west: -180, south: -90, east: 180, north: 90 };
    const p = pixelToLatLon("4326", world, 360, 180, 0, 0);
    expect(p.lat).toBeCloseTo(89.5);
    expect(p.lon).toBeCloseTo(-179.5);
    const arctic = { west: -3e6, south: -3e6, east: 3e6, north: 3e6 };
    const pole = pixelToLatLon("3413", arctic, 480, 480, 239.5, 239.5);
    expect(pole.lat).toBeCloseTo(90, 3);
  });
});

describe("gibs + records", () => {
  it("uses lat,lon axis order for EPSG:4326", () => {
    const url = new URL(wmsUrl({ projection: "4326", layer: "X", bbox: { west: -180, south: -90, east: 180, north: 90 }, width: 2, height: 1, time: "2020-01-01" }));
    expect(url.searchParams.get("BBOX")).toBe("-90,-180,90,180");
    expect(url.searchParams.get("TIME")).toBe("2020-01-01");
  });

  it("only asks GIBS for dates the sea-ice layer has", () => {
    const ice = RECORDS.find((r) => r.id === "ice")!;
    const start = Date.UTC(1978, 9, 26);
    for (const f of ice.frames) {
      const t = Date.parse(f.time);
      if (t < Date.UTC(1987, 7, 18)) expect(((t - start) / 86400000) % 2).toBe(0);
      expect(t).toBeLessThan(Date.UTC(2021, 1, 19));
    }
  });

  it("maps values to a rising scale", () => {
    expect(noteFor(0)).toBeLessThan(noteFor(0.5));
    expect(noteFor(0.5)).toBeLessThan(noteFor(1));
  });
});
