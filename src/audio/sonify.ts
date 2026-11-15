// =============================================================================
// SOUND ENGINE (Tone.js)  /  MOTOR DE SOM (Tone.js)
// Only audio lives here. Which note plays when is decided in core/sequence.ts.
// Só áudio fica aqui. Qual nota toca e quando é decidido em core/sequence.ts.
//
// Features in this file / Funcionalidades neste arquivo:
//   [F1] Brightness -> brighter tone (filter)     / Brilho -> timbre mais brilhante (filtro)
//   [F2] Mixed colours -> slight detune            / Cores misturadas -> leve desafinação
//   [F4] Left half -> left speaker, right -> right / Metade esquerda -> caixa esquerda, direita -> direita
//   [F7] Play / stop loop (pad + arpeggio)         / Tocar / parar (acorde de fundo + arpejo)
//   [F13] One square of the matrix (strummed chord) / Um quadrado da matriz (acorde dedilhado)
// =============================================================================
import * as Tone from "tone";
import type { Chord } from "../core/analysis";
import { arpeggioStep, type Side } from "../core/sequence";

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** How far each half is panned (-1 = left, +1 = right). / Quanto cada metade vai para o lado. */
export const PAN = { left: -0.85, right: 0.85 } as const;

/** [F13] Seconds between the notes of a strummed square. / Segundos entre as notas de um quadrado. */
export const STRUM_GAP = 0.06;

/** One half of the image = one voice. / Uma metade da imagem = uma voz. */
class Voice {
  readonly pad: Tone.PolySynth;
  readonly arp: Tone.PolySynth;
  readonly filter: Tone.Filter;
  readonly panner: Tone.Panner;
  chord: Chord | null = null;

  constructor(pan: number, out: Tone.ToneAudioNode) {
    // [F4] stereo position / posição no estéreo
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

  set(chord: Chord, ramp = 0.3) {
    this.chord = chord;
    // [F1] brighter image -> more treble / imagem mais brilhante -> mais agudos
    this.filter.frequency.rampTo(chord.cutoff, ramp);
    // [F2] varied colours -> slightly out of tune / cores variadas -> um pouco desafinado
    const detune = chord.dissonance * 30;
    this.pad.set({ detune });
    this.arp.set({ detune: -detune / 2 });
  }
}

// [F7] The player  ·  O tocador
export class Harmonia {
  private voices?: Record<Side, Voice>;
  /** [F13] the voice that plays the square under the cursor / a voz que toca o quadrado sob o cursor */
  private cursor?: Voice;
  private loop?: Tone.Loop;
  private step = 0;
  private pending?: { left: Chord; right: Chord };
  private starting?: Promise<void>;
  /** Called on each note played, for visuals. / Chamado a cada nota tocada, para o visual. */
  onStep?: (side: Side, time: number, midi: number) => void;

  /** True once audio is running. / Verdadeiro quando o áudio já está ligado. */
  get started() {
    return this.voices !== undefined;
  }

  // Browsers only allow audio after a click or key press, so this runs on the first one.
  // Navegadores só liberam áudio depois de um clique ou tecla, então isto roda no primeiro.
  // Calling it twice at once is safe: both callers wait for the same setup.
  start(): Promise<void> {
    this.starting ??= this.setUp();
    return this.starting;
  }

  private async setUp() {
    await Tone.start();
    const master = new Tone.Volume(-4).toDestination();
    const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.3 }).connect(master);
    await reverb.ready;
    // [F4] left half almost fully left, right half almost fully right
    this.voices = { left: new Voice(PAN.left, reverb), right: new Voice(PAN.right, reverb) };
    this.cursor = new Voice(0, reverb);
    Tone.getTransport().bpm.value = 84;
    this.loop = new Tone.Loop((time) => this.tick(time), "8n");
    if (this.pending) this.setChords(this.pending.left, this.pending.right);
  }

  /**
   * [F13] Plays one square of the matrix: its chord, strummed from the lowest note up,
   * at the square's position between the speakers. Does nothing until audio has started.
   * Toca um quadrado da matriz: o acorde, dedilhado da nota mais grave para cima,
   * na posição do quadrado entre as caixas. Não faz nada antes de o áudio ligar.
   */
  playCell(chord: Chord, pan: number) {
    const v = this.cursor;
    if (!v) return;
    const now = Tone.now();
    v.arp.releaseAll(now); // cut the previous square so squares don't blur together
    v.set(chord, 0.03); // [F1] brightness -> filter, [F2] mixed colours -> detune
    v.panner.pan.rampTo(pan, 0.03); // [F4] column -> left .. right
    chord.notes.forEach((midi, i) => {
      v.arp.triggerAttackRelease(midiToFreq(midi), 0.6, now + 0.04 + i * STRUM_GAP, 0.75);
    });
  }

  /** Safe to call before start(): chords are kept until audio is ready. / Pode chamar antes do start(). */
  setChords(left: Chord, right: Chord) {
    this.pending = { left, right };
    if (!this.voices) return;
    this.voices.left.set(left);
    this.voices.right.set(right);
  }

  // [F7] Runs on every eighth note. / Roda a cada colcheia.
  private tick(time: number) {
    const v = this.voices!;
    const step = arpeggioStep(this.step++, v.left.chord?.notes ?? null, v.right.chord?.notes ?? null);
    if (step.newBar) {
      // new bar: both pads restrike their chords / novo compasso: os dois acordes de fundo tocam de novo
      for (const voice of [v.left, v.right]) {
        if (voice.chord) voice.pad.triggerAttackRelease(voice.chord.notes.map(midiToFreq), "1m", time, 0.6);
      }
    }
    if (step.note === null) return;
    // [F8] play the chord note itself, so the sound matches the piano
    //      toca a própria nota do acorde, para o som bater com o piano
    v[step.side].arp.triggerAttackRelease(midiToFreq(step.note), "8n", time, 0.7);
    this.onStep?.(step.side, time, step.note);
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
    this.voices?.left.pad.releaseAll();
    this.voices?.right.pad.releaseAll();
  }

  /** Runs `fn` in sync with the audio, for visuals. / Roda `fn` sincronizado com o áudio. */
  static draw(fn: () => void, time: number) {
    Tone.getDraw().schedule(fn, time);
  }
}
