import "./style.css";
import * as Tone from "tone";
import { analyzeHalves, buildChord, type Chord, type RegionAnalysis } from "./analysis";
import { initialLang, saveLang, SCENE_TEXT, STRINGS, type Lang } from "./i18n";
import { Harmonia } from "./sonify";

// NASA true-colour satellite images from GIBS (free, no key, CORS enabled).
// Each one was checked by eye for clouds and satellite gaps before being added.
// Titles and captions live in i18n.ts (SCENE_TEXT), in the same order.
interface Scene {
  satellite: "MODIS_Terra" | "VIIRS_SNPP" | "VIIRS_NOAA20";
  /** south, west, north, east in degrees */
  bbox: [number, number, number, number];
  width: number;
  height: number;
  date: string;
}

const SATELLITE_NAMES = { MODIS_Terra: "MODIS Terra", VIIRS_SNPP: "VIIRS Suomi NPP", VIIRS_NOAA20: "VIIRS NOAA-20" };

const SCENES: Scene[] = [
  { satellite: "MODIS_Terra", bbox: [-28, 8, -20, 18], width: 600, height: 480, date: "2024-05-10" }, // Namib coast
  { satellite: "MODIS_Terra", bbox: [20, 0, 30, 20], width: 640, height: 320, date: "2024-06-15" }, // Sahara
  { satellite: "VIIRS_NOAA20", bbox: [-30, 125, -20, 140], width: 600, height: 400, date: "2024-06-01" }, // Australia
  { satellite: "VIIRS_SNPP", bbox: [-6, -66, 0, -54], width: 640, height: 320, date: "2024-08-20" }, // Amazon
  { satellite: "VIIRS_SNPP", bbox: [22, -80, 27, -75], width: 480, height: 480, date: "2024-03-10" }, // Bahamas
  { satellite: "VIIRS_SNPP", bbox: [18, -95, 30, -80], width: 600, height: 480, date: "2024-10-08" }, // Milton
  { satellite: "MODIS_Terra", bbox: [60, -60, 80, -20], width: 480, height: 480, date: "2024-07-20" }, // Greenland
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

// ---------- language ----------
let lang: Lang = initialLang();
const T = () => STRINGS[lang];

function sceneCaption(i: number): string {
  const s = SCENES[i], text = SCENE_TEXT[lang][i];
  const d = new Date(`${s.date}T12:00:00Z`).toLocaleDateString(T().dateLocale, {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  return `${text.title}: ${text.caption} NASA ${SATELLITE_NAMES[s.satellite]}, ${d}.`;
}

// ---------- elements and state ----------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $<HTMLCanvasElement>("stage");
const ctx = stage.getContext("2d", { willReadFrequently: true })!;
const playBtn = $<HTMLButtonElement>("play");
const status = $("status");
const live = $("live");

const engine = new Harmonia();
let playing = false;
let chords: { left: Chord; right: Chord } | null = null;
let halves: { left: RegionAnalysis; right: RegionAnalysis } | null = null;
/** what is on screen, so captions can be re-translated */
let source: { kind: "scene"; index: number } | { kind: "file"; name: string } | null = null;
/** what the status line is showing, so it can be re-translated */
let statusKey: { kind: "loading"; index: number } | { kind: "loadError" | "fileError" } | null = null;

function announce(text: string) {
  live.textContent = "";
  requestAnimationFrame(() => (live.textContent = text));
}

function setStatus(key: typeof statusKey) {
  statusKey = key;
  renderStatus();
}

function renderStatus() {
  if (!statusKey) status.textContent = "";
  else if (statusKey.kind === "loading") status.textContent = T().loading(SCENE_TEXT[lang][statusKey.index].title);
  else status.textContent = T()[statusKey.kind];
}

// ---------- image loading ----------
function showImage(img: ImageBitmap) {
  const maxW = 960;
  const scale = Math.min(1, maxW / img.width);
  stage.width = Math.round(img.width * scale);
  stage.height = Math.round(img.height * scale);
  ctx.drawImage(img, 0, 0, stage.width, stage.height);
  renderCaption();
  analyse();
}

function renderCaption() {
  const text = !source ? "" : source.kind === "scene" ? sceneCaption(source.index) : T().yourImage(source.name);
  $("caption").textContent = text;
  stage.setAttribute("aria-label", text || T().imageAlt);
}

let loadToken = 0;
let selectedScene: number | null = 0;

async function loadScene(i: number) {
  const token = ++loadToken;
  selectedScene = i;
  renderScenePicker();
  setStatus({ kind: "loading", index: i });
  try {
    const res = await fetch(sceneUrl(SCENES[i]));
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(String(res.status));
    const bitmap = await createImageBitmap(await res.blob());
    if (token !== loadToken) return; // another image was picked meanwhile
    source = { kind: "scene", index: i };
    showImage(bitmap);
    setStatus(null);
  } catch {
    if (token === loadToken) setStatus({ kind: "loadError" });
  }
}

function renderScenePicker() {
  const box = $("scenes");
  box.innerHTML = "";
  SCENE_TEXT[lang].forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.title;
    b.setAttribute("aria-pressed", String(i === selectedScene));
    b.addEventListener("click", () => void loadScene(i));
    box.append(b);
  });
}

async function loadFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  loadToken++;
  selectedScene = null;
  renderScenePicker();
  try {
    const bitmap = await createImageBitmap(file);
    source = { kind: "file", name: file.name };
    showImage(bitmap);
    setStatus(null);
  } catch {
    setStatus({ kind: "fileError" });
  }
}

// ---------- analysis -> chords -> UI ----------
function analyse() {
  const { data, width, height } = ctx.getImageData(0, 0, stage.width, stage.height);
  halves = analyzeHalves(data, width, height);
  chords = { left: buildChord(halves.left), right: buildChord(halves.right) };
  engine.setChords(chords.left, chords.right);
  renderHalves();
  announceHalves();
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const level = (v: number): 0 | 1 | 2 => (v < 0.35 ? 0 : v < 0.65 ? 1 : 2);
const temperature = (a: RegionAnalysis): "warm" | "cold" | "neutral" =>
  a.warmth > 0.15 ? "warm" : a.warmth < -0.15 ? "cold" : "neutral";

function describe(a: RegionAnalysis, c: Chord): string {
  return T().describe({
    temp: temperature(a), chord: c.name, quality: T().quality[c.quality],
    bright: level(a.brightness), similar: level(a.similarity),
  });
}

function announceHalves() {
  if (!halves || !chords) return;
  announce(T().halves(describe(halves.left, chords.left), describe(halves.right, chords.right)));
}

function meter(label: string, value: string, fill: number, extra = "") {
  return `<div class="meter"><div class="top"><span>${label}</span><b>${value}</b></div>` +
    `<div class="bar ${extra}" aria-hidden="true"><i style="width:${pct(fill)};left:${extra ? pct(fill) : "0"}"></i></div></div>`;
}

function renderHalves() {
  if (!halves || !chords) return;
  for (const side of ["left", "right"] as const) {
    const a = halves[side], c = chords[side], t = T();
    const q = t.quality[c.quality];
    $(`${side}-chord`).innerHTML = `${c.name}<span class="q ${c.quality}">${q}</span>`;
    $(`${side}-meters`).innerHTML =
      meter(t.meters.brightness, `${pct(a.brightness)} · ${t.brightnessWords[level(a.brightness)]}`, a.brightness) +
      meter(t.meters.similarity, `${pct(a.similarity)} · ${t.similarityWords[level(a.similarity)]}`, a.similarity) +
      meter(t.meters.warmth, t.warmthLabel(temperature(a), q), (a.warmth + 1) / 2, "warmth");
  }
}

// ---------- page language ----------
function applyLanguage(announceIt = false) {
  const t = T();
  document.documentElement.lang = t.htmlLang;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => (el.textContent = t.page[el.dataset.i18n!]));
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => (el.innerHTML = t.page[el.dataset.i18nHtml!]));
  document.querySelectorAll<HTMLElement>("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", t.page[el.dataset.i18nLabel!]));
  document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  playBtn.textContent = playing ? t.stop : t.play;
  renderScenePicker();
  renderCaption();
  renderStatus();
  renderHalves();
  if (announceIt) announce(t.switched);
}

document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) =>
  b.addEventListener("click", () => {
    const next = b.dataset.lang as Lang;
    if (next === lang) return;
    lang = next;
    saveLang(lang);
    applyLanguage(true);
  }),
);

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
    playBtn.textContent = T().play;
    return;
  }
  await engine.start();
  if (chords) engine.setChords(chords.left, chords.right);
  engine.play();
  playing = true;
  playBtn.textContent = T().stop;
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

applyLanguage();
void loadScene(0);
