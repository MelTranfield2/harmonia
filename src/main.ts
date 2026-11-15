// =============================================================================
// HARMONIA - app entry point / ponto de entrada do app
// This file only wires the modules to the page: it holds the state and reacts to clicks.
// The work itself lives in the modules below.
// Este arquivo só liga os módulos à página: guarda o estado e reage aos cliques.
// O trabalho em si fica nos módulos abaixo.
//
//   core/   pure logic, no browser APIs, fully tested   / lógica pura, sem APIs do navegador, testada
//   audio/  sound (Tone.js)                              / som (Tone.js)
//   data/   NASA images and image loading                / imagens da NASA e carregamento
//   ui/     piano, meters, descriptions                  / piano, medidores, descrições
//   i18n.ts all text in English and Portuguese           / todo o texto em inglês e português
//
// FEATURE MAP / MAPA DE FUNCIONALIDADES  (search the tag / busque a etiqueta)
//   [F1]  Brighter image -> more treble        Imagem mais brilhante -> mais agudos      core/analysis, audio/sonify
//   [F2]  Close colours -> more harmonic       Cores próximas -> mais harmônico          core/analysis, audio/sonify
//   [F3]  Warm -> major, cold -> minor         Quentes -> maior, frias -> menor          core/analysis
//   [F4]  Image split in half -> left/right    Imagem dividida ao meio -> esq./dir.      core/analysis, audio/sonify
//   [F5]  Left low, right high (octaves)       Esquerda grave, direita aguda (oitavas)   core/analysis
//   [F6]  Both halves in one key               As duas metades no mesmo tom              core/analysis
//   [F7]  Play / stop                          Tocar / parar                             core/sequence, audio/sonify
//   [F8]  Piano showing the chords             Piano mostrando os acordes                ui/piano
//   [F9]  NASA satellite images                Imagens de satélite da NASA               data/scenes, i18n
//   [F10] Upload / drag-and-drop an image      Enviar / arrastar uma imagem              data/load-image, main
//   [F11] English / Portuguese switch          Troca inglês / português                  i18n, main
//   [F12] Meters + screen-reader descriptions  Medidores + descrições p/ leitor de tela  ui/report
//   [F13] Image as a matrix: hear each square  Imagem como matriz: ouvir cada quadrado   core/grid, ui/grid, audio/sonify
//         with the mouse or the arrow keys     com o mouse ou as setas do teclado
//   [F14] Mostly white -> highest notes        Branco predominante -> notas mais agudas  core/analysis, ui/report
// =============================================================================
import "./style.css";
import { Harmonia } from "./audio/sonify";
import { analyzeHalves, buildChord, type Chord, type RegionAnalysis } from "./core/analysis";
import { analyzeGrid, gridSize, moveCell, NAV_KEYS, type Cell, type GridSize } from "./core/grid";
import { drawImage, loadImageFromFile, loadImageFromUrl } from "./data/load-image";
import { SCENES, sceneCaption, sceneUrl } from "./data/scenes";
import { initialLang, saveLang, SCENE_TEXT, STRINGS, type Lang } from "./i18n";
import { cellElement, cellIndexOf, renderGrid, setActiveCell, setGridLabels } from "./ui/grid";
import { createPiano, noteName, pulseKey, showChords } from "./ui/piano";
import { chordHtml, describeHalf, meterHtml, meters, panMeter } from "./ui/report";

// ---------- page elements / elementos da página ----------
const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const el = {
  stage: $<HTMLCanvasElement>("stage"),
  caption: $("caption"),
  status: $("status"),
  live: $("live"),
  play: $<HTMLButtonElement>("play"),
  file: $<HTMLInputElement>("file"),
  drop: $("drop"),
  scenes: $("scenes"),
  piano: $("piano"),
  grid: $("grid"),
  gridHint: $("grid-hint"),
  cellCard: $("cell-h").parentElement as HTMLElement,
  cellPos: $("cell-pos"),
  cellChord: $("cell-chord"),
  cellMeters: $("cell-meters"),
};

// ---------- state / estado ----------
type Source = { kind: "scene"; index: number } | { kind: "file"; name: string };
type Status = { kind: "loading"; index: number } | { kind: "loadError" | "fileError" };

const state = {
  lang: initialLang() as Lang,
  playing: false,
  /** NASA image highlighted in the picker (null when showing an uploaded file) */
  selectedScene: 0 as number | null,
  /** what is on screen, so the caption can be re-translated */
  source: null as Source | null,
  status: null as Status | null,
  halves: null as Record<"left" | "right", RegionAnalysis> | null,
  chords: null as Record<"left" | "right", Chord> | null,
  /** [F13] the image as a matrix of squares / a imagem como matriz de quadrados */
  grid: null as { size: GridSize; cells: Cell[] } | null,
  /** [F13] the selected square (mouse or arrow keys) / o quadrado selecionado */
  activeCell: null as number | null,
  /** [F13] the square the mouse is over, so moving inside one square doesn't replay it */
  hoverCell: null as number | null,
  /** bumps on every new image, so a slow download can't replace a newer pick */
  loadToken: 0,
};

const T = () => STRINGS[state.lang];
const engine = new Harmonia();
const piano = createPiano(el.piano);

// ---------- [F12] screen reader / leitor de tela ----------
function announce(text: string) {
  el.live.textContent = "";
  requestAnimationFrame(() => (el.live.textContent = text));
}

// ---------- rendering: state -> page / desenhar: estado -> página ----------
function renderStatus() {
  const s = state.status;
  el.status.textContent = !s ? "" : s.kind === "loading" ? T().loading(SCENE_TEXT[state.lang][s.index].title) : T()[s.kind];
}

function renderCaption() {
  const s = state.source;
  const text = !s ? "" : s.kind === "scene" ? sceneCaption(s.index, state.lang) : T().yourImage(s.name);
  el.caption.textContent = text;
  el.stage.setAttribute("aria-label", text || T().imageAlt);
}

// [F9] buttons to pick a NASA image / botões para escolher a imagem
function renderScenePicker() {
  el.scenes.replaceChildren(
    ...SCENE_TEXT[state.lang].map((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.title;
      b.setAttribute("aria-pressed", String(i === state.selectedScene));
      b.addEventListener("click", () => void showScene(i));
      return b;
    }),
  );
}

// [F12] chord + meters for each half / acorde + medidores de cada metade
function renderHalves() {
  const { halves, chords } = state;
  if (!halves || !chords) return;
  for (const side of ["left", "right"] as const) {
    $(`${side}-chord`).innerHTML = chordHtml(T(), chords[side]);
    $(`${side}-meters`).innerHTML = meters(T(), halves[side], chords[side]).map(meterHtml).join("");
  }
}

// [F8] light both chords on the piano, plus the selected square [F13]
//      acende os dois acordes no piano, mais o quadrado selecionado
function renderPiano() {
  const { chords } = state;
  if (!chords) return;
  const label = (c: Chord) => `${c.name} (${c.notes.map(noteName).join(" ")})`;
  showChords(
    piano, chords.left.notes, chords.right.notes,
    T().pianoLabel(label(chords.left), label(chords.right)),
    activeCell()?.chord.notes ?? [],
  );
}

// ---------- [F13] matrix of squares / matriz de quadrados ----------
const activeCell = (): Cell | null =>
  state.grid && state.activeCell !== null ? state.grid.cells[state.activeCell] : null;

/** What a screen reader reads for one square. / O que o leitor de tela lê para um quadrado. */
const cellLabel = (c: Cell) => `${T().cellPosition(c.row + 1, c.col + 1)}. ${describeHalf(T(), c.analysis, c.chord)}`;

function renderGridLabels() {
  const g = state.grid;
  if (g) setGridLabels(el.grid, g.cells.map(cellLabel), T().gridLabel(g.size.cols, g.size.rows));
}

function renderGridHint() {
  el.gridHint.textContent = engine.started ? T().gridHintSoundOn : T().gridHintSoundOff;
}

// Card with the selected square's chord and meters / cartão com o acorde e os medidores do quadrado
function renderCell() {
  const c = activeCell();
  el.cellCard.classList.toggle("empty", !c);
  el.cellPos.textContent = c ? T().cellPosition(c.row + 1, c.col + 1) : "";
  el.cellChord.innerHTML = c ? chordHtml(T(), c.chord) : T().cellNone;
  // the three rule meters, plus [F4] where the square sits between the speakers
  // os três medidores das regras, mais a posição do quadrado entre as caixas
  el.cellMeters.innerHTML = c ? [...meters(T(), c.analysis, c.chord), panMeter(T(), c.pan)].map(meterHtml).join("") : "";
}

// [F11] every piece of text in the chosen language / todo o texto no idioma escolhido
function renderLanguage() {
  const t = T();
  document.documentElement.lang = t.htmlLang;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((e) => (e.textContent = t.page[e.dataset.i18n!]));
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((e) => (e.innerHTML = t.page[e.dataset.i18nHtml!]));
  document.querySelectorAll<HTMLElement>("[data-i18n-label]").forEach((e) => e.setAttribute("aria-label", t.page[e.dataset.i18nLabel!]));
  document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
  el.play.textContent = state.playing ? t.stop : t.play;
}

function renderAll() {
  renderLanguage();
  renderScenePicker();
  renderCaption();
  renderStatus();
  renderHalves();
  renderGridLabels();
  renderGridHint();
  renderCell();
  renderPiano();
}

// ---------- actions / ações ----------
function setStatus(status: Status | null) {
  state.status = status;
  renderStatus();
}

/** Image on screen -> analysis -> chords -> sound + page. / Imagem -> análise -> acordes -> som + página. */
function useImage(img: ImageBitmap, source: Source) {
  state.source = source;
  const pixels = drawImage(el.stage, img);
  // [F4] split in half, [F5] left low / right high
  const halves = analyzeHalves(pixels.data, pixels.width, pixels.height);
  const chords = { left: buildChord(halves.left, "low"), right: buildChord(halves.right, "high") };
  state.halves = halves;
  state.chords = chords;
  engine.setChords(chords.left, chords.right);
  // [F13] the image as a matrix: every square gets its own analysis and chord
  //       a imagem como matriz: cada quadrado ganha a sua análise e o seu acorde
  const size = gridSize(pixels.width, pixels.height);
  const cells = analyzeGrid(pixels.data, pixels.width, pixels.height, size);
  state.grid = { size, cells };
  state.activeCell = null;
  state.hoverCell = null;
  renderGrid(el.grid, size, cells.map(cellLabel), T().gridLabel(size.cols, size.rows));
  renderCaption();
  renderHalves();
  renderCell();
  renderPiano();
  announce(T().halves(describeHalf(T(), halves.left, chords.left), describeHalf(T(), halves.right, chords.right)));
}

// [F9] load a NASA image / carrega uma imagem da NASA
async function showScene(index: number) {
  const token = ++state.loadToken;
  state.selectedScene = index;
  renderScenePicker();
  setStatus({ kind: "loading", index });
  try {
    const img = await loadImageFromUrl(sceneUrl(SCENES[index]));
    if (token !== state.loadToken) return; // a newer image was picked meanwhile
    useImage(img, { kind: "scene", index });
    setStatus(null);
  } catch {
    if (token === state.loadToken) setStatus({ kind: "loadError" });
  }
}

// [F10] load the user's own image / carrega a imagem da pessoa
async function showFile(file: File) {
  const token = ++state.loadToken;
  try {
    const img = await loadImageFromFile(file);
    if (!img || token !== state.loadToken) return;
    state.selectedScene = null;
    renderScenePicker();
    useImage(img, { kind: "file", name: file.name });
    setStatus(null);
  } catch {
    if (token === state.loadToken) setStatus({ kind: "fileError" });
  }
}

// [F13] select a square: show it, light its notes on the piano, and play it
//       seleciona um quadrado: mostra, acende as notas no piano e toca
function selectCell(index: number, opts: { play: boolean }) {
  const cell = state.grid?.cells[index];
  if (!cell) return;
  if (state.activeCell !== index) {
    state.activeCell = index;
    setActiveCell(el.grid, index);
    renderCell();
    renderPiano();
  }
  if (opts.play) engine.playCell(cell.chord, cell.pan); // silent until the sound is on
}

/** Browsers need a click or key press before sound; this turns it on. / Liga o som (precisa de clique ou tecla). */
async function ensureSound() {
  if (engine.started) return;
  await engine.start();
  renderGridHint();
}

// [F7] play / stop / tocar / parar
async function togglePlay() {
  if (state.playing) {
    engine.stop();
    state.playing = false;
  } else {
    await ensureSound();
    engine.play();
    state.playing = true;
  }
  el.play.textContent = state.playing ? T().stop : T().play;
}

// [F11] switch language / troca o idioma
function setLanguage(lang: Lang) {
  if (lang === state.lang) return;
  state.lang = lang;
  saveLang(lang);
  renderAll();
  announce(T().switched);
}

// ---------- events / eventos ----------
// [F7] on every note: flash that half of the image [F4] and light the piano key [F8]
engine.onStep = (side, time, midi) =>
  Harmonia.draw(() => {
    const flash = $(`flash-${side}`);
    flash.classList.add("on");
    setTimeout(() => flash.classList.remove("on"), 90);
    pulseKey(piano, midi);
  }, time);

el.play.addEventListener("click", () => void togglePlay());

document.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) =>
  b.addEventListener("click", () => setLanguage(b.dataset.lang as Lang)),
);

// [F13] mouse: moving onto a new square plays it / mouse: entrar em um quadrado novo toca ele
el.grid.addEventListener("pointermove", (e) => {
  // elementFromPoint also works for touch, where the event target stays on the first square
  const index = cellIndexOf(document.elementFromPoint(e.clientX, e.clientY));
  if (index === null || index === state.hoverCell) return;
  state.hoverCell = index;
  selectCell(index, { play: true });
});
el.grid.addEventListener("pointerleave", () => (state.hoverCell = null));

// [F13] click / tap: turns the sound on the first time, then plays the square
//       clique / toque: liga o som na primeira vez e toca o quadrado
el.grid.addEventListener("pointerdown", async (e) => {
  const index = cellIndexOf(e.target);
  if (index === null) return;
  state.hoverCell = index;
  await ensureSound();
  selectCell(index, { play: true });
});

// [F13] arrow keys move between squares; Enter / Space plays the square again
//       as setas andam pelos quadrados; Enter / Espaço toca o quadrado de novo
el.grid.addEventListener("keydown", async (e) => {
  const g = state.grid;
  const current = cellIndexOf(e.target);
  if (!g || current === null) return;
  const replay = e.key === "Enter" || e.key === " ";
  if (!NAV_KEYS.has(e.key) && !replay) return;
  e.preventDefault();
  e.stopPropagation(); // so Space here doesn't also press Play
  const next = replay ? current : moveCell(current, e.key, g.size);
  await ensureSound();
  selectCell(next, { play: true });
  cellElement(el.grid, next)?.focus();
});

// [F13] Tab into the matrix: show that square without playing it
el.grid.addEventListener("focusin", (e) => {
  const index = cellIndexOf(e.target);
  if (index !== null) selectCell(index, { play: false });
});

// [F10] upload button and drag-and-drop / botão de enviar e arrastar-e-soltar
el.file.addEventListener("change", () => {
  const f = el.file.files?.[0];
  if (f) void showFile(f);
});
el.drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  el.drop.classList.add("dragging");
});
el.drop.addEventListener("dragleave", () => el.drop.classList.remove("dragging"));
el.drop.addEventListener("drop", (e) => {
  e.preventDefault();
  el.drop.classList.remove("dragging");
  const f = e.dataTransfer?.files?.[0];
  if (f) void showFile(f);
});

// [F7] space bar = play / stop, unless a button or field has focus
document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.key === " " && tag !== "BUTTON" && tag !== "INPUT") {
    e.preventDefault();
    void togglePlay();
  }
});

// ---------- start / início ----------
renderAll();
void showScene(0);
