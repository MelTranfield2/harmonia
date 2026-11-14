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
- **Brightness** = average luminance → octave 3 to 5, plus a lowpass filter from ~500 Hz (dark) to ~11 kHz (bright).
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

The NASA example is the Namib Desert meeting the Atlantic (MODIS Terra true colour, 10 May 2024), loaded live from
[NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) with no API key. You can also drag and drop your own image onto the page.

## Code

- `src/analysis.ts`: image → brightness, warmth, colour closeness → chord (pure functions, tested)
- `src/sonify.ts`: Tone.js, with one voice per half, each panned left or right
- `src/main.ts`: page, image loading, upload, meters

## License
Apache 2.0, see [LICENSE](LICENSE).
