// =============================================================================
// [F13] MATRIX OVERLAY  /  GRADE SOBRE A IMAGEM
// Draws the squares on top of the image. Only the page structure lives here; what each
// square sounds like is decided in core/grid.ts and played by audio/sonify.ts.
// Desenha os quadrados por cima da imagem. Só a estrutura da página fica aqui; o som de
// cada quadrado é decidido em core/grid.ts e tocado por audio/sonify.ts.
//
// Accessibility / Acessibilidade:
//   - role="grid" with rows and cells, so screen readers read "row 2, column 3"
//   - one square at a time can receive Tab focus (roving tabindex); arrows move between them
//   - cada quadrado tem um texto que o leitor de tela lê ao receber o foco
// =============================================================================
import type { GridSize } from "../core/grid";

/** Builds the squares. `labels[i]` is what a screen reader reads for square i. */
export function renderGrid(container: HTMLElement, size: GridSize, labels: readonly string[], gridLabel: string) {
  container.style.setProperty("--cols", String(size.cols));
  container.style.setProperty("--rows", String(size.rows));
  container.setAttribute("role", "grid");
  container.setAttribute("aria-label", gridLabel);
  container.setAttribute("aria-rowcount", String(size.rows));
  container.setAttribute("aria-colcount", String(size.cols));

  const rows: HTMLElement[] = [];
  for (let r = 0; r < size.rows; r++) {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.setAttribute("role", "row");
    for (let c = 0; c < size.cols; c++) {
      const index = r * size.cols + c;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.cell = String(index);
      cell.tabIndex = index === 0 ? 0 : -1;
      cell.setAttribute("aria-label", labels[index] ?? "");
      row.append(cell);
    }
    rows.push(row);
  }
  container.replaceChildren(...rows);
}

/** Updates what screen readers read, e.g. after a language change. / Atualiza os textos. */
export function setGridLabels(container: HTMLElement, labels: readonly string[], gridLabel: string) {
  container.setAttribute("aria-label", gridLabel);
  container.querySelectorAll<HTMLElement>(".cell").forEach((cell, i) => cell.setAttribute("aria-label", labels[i] ?? ""));
}

export function cellElement(container: HTMLElement, index: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`.cell[data-cell="${index}"]`);
}

/** Marks the selected square and makes it the one Tab lands on. / Marca o quadrado selecionado. */
export function setActiveCell(container: HTMLElement, index: number | null) {
  container.querySelectorAll<HTMLElement>(".cell").forEach((cell) => {
    const active = Number(cell.dataset.cell) === index;
    cell.classList.toggle("active", active);
    cell.setAttribute("aria-selected", String(active));
    // with nothing selected, the first square keeps Tab focus
    cell.tabIndex = active || (index === null && cell.dataset.cell === "0") ? 0 : -1;
  });
}

/** Which square an element (e.g. an event target) belongs to, or null. */
export function cellIndexOf(target: EventTarget | Element | null): number | null {
  const cell = target instanceof Element ? target.closest<HTMLElement>(".cell[data-cell]") : null;
  return cell ? Number(cell.dataset.cell) : null;
}
