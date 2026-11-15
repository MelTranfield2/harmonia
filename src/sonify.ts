// =============================================================================
// SOUND ENGINE (Tone.js)  /  MOTOR DE SOM (Tone.js)
//
// Features in this file / Funcionalidades neste arquivo:
//   [F1] Brightness -> brighter tone (filter)   / Brilho -> timbre mais brilhante (filtro)
//   [F2] Mixed colours -> slight detune          / Cores misturadas -> leve desafinação
//   [F4] Left half -> left speaker, right -> right / Metade esquerda -> caixa esquerda, direita -> direita
//   [F7] Play / stop loop (pad + arpeggio)       / Tocar / parar (acorde de fundo + arpejo)
//
// Two voices, one per half of the image. Each voice holds a soft chord (pad) and plays an
// arpeggio over it. Left and right take turns on the arpeggio so you can hear the split.
// Duas vozes, uma por metade da imagem. Cada voz segura um acorde suave (pad) e toca um arpejo
// por cima. Esquerda e direita se revezam no arpejo para dar para ouvir a divisão.
// =============================================================================
import * as Tone from "tone";
import type { Chord } from "./analysis";

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** One half of the image = one voice. / Uma metade da imagem = uma voz. */
class Voice {
  readonly pad: Tone.PolySynth;
  readonly arp: Tone.PolySynth;
  readonly filter: Tone.Filter;
  readonly panner: Tone.Panner;
  chord: Chord | null = null;

  constructor(pan: number, out: Tone.ToneAudioNode) {
    // [F4] stereo position: -1 = left, +1 = right / posição no estéreo: -1 = esquerda, +1 = direita
    this.panner = new Tone.Panner(pan).connect(out);
    // [F1] lowpass filter: opened wider for brighter images / filtro passa-baixa: mais aberto se mais brilho
    this.filter = new Tone.Filter(2000, "lowpass").connect(this.panner);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 10 },
      envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 },
      volume: -20,
    }).connect(this.filter);
    this.arp = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 },
      volume: -12,
    }).connect(this.filter);
  }

  set(chord: Chord, time?: number) {
    this.chord = chord;
    // [F1] brighter image -> more treble / imagem mais brilhante -> mais agudos
    this.filter.frequency.rampTo(chord.cutoff, 0.3, time);
    // [F2] varied colours -> slightly out-of-tune, rougher sound
    //      cores variadas -> um pouco desafinado, som mais áspero
    const detune = chord.dissonance * 30;
    this.pad.set({ detune });
    this.arp.set({ detune: -detune / 2 });
  }

  dispose() {
    this.pad.dispose();
    this.arp.dispose();
    this.filter.dispose();
    this.panner.dispose();
  }
}

// [F7] The player  ·  O tocador
export class Harmonia {
  private started = false;
  private left?: Voice;
  private right?: Voice;
  private master?: Tone.Volume;
  private loop?: Tone.Loop;
  private step = 0;
  /** called on each eighth note with which side is playing, for visuals */
  onStep?: (side: "left" | "right", time: number, midi: number) => void;

  // Browsers only allow audio after a click, so this runs on the first Play.
  // Navegadores só liberam áudio depois de um clique, então isto roda no primeiro "Tocar".
  async start() {
    if (this.started) return;
    await Tone.start();
    this.master = new Tone.Volume(-4).toDestination();
    const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.3 }).connect(this.master);
    await reverb.ready;
    // [F4] left half almost fully left, right half almost fully right
    //      metade esquerda quase toda à esquerda, metade direita quase toda à direita
    this.left = new Voice(-0.85, reverb);
    this.right = new Voice(0.85, reverb);
    const transport = Tone.getTransport();
    transport.bpm.value = 84;
    this.loop = new Tone.Loop((time) => this.tick(time), "8n");
    this.started = true;
  }

  setChords(left: Chord, right: Chord) {
    if (!this.left || !this.right) return;
    this.left.set(left);
    this.right.set(right);
  }

  // [F7] Runs on every eighth note (8 per bar). / Roda a cada colcheia (8 por compasso).
  private tick(time: number) {
    const s = this.step++ % 8;
    const voices = [this.left!, this.right!];
    if (s === 0) {
      // new bar: both pads restrike their chords / novo compasso: os dois acordes de fundo tocam de novo
      for (const v of voices) if (v.chord) v.pad.triggerAttackRelease(v.chord.notes.map(midiToFreq), "1m", time, 0.6);
    }
    // [F4] left plays on the beat, right off the beat / esquerda no tempo, direita no contratempo
    const side = s % 2 === 0 ? "left" : "right";
    const v = side === "left" ? this.left! : this.right!;
    if (!v.chord) return;
    const notes = v.chord.notes;
    const idx = Math.floor(s / 2) % notes.length;
    const note = notes[(idx + (side === "right" ? 1 : 0)) % notes.length];
    // [F8] play the chord note itself, so what you hear is exactly what the piano shows
    //      toca a própria nota do acorde, para o som ser exatamente o que o piano mostra
    v.arp.triggerAttackRelease(midiToFreq(note), "8n", time, 0.7);
    this.onStep?.(side, time, note); // -> main.ts lights the key / acende a tecla
  }

  play() {
    if (!this.loop) return;
    this.step = 0;
    this.loop.start(0);
    Tone.getTransport().start();
  }

  stop() {
    this.loop?.stop();
    Tone.getTransport().stop();
    this.left?.pad.releaseAll();
    this.right?.pad.releaseAll();
  }
}
