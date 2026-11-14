import "./style.css";
import * as Tone from "tone";
import { analyzeHalves, buildChord, type Chord, type RegionAnalysis } from "./analysis";
import { Harmonia } from "./sonify";

// NASA true-colour satellite images from GIBS (free, no key, CORS enabled).
// Each one was checked by eye for clouds and satellite gaps before being added.
interface Scene {
  title: string;
  caption: string;
  satellite: "MODIS_Terra" | "VIIRS_SNPP" | "VIIRS_NOAA20";
  /** south, west, north, east in degrees */
  bbox: [number, number, number, number];
  width: number;
  height: number;
  date: string;
}

const SATELLITE_NAMES = { MODIS_Terra: "MODIS Terra", VIIRS_SNPP: "VIIRS Suomi NPP", VIIRS_NOAA20: "VIIRS NOAA-20" };

const SCENES: Scene[] = [
  { title: "Namib coast", caption: "The Atlantic Ocean and clouds (left) meet the Namib Desert (right).",
    satellite: "MODIS_Terra", bbox: [-28, 8, -20, 18], width: 600, height: 480, date: "2024-05-10" },
  { title: "Sahara", caption: "Sand seas and rocky plateaus of the central Sahara, Algeria and Libya.",
    satellite: "MODIS_Terra", bbox: [20, 0, 30, 20], width: 640, height: 320, date: "2024-06-15" },
  { title: "Australian Outback", caption: "Red desert of central Australia, with clouds at the edges.",
    satellite: "VIIRS_NOAA20", bbox: [-30, 125, -20, 140], width: 600, height: 400, date: "2024-06-01" },
  { title: "Amazon", caption: "Rainforest and rivers of the central Amazon, Brazil, in the dry season.",
    satellite: "VIIRS_SNPP", bbox: [-6, -66, 0, -54], width: 640, height: 320, date: "2024-08-20" },
  { title: "Bahamas", caption: "Turquoise shallow banks of the Bahamas against the deep blue Atlantic.",
    satellite: "VIIRS_SNPP", bbox: [22, -80, 27, -75], width: 480, height: 480, date: "2024-03-10" },
  { title: "Hurricane Milton", caption: "Hurricane Milton in the Gulf of Mexico, with Florida at the top and Cuba at the bottom right.",
    satellite: "VIIRS_SNPP", bbox: [18, -95, 30, -80], width: 600, height: 480, date: "2024-10-08" },
  { title: "Greenland", caption: "The Greenland ice sheet in summer, with dark open sea around its coasts.",
    satellite: "MODIS_Terra", bbox: [60, -60, 80, -20], width: 480, height: 480, date: "2024-07-20" },
];

function sceneUrl(s: Scene): string {
  const p = new URLSearchParams({
    SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.3.0",
    LAYERS: `${s.satellite}_CorrectedReflectance_TrueColor`, STYLES: "", CRS: "EPSG:4326",
    BBOX: s.bbox.join(","), WIDTH: String(s.width), HEIGHT: String(s.height),
    FORMAT: "image/jpeg", TIME: s.date,
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${p}`;
}

function sceneCaption(s: Scene): string {
  const d = new Date(`${s.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return `${s.title}: ${s.caption} NASA ${SATELLITE_NAMES[s.satellite]}, ${d}.`;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $<HTMLCanvasElement>("stage");
const ctx = stage.getContext("2d", { willReadFrequently: true })!;
const playBtn = $<HTMLButtonElement>("play");
const status = $("status");
const live = $("live");

const engine = new Harmonia();
let playing = false;
let chords: { left: Chord; right: Chord } | null = null;

function announce(text: string) {
  live.textContent = "";
  requestAnimationFrame(() => (live.textContent = text));
}

// ---------- image loading ----------
async function showImage(source: ImageBitmap, caption: string) {
  const maxW = 960;
  const scale = Math.min(1, maxW / source.width);
  stage.width = Math.round(source.width * scale);
  stage.height = Math.round(source.height * scale);
  ctx.drawImage(source, 0, 0, stage.width, stage.height);
  $("caption").textContent = caption;
  stage.setAttribute("aria-label", caption);
  analyse();
}

let loadToken = 0;
async function loadScene(i: number) {
  const scene = SCENES[i];
  const token = ++loadToken;
  renderScenePicker(i);
  status.textContent = `Loading ${scene.title}…`;
  try {
    const res = await fetch(sceneUrl(scene));
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(String(res.status));
    const bitmap = await createImageBitmap(await res.blob());
    if (token !== loadToken) return; // another scene was picked meanwhile
    await showImage(bitmap, sceneCaption(scene));
    status.textContent = "";
  } catch {
    if (token === loadToken) status.textContent = "Couldn't load the NASA image. Try another one, or upload your own.";
  }
}

function renderScenePicker(selected: number | null) {
  const box = $("scenes");
  box.innerHTML = "";
  SCENES.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.title;
    b.setAttribute("aria-pressed", String(i === selected));
    b.addEventListener("click", () => void loadScene(i));
    box.append(b);
  });
}

async function loadFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  loadToken++;
  renderScenePicker(null);
  try {
    await showImage(await createImageBitmap(file), `Your image: ${file.name}`);
    status.textContent = "";
  } catch {
    status.textContent = "That file couldn't be read as an image.";
  }
}

// ---------- analysis -> chords -> UI ----------
function analyse() {
  const { data, width, height } = ctx.getImageData(0, 0, stage.width, stage.height);
  const halves = analyzeHalves(data, width, height);
  chords = { left: buildChord(halves.left), right: buildChord(halves.right) };
  renderHalf("left", halves.left, chords.left);
  renderHalf("right", halves.right, chords.right);
  engine.setChords(chords.left, chords.right);
  announce(`Left half: ${describe(halves.left, chords.left)} Right half: ${describe(halves.right, chords.right)}`);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const word = (v: number, lo: string, mid: string, hi: string) => (v < 0.35 ? lo : v < 0.65 ? mid : hi);

function describe(a: RegionAnalysis, c: Chord): string {
  const temp = a.warmth > 0.15 ? "warm" : a.warmth < -0.15 ? "cold" : "neutral";
  return (
    `${temp} colours, so ${c.name} ${c.quality}. ` +
    `${word(a.brightness, "Dark", "Medium", "Bright")}, so ${word(a.brightness, "low", "middle", "high")} notes. ` +
    `Colours ${word(a.similarity, "very varied", "fairly mixed", "close together")}, so ${word(a.similarity, "clashing", "rich", "harmonic")} sound.`
  );
}

function meter(label: string, value: string, fill: number, extra = "") {
  return `<div class="meter"><div class="top"><span>${label}</span><b>${value}</b></div>` +
    `<div class="bar ${extra}" aria-hidden="true"><i style="width:${pct(fill)};left:${extra ? pct(fill) : "0"}"></i></div></div>`;
}

function renderHalf(side: "left" | "right", a: RegionAnalysis, c: Chord) {
  $(`${side}-chord`).innerHTML = `${c.name}<span class="q ${c.quality}">${c.quality}</span>`;
  const warmthLabel = a.warmth > 0.15 ? "warm → major" : a.warmth < -0.15 ? "cold → minor" : `neutral → ${c.quality}`;
  $(`${side}-meters`).innerHTML =
    meter("Brightness → treble", `${pct(a.brightness)} · ${word(a.brightness, "low", "mid", "high")}`, a.brightness) +
    meter("Colour similarity → harmony", `${pct(a.similarity)} · ${word(a.similarity, "clashing", "rich", "harmonic")}`, a.similarity) +
    meter("Cold ↔ warm → minor / major", warmthLabel, (a.warmth + 1) / 2, "warmth");
}

// ---------- playback ----------
engine.onStep = (side, time) => {
  Tone.getDraw().schedule(() => {
    const el = $(`flash-${side}`);
    el.classList.add("on");
    setTimeout(() => el.classList.remove("on"), 90);
  }, time);
};

async function togglePlay() {
  if (playing) {
    engine.stop();
    playing = false;
    playBtn.textContent = "Play";
    return;
  }
  await engine.start();
  if (chords) engine.setChords(chords.left, chords.right);
  engine.play();
  playing = true;
  playBtn.textContent = "Stop";
}

playBtn.addEventListener("click", () => void togglePlay());
$<HTMLInputElement>("file").addEventListener("change", (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void loadFile(f);
});

const drop = $("drop");
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("dragging");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("dragging");
  const f = e.dataTransfer?.files?.[0];
  if (f) void loadFile(f);
});

document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.key === " " && tag !== "BUTTON" && tag !== "INPUT") {
    e.preventDefault();
    void togglePlay();
  }
});

void loadScene(0);
