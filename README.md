# Harmonia · Earth Jukebox 🌍🎵

Hear NASA's satellite view of our changing planet. Pick a **record**, press play, and a needle sweeps
each map from left to right, turning real NASA data into music in real time.

| Record | NASA data | What you hear |
|---|---|---|
| **1. Planet Fever** | MERRA-2 air temperature, every July 1980 → 2025 | Hot places = high notes. The drone rises as the global average warms. |
| **2. Vanishing Ice** | SSMIS sea ice, every September 1979 → 2020 | Bells where there's ice, silence over open water. The drone sinks as the ice shrinks (6.9 → 3.6 million km²). |
| **3. Breathing Planet** | MODIS NDVI vegetation, every month of 2024 | Plucked notes over land (greener = higher), silent oceans. Hear the seasons. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the data maths
npm run build      # static site in dist/ (deploy to Cloudflare Pages, Vercel, GitHub Pages…)
```

No API keys and no backend: images come straight from NASA GIBS, which allows browser access (CORS).

## How it works

```
NASA GIBS (WMS image for one date)
   → canvas pixels
   → GIBS colormap XML: colour → real value (°C, % ice, NDVI)   src/colormap.ts
   → maths: 32 needle slices + one summary number per frame     src/analysis.ts
   → Tone.js: notes, pan, drone, roughness                      src/sonify.ts
   → UI, keyboard, screen-reader narration                      src/main.ts
```

### Sonification mapping

| Data | Sound |
|---|---|
| Value of each needle slice | Pitch (C pentatonic, 3 octaves) |
| Horizontal position | Stereo pan, left → right |
| Data coverage / amount of ice | Loudness |
| No data (ocean for NDVI, open water for ice) | Silence |
| Frame summary vs first frame | Drone pitch (±7 semitones) and distortion ("roughness") |
| New frame (year/month) | Soft drum beat |

### Scientific notes
- Every value is decoded from GIBS's official colormap, not guessed from the colours.
- Global averages are **area-weighted** by cos(latitude), because a lat/lon pixel near the pole covers less area.
- Sea ice extent uses the standard **15 % concentration** threshold. The satellite "pole hole" counts as ice,
  as NSIDC does, because it shrank in 1987 and would otherwise distort the trend.
- Values are quantised by the colormap (e.g. 1 K bins for temperature), so treat them as good approximations.

## Accessibility
- Everything works by keyboard: <kbd>Space</kbd> play/pause, <kbd>[</kbd> <kbd>]</kbd> frames,
  <kbd>1</kbd>–<kbd>3</kbd> records, <kbd>L</kbd> audio legend, <kbd>E</kbd> explore by ear
  (then arrow keys, <kbd>Shift</kbd> for small steps), <kbd>S</kbd> speak aloud, <kbd>M</kbd> mute.
- Screen readers hear each frame's numbers through a live region. The map's `aria-label` always describes the current frame.
- **Audio legend** explains what high, low, silence and the drone mean before you listen.
- **Explore by ear**: move around the map and hear the value, plus place and value read out.
- **Speak aloud** uses the browser's speech for listeners without a screen reader.
- Respects reduced-motion settings. All controls are at least 44 px tall, with visible focus outlines.

## Adding a record (≈ 20 minutes)
1. Find a layer in [NASA Worldview](https://worldview.earthdata.nasa.gov) and note its layer ID (the "i" info panel).
2. Find its colormap name in the [GIBS WMTS capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml)
   (search the layer ID, then look for `colormaps/v1.3/<name>.xml`).
3. Check the dates the layer has (its `<Dimension>` / `<Value>` entries), then copy a block in `src/records.ts`.
4. Tune `pointRange`, `columnRange` and `changeScale` by ear.

Good next candidates: `GHRSST_L4_MUR_Sea_Surface_Temperature` (El Niño), `MERRA2_*` CO / aerosol layers, fire layers.

## Ideas for the rest of the hackathon
- Compare two years: 1990 in the left ear, 2024 in the right.
- Export a sonification as `.wav` (Tone.Recorder) or MIDI.
- Category instruments (land/ocean/ice) and a richer second voice for the rows (latitude bands).
- Phone vibration on big anomalies (`navigator.vibrate`).
- Test with blind and low-vision listeners and put their quotes in the pitch.

## Credits
Imagery: NASA Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).
Datasets: MERRA-2 (NASA GMAO), SSMIS/SSM/I sea ice concentration (NSIDC), MODIS Terra NDVI (NASA LP DAAC).
Audio: [Tone.js](https://tonejs.github.io).

## License
Apache 2.0, see [LICENSE](LICENSE).
