# Harmonia 🌍🎵

Hear the colours of our planet. Harmonia turns a NASA satellite image (or any image you upload)
into music. The image is split down the middle: the left half plays in your left ear and the right half in your right.

*Ouça as cores do nosso planeta. O Harmonia transforma uma imagem de satélite da NASA (ou qualquer imagem que você enviar)
em música. A imagem é dividida ao meio: a metade esquerda toca no ouvido esquerdo e a direita, no direito.*

## Mapping / Mapeamento

| Image / Imagem | Sound / Som |
|---|---|
| Brighter image / Imagem mais brilhante | More treble: higher notes, brighter tone / Mais agudos |
| Colours close together / Cores próximas | More harmonic: plain chord. Mixed colours add notes, then clash / Mais harmônico |
| Warm colours / Cores quentes | Major chord / Acorde maior |
| Cold colours / Cores frias | Minor chord / Acorde menor |
| Left / right half / Metade esquerda / direita | Left / right speaker / Caixa esquerda / direita |

Details:
- **Octaves:** the left half plays low (octaves 2–3) and the right half high (octaves 4–5), so the two chords never overlap.
- **Brightness** = average luminance → one octave up inside the half's range, plus a lowpass filter from ~500 Hz (dark) to ~11 kHz (bright).
  Very bright halves also add the root an octave up.
- **Colour closeness** = how tightly the hues cluster on the colour wheel. Greys and whites barely count, so clouds don't make the sea "clash".
  Close colours → triad. Less close → adds 7th, then 9th, then a minor 2nd + tritone (clash), plus slight detune.
- **Warm/cold**: reds, oranges, yellows and magentas count as warm; cyans, blues and indigos as cold; greens and violets as slightly cool.
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

Every feature has a tag in the code comments. Search for the tag (e.g. `[F2]`) to find every part of that feature.
*Cada funcionalidade tem uma etiqueta nos comentários do código. Busque a etiqueta (ex.: `[F2]`) para achar todas as partes.*

| Tag | Feature | Funcionalidade | Files / Arquivos |
|---|---|---|---|
| `[F1]` | Brighter image → more treble | Imagem mais brilhante → mais agudos | `analysis.ts`, `sonify.ts` |
| `[F2]` | Close colours → more harmonic | Cores próximas → mais harmônico | `analysis.ts`, `sonify.ts` |
| `[F3]` | Warm → major, cold → minor | Quentes → maior, frias → menor | `analysis.ts` |
| `[F4]` | Image split in half → left / right speaker | Imagem dividida ao meio → caixa esq. / dir. | `analysis.ts`, `sonify.ts`, `main.ts` |
| `[F5]` | Left low, right high (octaves) | Esquerda grave, direita aguda (oitavas) | `analysis.ts`, `piano.ts` |
| `[F6]` | Both halves in one key | As duas metades no mesmo tom | `analysis.ts` |
| `[F7]` | Play / stop | Tocar / parar | `sonify.ts`, `main.ts` |
| `[F8]` | Piano showing the chords | Piano mostrando os acordes | `piano.ts`, `main.ts` |
| `[F9]` | NASA satellite images | Imagens de satélite da NASA | `main.ts`, `i18n.ts` |
| `[F10]` | Upload / drag-and-drop an image | Enviar / arrastar uma imagem | `main.ts` |
| `[F11]` | English / Portuguese switch | Troca inglês / português | `i18n.ts`, `main.ts` |
| `[F12]` | Meters + screen-reader descriptions | Medidores + descrições para leitor de tela | `main.ts`, `i18n.ts` |

All files are in `src/`. `analysis.ts` is pure maths with unit tests in `analysis.test.ts`.
*Todos os arquivos ficam em `src/`. O `analysis.ts` é só matemática, com testes em `analysis.test.ts`.*

## License
Apache 2.0, see [LICENSE](LICENSE).
