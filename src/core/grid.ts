// =============================================================================
// [F13] IMAGE AS A MATRIX  /  IMAGEM COMO MATRIZ
// The image is divided into squares. Each square is analysed with the same rules as the
// halves ([F1] brightness, [F2] close colours, [F3] warm/cold) and gets its own chord.
// A imagem é dividida em quadrados. Cada quadrado é analisado com as mesmas regras das
// metades (brilho, cores próximas, quente/frio) e ganha o seu próprio acorde.
//
//   [F4] column -> stereo position (left .. right)   / coluna -> posição no estéreo
//   [F5] left half of the matrix plays low, right half plays high
//        metade esquerda da matriz toca grave, metade direita toca aguda
// Pure: no DOM, no audio. / Puro: sem DOM, sem áudio.
// =============================================================================
import { analyzeRect, buildChord, type Chord, type Rect, type RegionAnalysis, type Zone } from "./analysis";

/** Squares across the image. Rows follow the image's shape so squares stay roughly square. */
export const GRID_COLS = 8;
const MIN_ROWS = 2;
const MAX_ROWS = 8;

export interface GridSize {
  cols: number;
  rows: number;
}

export interface Cell {
  /** 0-based, counted left to right, top to bottom / da esquerda para a direita, de cima para baixo */
  index: number;
  row: number;
  col: number;
  analysis: RegionAnalysis;
  chord: Chord;
  /** -1 (left) .. +1 (right) */
  pan: number;
  zone: Zone;
}

/** How many squares fit: a wide image gets fewer rows. / Imagem larga tem menos linhas. */
export function gridSize(width: number, height: number, cols = GRID_COLS): GridSize {
  const rows = Math.round((cols * height) / Math.max(1, width));
  return { cols, rows: Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows)) };
}

/** Pixel rectangle of one square. Squares tile the image with no gaps and no overlap. */
export function cellRect(index: number, size: GridSize, width: number, height: number): Rect {
  const col = index % size.cols, row = Math.floor(index / size.cols);
  return {
    x0: Math.floor((col * width) / size.cols),
    x1: Math.floor(((col + 1) * width) / size.cols),
    y0: Math.floor((row * height) / size.rows),
    y1: Math.floor(((row + 1) * height) / size.rows),
  };
}

/**
 * [F4] The further left a square is, the more its sound comes from the left speaker, and the
 * same to the right: first column fully left (-1), last column fully right (+1), even steps between.
 * Quanto mais à esquerda o quadrado, mais o som sai da caixa esquerda, e o mesmo para a direita:
 * primeira coluna toda à esquerda (-1), última toda à direita (+1), passos iguais no meio.
 */
export function panForColumn(col: number, cols: number, max = 1): number {
  if (cols <= 1) return 0;
  return ((col / (cols - 1)) * 2 - 1) * max;
}

/** [F5] Left half of the matrix -> low octaves, right half -> high octaves. */
export function zoneForColumn(col: number, cols: number): Zone {
  return col < cols / 2 ? "low" : "high";
}

/** Analyses every square and builds its chord. / Analisa cada quadrado e monta o acorde. */
export function analyzeGrid(
  data: Uint8ClampedArray, width: number, height: number, size: GridSize, stride = 2,
): Cell[] {
  const cells: Cell[] = [];
  for (let index = 0; index < size.cols * size.rows; index++) {
    const col = index % size.cols, row = Math.floor(index / size.cols);
    const analysis = analyzeRect(data, width, cellRect(index, size, width, height), stride);
    const zone = zoneForColumn(col, size.cols);
    cells.push({ index, row, col, analysis, chord: buildChord(analysis, zone), pan: panForColumn(col, size.cols), zone });
  }
  return cells;
}

/**
 * Where an arrow key takes you. Stops at the edges (no wrap-around), so "left" always
 * means left. Home / End jump to the start / end of the row.
 * Para onde a seta leva. Para nas bordas (não dá a volta). Home / End vão ao início / fim da linha.
 */
export function moveCell(index: number, key: string, size: GridSize): number {
  const col = index % size.cols, row = Math.floor(index / size.cols);
  switch (key) {
    case "ArrowLeft": return col > 0 ? index - 1 : index;
    case "ArrowRight": return col < size.cols - 1 ? index + 1 : index;
    case "ArrowUp": return row > 0 ? index - size.cols : index;
    case "ArrowDown": return row < size.rows - 1 ? index + size.cols : index;
    case "Home": return row * size.cols;
    case "End": return row * size.cols + size.cols - 1;
    default: return index;
  }
}

export const NAV_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
