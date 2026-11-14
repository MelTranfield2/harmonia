import "./style.css";
import * as Tone from "tone";
import { analyzeHalves, buildChord, type Chord, type RegionAnalysis } from "./analysis";
import { Harmonia } from "./sonify";

// NASA example: Namib Desert (warm, right) meets the Atlantic Ocean (cold, left).
// MODIS Terra true colour from NASA GIBS (free, no key, CORS enabled).
const NASA_URL =
  "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0" +
  "&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&STYLES=&CRS=EPSG:4326&BBOX=-28,8,-20,18" +
  "&WIDTH=600&HEIGHT=480&FORMAT=image/jpeg&TIME=2024-05-10";
const NASA_CAPTION = "NASA MODIS Terra, 10 May 2024: the Atlantic Ocean and clouds (left) meet the Namib Desert (right).";

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

async function loadNasa() {
  status.textContent = "Loading NASA image…";
  try {
    const res = await fetch(NASA_URL);
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(String(res.status));
    await showImage(await createImageBitmap(await res.blob()), NASA_CAPTION);
    status.textContent = "";
  } catch {
    status.textContent = "Couldn't load the NASA image. Try uploading one instead.";
  }
}

async function loadFile(file: File) {
  if (!file.type.startsWith("image/")) return;
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
$("nasa").addEventListener("click", () => void loadNasa());
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

void loadNasa();
