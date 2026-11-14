import "./style.css";
import * as Tone from "tone";
import {
  columns, formatLatLon, frameMetric, normalize, pixelAreaKm2, pixelToLatLon, rowWeights, valueAt,
  type Column, type Grid,
} from "./analysis";
import { decodePixels, parseColormap, withOverrides, type Colormap } from "./colormap";
import { colormapUrl, fetchImage, PROJECTIONS, wmsUrl } from "./gibs";
import { RECORDS, type RecordDef } from "./records";
import { Sonifier } from "./sonify";

/** Needle slices per frame (one note each). */
const STEPS = 32;

interface FrameData {
  bitmap: ImageBitmap;
  grid: Grid;
  cols: Column[];
  metric: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  records: $("records"),
  title: $("rec-title"),
  story: $("rec-story"),
  stage: $<HTMLCanvasElement>("stage"),
  loading: $("loading"),
  frameLabel: $("frame-label"),
  metric: $("metric"),
  change: $("change"),
  trend: $<HTMLCanvasElement>("trend"),
  trendText: $("trend-text"),
  prev: $<HTMLButtonElement>("prev"),
  play: $<HTMLButtonElement>("play"),
  next: $<HTMLButtonElement>("next"),
  timeline: $<HTMLInputElement>("timeline"),
  speed: $<HTMLInputElement>("speed"),
  legend: $<HTMLButtonElement>("legend"),
  explore: $<HTMLButtonElement>("explore"),
  speak: $<HTMLButtonElement>("speak"),
  mute: $<HTMLButtonElement>("mute"),
  live: $("live"),
};
const stageCtx = el.stage.getContext("2d")!;

const sonifier = new Sonifier();
const transport = Tone.getTransport();
const draw = Tone.getDraw();

// ---------- state ----------
let rec: RecordDef = RECORDS[0];
let recIndex = 0;
let recToken = 0; // bumps on record change so stale downloads are ignored
let frames: (FrameData | undefined)[] = [];
const failed = new Set<number>();
const pending = new Map<number, Promise<FrameData>>();
let coast: HTMLCanvasElement | null = null;
let weights: Float32Array = new Float32Array();
let pxKm2 = 0;

// audio-side playhead (runs slightly ahead of what's on screen)
let frame = 0;
let step = 0;
let playing = false;
let finishing = false;
let atEnd = false;
let waiting = false;
let repeatId: number | null = null;

// what's on screen
const view = { frame: 0, needle: -1 };
const explore = { on: false, x: 0, y: 0, visible: false, lastNote: 0 };
let speakAloud = false;
let muted = false;

// ---------- loading ----------
const cmapCache = new Map<string, Promise<Colormap>>();
function loadColormap(name: string): Promise<Colormap> {
  let p = cmapCache.get(name);
  if (!p) {
    p = fetch(colormapUrl(name)).then((r) => {
      if (!r.ok) throw new Error(`Colormap ${name}: ${r.status}`);
      return r.text().then(parseColormap);
    });
    p.catch(() => cmapCache.delete(name));
    cmapCache.set(name, p);
  }
  return p;
}

function loadFrame(i: number): Promise<FrameData> {
  const ready = frames[i];
  if (ready) return Promise.resolve(ready);
  const existing = pending.get(i);
  if (existing) return existing;

  const r = rec, token = recToken, w = weights, area = pxKm2;
  const p = (async () => {
    const cmap = withOverrides(await loadColormap(r.colormap), r.colorOverrides);
    const { bitmap, pixels } = await fetchImage(
      wmsUrl({ projection: r.projection, layer: r.layer, bbox: r.bbox, width: r.width, height: r.height, time: r.frames[i].time }),
    );
    const grid: Grid = { width: pixels.width, height: pixels.height, values: decodePixels(pixels.data, cmap, r.transform) };
    const fd: FrameData = { bitmap, grid, cols: columns(grid, w, STEPS, r.metric), metric: frameMetric(grid, w, r.metric, area) };
    if (token === recToken) {
      frames[i] = fd;
      onFrameLoaded(i);
    }
    return fd;
  })();
  const done = () => { if (token === recToken) pending.delete(i); };
  p.then(done, () => {
    done();
    if (token === recToken) failed.add(i);
  });
  pending.set(i, p);
  return p;
}

async function preloadAll(token: number) {
  const queue = rec.frames.map((_, i) => i).filter((i) => !frames[i]);
  const worker = async () => {
    while (queue.length && token === recToken) {
      const i = queue.shift()!;
      await loadFrame(i).catch(() => undefined);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

async function loadCoast(token: number) {
  try {
    const { pixels } = await fetchImage(
      wmsUrl({ projection: rec.projection, layer: PROJECTIONS[rec.projection].coastLayer, bbox: rec.bbox, width: rec.width, height: rec.height }),
    );
    // Recolour coastlines to a soft white so they show on dark backgrounds.
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = 235;
      d[i + 3] = Math.round(d[i + 3] * 0.55);
    }
    const c = document.createElement("canvas");
    c.width = pixels.width;
    c.height = pixels.height;
    c.getContext("2d")!.putImageData(pixels, 0, 0);
    if (token === recToken) {
      coast = c;
      render();
    }
  } catch {
    /* coastlines are decoration only */
  }
}

// ---------- derived numbers ----------
/** -1..1: how far frame i's summary is from the first frame, in units of changeScale. */
function changeOf(i: number): number {
  const a = frames[0], b = frames[i];
  if (!a || !b) return 0;
  return Math.max(-1, Math.min(1, (b.metric - a.metric) / rec.changeScale));
}

function frameSentence(i: number, short: boolean): string {
  const f = rec.frames[i];
  const fd = frames[i];
  if (!fd) return `${f.label}: loading.`;
  const base = frames[0];
  const change = base && i > 0 ? rec.formatChange(fd.metric - base.metric) : "";
  if (short) return `${f.label}. ${rec.formatMetric(fd.metric)}${change ? `, ${change}` : ""}.`;
  return (
    `${f.label}. The ${rec.metricName} is ${rec.formatMetric(fd.metric)}` +
    (change ? `, ${change} compared with ${rec.frames[0].label}.` : ".")
  );
}

// ---------- announcing ----------
let speakTimer = 0;
function announce(text: string, opts: { speak?: boolean } = {}) {
  el.live.textContent = "";
  requestAnimationFrame(() => (el.live.textContent = text));
  if (speakAloud && opts.speak !== false && "speechSynthesis" in window) {
    clearTimeout(speakTimer);
    speakTimer = window.setTimeout(() => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      speechSynthesis.speak(u);
    }, 60);
  }
}

// ---------- drawing ----------
function render() {
  const W = el.stage.width, H = el.stage.height;
  stageCtx.fillStyle = "#0b1730";
  stageCtx.fillRect(0, 0, W, H);
  const fd = frames[view.frame];
  if (fd) stageCtx.drawImage(fd.bitmap, 0, 0, W, H);
  if (coast) stageCtx.drawImage(coast, 0, 0, W, H);

  if (view.needle >= 0) {
    const x0 = (view.needle / STEPS) * W, x1 = ((view.needle + 1) / STEPS) * W;
    stageCtx.fillStyle = "rgba(255, 204, 77, 0.18)";
    stageCtx.fillRect(x0, 0, x1 - x0, H);
    stageCtx.fillStyle = "#ffcc4d";
    stageCtx.fillRect((x0 + x1) / 2 - 1.5, 0, 3, H);
  }
  if (explore.on && explore.visible) {
    const { x, y } = explore;
    stageCtx.strokeStyle = "#fff";
    stageCtx.lineWidth = 2;
    stageCtx.beginPath();
    stageCtx.arc(x, y, 9, 0, Math.PI * 2);
    stageCtx.moveTo(x - 16, y); stageCtx.lineTo(x - 5, y);
    stageCtx.moveTo(x + 5, y); stageCtx.lineTo(x + 16, y);
    stageCtx.moveTo(x, y - 16); stageCtx.lineTo(x, y - 5);
    stageCtx.moveTo(x, y + 5); stageCtx.lineTo(x, y + 16);
    stageCtx.stroke();
  }
}

function drawTrend() {
  const c = el.trend, ctx = c.getContext("2d")!;
  const W = c.width, H = c.height, pad = 8;
  ctx.clearRect(0, 0, W, H);
  const pts = frames.map((f, i) => (f ? { i, v: f.metric } : null)).filter((p): p is { i: number; v: number } => !!p && !Number.isNaN(p.v));
  if (pts.length < 2) return;
  let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const n = rec.frames.length;
  const X = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  ctx.strokeStyle = "#ffcc4d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, k) => (k ? ctx.lineTo(X(p.i), Y(p.v)) : ctx.moveTo(X(p.i), Y(p.v))));
  ctx.stroke();
  const cur = frames[view.frame];
  if (cur) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(X(view.frame), Y(cur.metric), 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateTrendText() {
  const first = frames[0], lastIdx = rec.frames.length - 1, last = frames[lastIdx];
  if (!first || !last) {
    const n = frames.filter(Boolean).length;
    el.trendText.textContent = `Loading frames: ${n} of ${rec.frames.length}…`;
    return;
  }
  el.trendText.textContent =
    `Trend: the ${rec.metricName} went from ${rec.formatMetric(first.metric)} in ${rec.frames[0].label} ` +
    `to ${rec.formatMetric(last.metric)} in ${rec.frames[lastIdx].label} (${rec.formatChange(last.metric - first.metric)}).`;
}

function updateReadout() {
  const i = view.frame;
  const fd = frames[i];
  el.frameLabel.textContent = rec.frames[i].label;
  el.metric.textContent = fd ? `${rec.metricName}: ${rec.formatMetric(fd.metric)}` : "loading…";
  const base = frames[0];
  if (fd && base && i > 0) {
    const d = fd.metric - base.metric;
    el.change.textContent = `${rec.formatChange(d)} vs ${rec.frames[0].label}`;
    el.change.className = `change ${d >= 0 ? "up" : "down"}`;
  } else {
    el.change.textContent = "";
  }
  el.timeline.value = String(i);
  el.timeline.setAttribute("aria-valuetext", rec.frames[i].label);
  el.stage.setAttribute("aria-label", `${rec.title} map. ${frameSentence(i, false)}`);
  drawTrend();
}

function onFrameLoaded(i: number) {
  if (i === view.frame) {
    updateReadout();
    render();
  }
  if (i === 0) updateReadout(); // baseline unlocks the "change" readout
  drawTrend();
  updateTrendText();
}

function onViewFrameChange(short: boolean) {
  updateReadout();
  announce(frameSentence(view.frame, short));
}

// ---------- playback ----------
function nextPlayable(i: number): number | null {
  let j = i + 1;
  while (j < rec.frames.length && failed.has(j)) j++;
  return j < rec.frames.length ? j : null;
}

function prefetch(from: number) {
  for (let k = from; k < Math.min(rec.frames.length, from + 4); k++) loadFrame(k).catch(() => undefined);
}

function waitFor(i: number) {
  waiting = true;
  el.loading.hidden = false;
  loadFrame(i)
    .catch(() => {
      const n = nextPlayable(i);
      if (n === null) finishing = true; else frame = n;
    })
    .finally(() => {
      waiting = false;
      el.loading.hidden = true;
      if (finishing) pause(true);
    });
}

function tick(time: number) {
  if (!playing || finishing || waiting) return;
  const fd = frames[frame];
  if (!fd) {
    waitFor(frame);
    return;
  }
  const f = frame, s = step;
  if (s === 0) sonifier.frameStart(time, changeOf(f));
  const col = fd.cols[s];
  if (col.value !== null) {
    sonifier.note(time, normalize(col.value, rec.columnRange), ((s + 0.5) / STEPS) * 2 - 1, col.coverage);
  }
  draw.schedule(() => {
    if (view.frame !== f) {
      view.frame = f;
      onViewFrameChange(true);
    }
    view.needle = s;
    render();
  }, time);

  step++;
  if (step >= STEPS) {
    step = 0;
    const n = nextPlayable(frame);
    if (n === null) {
      finishing = true;
      draw.schedule(() => pause(true), time + Tone.Time("16n").toSeconds());
    } else {
      frame = n;
      prefetch(frame);
    }
  }
}

async function play() {
  await sonifier.start();
  if (playing) return;
  if (atEnd) {
    frame = 0;
    step = 0;
    atEnd = false;
  }
  if (explore.on) setExplore(false);
  playing = true;
  finishing = false;
  transport.bpm.value = Number(el.speed.value);
  if (repeatId === null) repeatId = transport.scheduleRepeat(tick, "16n");
  transport.start();
  el.play.textContent = "Pause";
  if (!frames[frame]) waitFor(frame);
}

function pause(ended = false) {
  const wasPlaying = playing;
  playing = false;
  finishing = false;
  transport.stop();
  if (repeatId !== null) {
    transport.clear(repeatId);
    repeatId = null;
  }
  sonifier.stopDrone();
  el.play.textContent = "Play";
  if (ended) {
    atEnd = true;
    view.needle = -1;
    render();
    announce(`End of record. ${el.trendText.textContent ?? ""}`);
  } else if (wasPlaying) {
    announce(`Paused. ${frameSentence(view.frame, false)}`);
  }
}

function togglePlay() {
  if (playing) pause(); else void play();
}

function seek(i: number) {
  i = Math.max(0, Math.min(rec.frames.length - 1, i));
  frame = i;
  step = 0;
  atEnd = false;
  view.frame = i;
  if (!playing) view.needle = -1;
  onViewFrameChange(false);
  render();
  loadFrame(i).catch(() => announce(`${rec.frames[i].label}: NASA imagery not available for this date.`));
}

// ---------- explore by ear ----------
function setExplore(on: boolean) {
  explore.on = on;
  el.explore.setAttribute("aria-pressed", String(on));
  if (on) {
    if (playing) pause();
    void sonifier.start();
    explore.x = el.stage.width / 2;
    explore.y = el.stage.height / 2;
    explore.visible = true;
    el.stage.focus();
    announce("Explore mode on. Use the arrow keys, or move the pointer over the map. Each spot plays its value. Press E to stop.");
    probe(true);
  } else {
    explore.visible = false;
    announce("Explore mode off.");
  }
  render();
}

let probeAnnounce = 0;
function probe(force = false) {
  const fd = frames[view.frame];
  render();
  if (!fd) return;
  const now = performance.now();
  const v = valueAt(fd.grid, explore.x, explore.y);
  const pan = (explore.x / el.stage.width) * 2 - 1;
  if (v !== null && (force || now - explore.lastNote > 90)) {
    explore.lastNote = now;
    sonifier.preview(normalize(v, rec.pointRange), pan);
  }
  clearTimeout(probeAnnounce);
  probeAnnounce = window.setTimeout(() => {
    const place = formatLatLon(pixelToLatLon(rec.projection, rec.bbox, rec.width, rec.height, explore.x, explore.y));
    announce(`${place}: ${v === null ? "no data here" : rec.formatPoint(v)}`);
  }, force ? 0 : 250);
}

// ---------- audio legend ----------
async function playLegend() {
  await sonifier.start();
  if (playing) pause();
  const L = rec.legend;
  announce(
    `Audio legend for ${rec.title}. ${L.low} ${L.high} ${L.silence} ${L.drone} ` +
      `Sound moves from your left to your right as the needle crosses the map. A soft drum marks each new frame.`,
  );
  for (let k = 0; k < 8; k++) sonifier.preview(k / 7, -1 + (2 * k) / 7, 0, k * 0.22);
  sonifier.preview(0.5, 0, 0.7, 2.2); // what "rough" sounds like
}

// ---------- records ----------
function renderRecordButtons() {
  el.records.innerHTML = "";
  RECORDS.forEach((r, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "record";
    b.setAttribute("aria-pressed", String(i === recIndex));
    b.setAttribute("aria-label", `${r.title}: ${r.subtitle}`);
    b.innerHTML = `<span class="disc" aria-hidden="true"></span><span class="t"></span><span class="s"></span>`;
    b.querySelector(".t")!.textContent = `${i + 1}. ${r.title}`;
    b.querySelector(".s")!.textContent = r.subtitle;
    b.addEventListener("click", () => void selectRecord(i, true));
    el.records.append(b);
  });
}

async function selectRecord(i: number, userInitiated = false) {
  if (playing) pause();
  recIndex = i;
  rec = RECORDS[i];
  const token = ++recToken;
  frames = new Array(rec.frames.length);
  failed.clear();
  pending.clear();
  coast = null;
  weights = rowWeights(rec.projection, rec.bbox, rec.height);
  pxKm2 = pixelAreaKm2(rec.bbox, rec.width, rec.height);
  frame = 0;
  step = 0;
  atEnd = false;
  view.frame = 0;
  view.needle = -1;
  explore.x = rec.width / 2;
  explore.y = rec.height / 2;

  el.stage.width = rec.width;
  el.stage.height = rec.height;
  el.title.textContent = rec.title;
  el.story.textContent = rec.story;
  el.timeline.max = String(rec.frames.length - 1);
  el.trendText.textContent = "";
  el.trend.getContext("2d")!.clearRect(0, 0, el.trend.width, el.trend.height);
  renderRecordButtons();
  sonifier.setInstrument(rec.instrument);
  updateReadout();
  render();

  if (userInitiated) {
    announce(`${rec.title}. ${rec.subtitle}. Press space to play, or L for the audio legend.`);
  }

  el.loading.hidden = false;
  el.loading.textContent = "Loading NASA imagery…";
  void loadCoast(token);
  try {
    await loadFrame(0);
  } catch (err) {
    if (token === recToken) {
      el.loading.textContent = "Couldn't load NASA imagery. Check your connection and try again.";
      console.error(err);
    }
    return;
  }
  if (token !== recToken) return;
  el.loading.hidden = true;
  updateReadout();
  render();
  void preloadAll(token);
}

// ---------- events ----------
el.play.addEventListener("click", togglePlay);
el.prev.addEventListener("click", () => seek(view.frame - 1));
el.next.addEventListener("click", () => seek(view.frame + 1));
el.timeline.addEventListener("input", () => seek(Number(el.timeline.value)));
el.speed.addEventListener("input", () => {
  transport.bpm.value = Number(el.speed.value);
  el.speed.setAttribute("aria-valuetext", `${(Number(el.speed.value) / 200).toFixed(1)} times`);
});
el.legend.addEventListener("click", () => void playLegend());
el.explore.addEventListener("click", () => setExplore(!explore.on));
el.speak.addEventListener("click", () => {
  speakAloud = !speakAloud;
  el.speak.setAttribute("aria-pressed", String(speakAloud));
  if (!speakAloud && "speechSynthesis" in window) speechSynthesis.cancel();
  announce(speakAloud ? "Speaking aloud." : "Speech off.");
});
el.mute.addEventListener("click", () => {
  muted = !muted;
  sonifier.setMuted(muted);
  el.mute.setAttribute("aria-pressed", String(muted));
});

el.stage.addEventListener("pointermove", (e) => {
  if (!explore.on) return;
  const rect = el.stage.getBoundingClientRect();
  explore.x = ((e.clientX - rect.left) / rect.width) * el.stage.width;
  explore.y = ((e.clientY - rect.top) / rect.height) * el.stage.height;
  explore.visible = true;
  probe();
});
el.stage.addEventListener("click", () => {
  if (!explore.on) setExplore(true);
});
el.stage.addEventListener("keydown", (e) => {
  if (!explore.on) return;
  const fine = e.shiftKey ? 4 : 1;
  const dx = el.stage.width / 24 / fine, dy = el.stage.height / 16 / fine;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-dx, 0], ArrowRight: [dx, 0], ArrowUp: [0, -dy], ArrowDown: [0, dy],
  };
  const m = moves[e.key];
  if (!m) return;
  e.preventDefault();
  explore.x = Math.max(0, Math.min(el.stage.width - 1, explore.x + m[0]));
  explore.y = Math.max(0, Math.min(el.stage.height - 1, explore.y + m[1]));
  probe(true);
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (e.key === " ") {
    if (tag === "BUTTON" || tag === "SUMMARY") return; // let the focused control handle it
    e.preventDefault();
    togglePlay();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "[") seek(view.frame - 1);
  else if (k === "]") seek(view.frame + 1);
  else if (k === "l") void playLegend();
  else if (k === "e") setExplore(!explore.on);
  else if (k === "s") el.speak.click();
  else if (k === "m") el.mute.click();
  else if (/^[1-9]$/.test(k) && Number(k) <= RECORDS.length) void selectRecord(Number(k) - 1, true);
});

void selectRecord(0);
