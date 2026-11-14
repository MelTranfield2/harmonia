// The "records" in the jukebox. Each one is a NASA layer, a list of dates
// (one frame per date) and the rules for turning its values into sound.
// To add a record: pick a layer in https://worldview.earthdata.nasa.gov,
// find its colormap name in the GIBS WMTS capabilities, and copy a block below.
import type { Metric } from "./analysis";
import type { BBox, Projection } from "./gibs";

export type Instrument = "warm" | "bell" | "pluck";

export interface Frame {
  /** ISO date sent to GIBS */
  time: string;
  /** what we say/show for this frame */
  label: string;
}

export interface RecordDef {
  id: string;
  title: string;
  subtitle: string;
  /** one-paragraph description for everyone, including screen-reader users */
  story: string;
  layer: string;
  colormap: string;
  projection: Projection;
  bbox: BBox;
  width: number;
  height: number;
  frames: Frame[];
  /** values for colours the colormap marks as classes, keyed "r,g,b" */
  colorOverrides?: Record<string, number>;
  /** applied to every decoded value (e.g. Kelvin -> °C) */
  transform?: (v: number) => number;
  metric: Metric;
  /** value range mapped to the lowest..highest note when exploring a single point */
  pointRange: [number, number];
  /** range mapped to notes for each needle slice (for "extent" this is a 0..1 share of the slice) */
  columnRange: [number, number];
  /** how far the frame summary must move from the first frame to reach full drone bend / roughness */
  changeScale: number;
  instrument: Instrument;
  formatPoint: (v: number) => string;
  formatMetric: (v: number) => string;
  formatChange: (d: number) => string;
  metricName: string;
  legend: { low: string; high: string; silence: string; drone: string };
}

const signed = (d: number, digits: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(digits)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const WORLD: BBox = { west: -180, south: -90, east: 180, north: 90 };

/** SSMIS sea ice is every 2nd day before Aug 1987, so pick the valid day nearest to 15 Sept. */
function septemberIceDate(year: number): string {
  if (year >= 1987) return `${year}-09-15`;
  const start = Date.UTC(1978, 9, 26);
  const days = Math.round((Date.UTC(year, 8, 15) - start) / 86400000);
  return days % 2 === 0 ? `${year}-09-15` : `${year}-09-16`;
}

export const RECORDS: RecordDef[] = [
  {
    id: "fever",
    title: "Planet Fever",
    subtitle: "Air temperature · every July, 1980 → 2025",
    story:
      "Near-surface air temperature for the whole planet, from the NASA MERRA-2 reanalysis. " +
      "One frame per July from 1980 to 2025. The needle sweeps west to east: high notes are hot places, low notes are cold. " +
      "A low drone follows the global average and rises as the planet warms.",
    layer: "MERRA2_2m_Air_Temperature_Monthly",
    colormap: "MERRA2_2m_Air_Temperature_Monthly",
    projection: "4326",
    bbox: WORLD,
    width: 720,
    height: 360,
    frames: range(1980, 2025).map((y) => ({ time: `${y}-07-01`, label: `July ${y}` })),
    transform: (k) => k - 273.15,
    metric: { kind: "mean" },
    pointRange: [-40, 40],
    columnRange: [-20, 35],
    changeScale: 0.6,
    instrument: "warm",
    formatPoint: (v) => `${v.toFixed(0)} °C`,
    formatMetric: (v) => `${v.toFixed(2)} °C`,
    formatChange: (d) => `${signed(d, 2)} °C`,
    metricName: "global average",
    legend: {
      low: "Low notes: cold, around −20 °C and below.",
      high: "High notes: hot, 35 °C and above.",
      silence: "Every column has data, so there are no silences.",
      drone: "The drone rises and the sound gets rougher as the July global average climbs above 1980.",
    },
  },
  {
    id: "ice",
    title: "Vanishing Ice",
    subtitle: "Arctic sea ice · every September, 1979 → 2020",
    story:
      "Arctic sea ice concentration from the SSMIS / SSM/I passive-microwave satellites, seen from above the North Pole. " +
      "One frame per mid-September, near the yearly minimum, from 1979 to 2020. " +
      "Bells ring where there is ice; silence is open water or land. The drone follows the total ice extent and sinks as the ice disappears.",
    layer: "SSMIS_Sea_Ice_Concentration",
    colormap: "SSMIS_Sea_Ice_Concentration",
    projection: "3413",
    bbox: { west: -3_000_000, south: -3_000_000, east: 3_000_000, north: 3_000_000 },
    width: 480,
    height: 480,
    frames: range(1979, 2020).map((y) => ({ time: septemberIceDate(y), label: `September ${y}` })),
    // The satellites can't see the area right around the pole (the "pole hole", which shrank in 1987).
    // Like NSIDC, count it as ice; otherwise the hole's change in size would distort the trend.
    colorOverrides: { "0,0,1": 100 },
    metric: { kind: "extent", threshold: 15 },
    pointRange: [15, 100],
    columnRange: [0, 0.45],
    changeScale: 3,
    instrument: "bell",
    formatPoint: (v) => `${v.toFixed(0)} % ice`,
    formatMetric: (v) => `${v.toFixed(2)} million km² of ice`,
    formatChange: (d) => `${signed(d, 2)} million km²`,
    metricName: "ice extent",
    legend: {
      low: "Low bells: a thin slice of ice.",
      high: "High bells: a wide band of ice.",
      silence: "Silence: open water or land, no ice.",
      drone: "The drone sinks and roughens as the total ice extent shrinks below 1979.",
    },
  },
  {
    id: "breath",
    title: "Breathing Planet",
    subtitle: "Vegetation (NDVI) · every month of 2024",
    story:
      "Vegetation greenness (NDVI) from the MODIS instrument on NASA's Terra satellite, one frame per month of 2024. " +
      "Plucked notes play over land: higher notes mean greener, denser plants. Oceans are silent. " +
      "Listen to the northern forests wake up in spring and fade in autumn.",
    layer: "MODIS_Terra_L3_NDVI_Monthly",
    colormap: "MODIS_L3_NDVI",
    projection: "4326",
    bbox: WORLD,
    width: 720,
    height: 360,
    frames: range(0, 11).map((m) => ({
      time: `2024-${String(m + 1).padStart(2, "0")}-01`,
      label: `${MONTHS[m]} 2024`,
    })),
    metric: { kind: "mean" },
    pointRange: [0, 0.9],
    columnRange: [0.1, 0.6],
    changeScale: 0.08,
    instrument: "pluck",
    formatPoint: (v) => `NDVI ${v.toFixed(2)}`,
    formatMetric: (v) => `average NDVI ${v.toFixed(3)}`,
    formatChange: (d) => `${signed(d, 3)} NDVI`,
    metricName: "average greenness over land",
    legend: {
      low: "Low notes: bare ground, desert or snow.",
      high: "High notes: lush, dense vegetation.",
      silence: "Silence: ocean, no land to measure.",
      drone: "The drone rises as the planet's land gets greener than in January.",
    },
  },
];
