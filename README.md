# Harmonia 🌍🎵

Hear the colours of our planet. Harmonia turns a NASA satellite image (or any image you upload) into music.

- **Explore:** the image is a matrix of squares. Move the mouse over them, or use the arrow keys, and a synth plays each square's chord.
- **Play:** hear the whole image. It is split down the middle: the left half plays in your left ear and the right half in your right.

*Ouça as cores do nosso planeta. O Harmonia transforma uma imagem de satélite da NASA (ou qualquer imagem que você enviar) em música.*

- ***Explorar:** a imagem é uma matriz de quadrados. Passe o mouse por eles, ou use as setas do teclado, e um sintetizador toca o acorde de cada quadrado.*
- ***Tocar:** ouça a imagem inteira. Ela é dividida ao meio: a metade esquerda toca no ouvido esquerdo e a direita, no direito.*

## Mapping / Mapeamento

| Image / Imagem | Sound / Som |
|---|---|
| Brighter image / Imagem mais brilhante | More treble: higher notes, brighter tone / Mais agudos |
| Mostly white (clouds, ice) / Branco predominante (nuvens, gelo) | The highest notes of all / As notas mais agudas de todas |
| Colours close together / Cores próximas | More harmonic: plain chord. Mixed colours add notes, then clash / Mais harmônico |
| Warm colours / Cores quentes | Major chord / Acorde maior |
| Cold colours / Cores frias | Minor chord / Acorde menor |
| Left / right half / Metade esquerda / direita | Left / right speaker / Caixa esquerda / direita |
| Each square of the matrix / Cada quadrado da matriz | Its own chord, by the same rules / O seu próprio acorde, pelas mesmas regras |

Details:
- **Matrix:** 8 squares across; the number of rows (2 to 8) follows the image's shape so squares stay roughly square.
  The further left a square is, the more its sound comes from the left speaker, and the same to the right: the first column is
  100% left, the last column 100% right, with even steps between. The selected-square card shows this position. Squares in the left half of
  the image play low (octaves 2–3), squares in the right half play high (octaves 4–5), and mostly white squares play above both. The chord is strummed from its lowest note up.
- **White, grey and black** areas (clouds, ice, dark sea) have almost no colour, so they count as neutral and harmonic: a plain C major chord.
- **Octaves:** the left half plays low (octaves 2–3) and the right half high (octaves 4–5), so the two chords never overlap.
- **Brightness** = average luminance → one octave up inside the half's range, plus a lowpass filter from ~500 Hz (dark) to ~11 kHz (bright).
- **White:** when more than half of an area is white (very bright pixels with almost no colour), it moves up **two** octaves instead of one:
  octave 4 on the left, octave 6 on the right. So white is always the highest sound on its side.
  Very bright halves also add the root an octave up.
- **Colour closeness** = how tightly the hues cluster on the colour wheel. Greys and whites barely count, so clouds don't make the sea "clash".
  Close colours → triad. Less close → adds 7th, then 9th, then a minor 2nd + tritone (clash), plus slight detune.
- **Warm/cold**: reds, oranges, yellows and magentas count as warm; cyans, blues and indigos as cold; greens and violets as slightly cool.
- **Piano:** a visual aid only (it makes no sound). A whole key is coloured for the left half (purple) or right half (green); an orange band at
  the bottom of a key marks the selected square, so the two never hide each other. The chords and their notes are also written out under the keyboard.
- **Roots** come from the dominant hue but always stay in one key (C major / A minor), so the two halves blend.

## Run / Rodar

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build   # static site in dist/
```

Seven NASA true-colour satellite images are built in (Namib coast, Sahara, Australian Outback, Amazon, Bahamas, Hurricane Milton, Greenland), loaded live from
[NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) with no API key. You can also drag and drop your own image onto the page.

## Code / Código

```
src/
  main.ts          wiring only: state + events          / só a ligação: estado + eventos
  i18n.ts          all text, English + Portuguese       / todo o texto, inglês + português
  core/            pure logic, no browser APIs          / lógica pura, sem APIs do navegador
    analysis.ts      image -> chords                      / imagem -> acordes
    grid.ts          image -> matrix of squares, arrows   / imagem -> matriz de quadrados, setas
    sequence.ts      which note plays when               / qual nota toca e quando
  audio/
    sonify.ts        Tone.js sound engine                 / motor de som Tone.js
  data/
    scenes.ts        NASA images + GIBS URLs + captions   / imagens da NASA + URLs + legendas
    load-image.ts    download / open / draw an image      / baixar / abrir / desenhar imagem
  ui/
    grid.ts          squares drawn over the image         / quadrados desenhados sobre a imagem
    piano.ts         piano keyboard C2-C8 (SVG)           / teclado de piano C2-C8 (SVG)
    report.ts        meters + screen-reader sentences     / medidores + frases do leitor de tela
```

Each module has a `*.test.ts` next to it (82 tests). Run them with `npm test`.
*Cada módulo tem um `*.test.ts` ao lado (82 testes). Rode com `npm test`.*

Every feature has a tag in the code comments. Search for the tag (e.g. `[F2]`) to find every part of that feature.
*Cada funcionalidade tem uma etiqueta nos comentários do código. Busque a etiqueta (ex.: `[F2]`) para achar todas as partes.*

| Tag | Feature | Funcionalidade | Files / Arquivos |
|---|---|---|---|
| `[F1]` | Brighter image → more treble | Imagem mais brilhante → mais agudos | `core/analysis`, `audio/sonify` |
| `[F2]` | Close colours → more harmonic | Cores próximas → mais harmônico | `core/analysis`, `audio/sonify` |
| `[F3]` | Warm → major, cold → minor | Quentes → maior, frias → menor | `core/analysis`, `ui/report` |
| `[F4]` | Image split in half → left / right speaker | Imagem dividida ao meio → caixa esq. / dir. | `core/analysis`, `core/sequence`, `audio/sonify` |
| `[F5]` | Left low, right high (octaves) | Esquerda grave, direita aguda (oitavas) | `core/analysis`, `ui/piano` |
| `[F6]` | Both halves in one key | As duas metades no mesmo tom | `core/analysis` |
| `[F7]` | Play / stop | Tocar / parar | `core/sequence`, `audio/sonify`, `main` |
| `[F8]` | Piano showing the chords | Piano mostrando os acordes | `ui/piano`, `main` |
| `[F9]` | NASA satellite images | Imagens de satélite da NASA | `data/scenes`, `data/load-image`, `i18n` |
| `[F10]` | Upload / drag-and-drop an image | Enviar / arrastar uma imagem | `data/load-image`, `main` |
| `[F11]` | English / Portuguese switch | Troca inglês / português | `i18n`, `main` |
| `[F12]` | Meters + screen-reader descriptions | Medidores + descrições para leitor de tela | `ui/report`, `i18n` |
| `[F13]` | Image as a matrix: hear each square with the mouse or arrow keys | Imagem como matriz: ouvir cada quadrado com o mouse ou as setas | `core/grid`, `ui/grid`, `audio/sonify`, `main` |
| `[F14]` | Mostly white → highest notes | Branco predominante → notas mais agudas | `core/analysis`, `ui/report`, `ui/piano` |

## License
Apache 2.0, see [LICENSE](LICENSE).
