// =============================================================================
// [F8] PIANO  /  PIANO
// A simple piano (C2 to C7) drawn as SVG. Left-half notes and right-half notes are lit in
// two colours and labelled, so you can see both chords and the octave each one plays in.
// Um piano simples (C2 a C7) desenhado em SVG. As notas da metade esquerda e da direita
// acendem em duas cores e com nome, para ver os dois acordes e a oitava de cada um.
//   createPiano -> draws the keys once / desenha as teclas uma vez
//   showChords  -> lights the chord notes [F5] and the selected square [F13]
//                  acende as notas dos acordes e do quadrado selecionado
//   pulseKey    -> flashes a key while it plays [F7] / pisca a tecla enquanto toca
// =============================================================================

export const LOWEST = 36; // C2
export const HIGHEST = 96; // C7

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);
const WHITE_W = 20, WHITE_H = 110, BLACK_W = 12, BLACK_H = 68;
const SVG_NS = "http://www.w3.org/2000/svg";

export const noteName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const isBlack = (midi: number) => BLACK.has(midi % 12);

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Draws the keyboard once. Keys carry data-midi so they can be lit later. */
export function createPiano(container: HTMLElement): SVGSVGElement {
  // x position of every white key, and of each black key between two whites
  const xs = new Map<number, number>();
  let whiteIndex = 0;
  for (let m = LOWEST; m <= HIGHEST; m++) {
    if (isBlack(m)) xs.set(m, whiteIndex * WHITE_W - BLACK_W / 2);
    else xs.set(m, whiteIndex++ * WHITE_W);
  }
  const width = whiteIndex * WHITE_W;
  const svg = el("svg", { viewBox: `0 0 ${width} ${WHITE_H + 2}`, class: "piano", role: "img" });

  // white keys first, black keys on top
  for (const black of [false, true]) {
    for (let m = LOWEST; m <= HIGHEST; m++) {
      if (isBlack(m) !== black) continue;
      const g = el("g", { class: `key ${black ? "black" : "white"}`, "data-midi": m });
      g.append(el("rect", {
        x: xs.get(m)! + (black ? 0 : 0.5), y: 0.5, rx: 2,
        width: black ? BLACK_W : WHITE_W - 1, height: black ? BLACK_H : WHITE_H,
      }));
      const label = el("text", {
        x: xs.get(m)! + (black ? BLACK_W : WHITE_W) / 2,
        y: black ? BLACK_H - 6 : WHITE_H - 8,
        "text-anchor": "middle",
      });
      // C keys always show their name, so the octaves are easy to count
      // As teclas Dó sempre mostram o nome, para facilitar contar as oitavas
      if (m % 12 === 0) {
        label.textContent = noteName(m);
        g.classList.add("c-key");
      }
      g.append(label);
      svg.append(g);
    }
  }
  container.replaceChildren(svg);
  return svg;
}

/** Lights the notes of the left chord and the right chord. */
export function showChords(
  svg: SVGSVGElement, left: number[], right: number[], ariaLabel: string, cursor: number[] = [],
) {
  const l = new Set(left), r = new Set(right), c = new Set(cursor);
  svg.querySelectorAll<SVGGElement>(".key").forEach((g) => {
    const m = Number(g.dataset.midi);
    const inL = l.has(m), inR = r.has(m), inC = c.has(m);
    g.classList.toggle("on-left", inL && !inR);
    g.classList.toggle("on-right", inR && !inL);
    g.classList.toggle("on-both", inL && inR);
    // [F13] notes of the square under the cursor (drawn on top of the other colours)
    //       notas do quadrado sob o cursor (desenhadas por cima das outras cores)
    g.classList.toggle("on-cursor", inC);
    const text = g.querySelector("text")!;
    text.textContent = inL || inR || inC ? noteName(m) : m % 12 === 0 ? noteName(m) : "";
  });
  svg.setAttribute("aria-label", ariaLabel);
}

/** Briefly highlights a key as it is played. */
export function pulseKey(svg: SVGSVGElement, midi: number) {
  const g = svg.querySelector<SVGGElement>(`.key[data-midi="${midi}"]`);
  if (!g) return;
  g.classList.add("hit");
  setTimeout(() => g.classList.remove("hit"), 140);
}
