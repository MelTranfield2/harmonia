// Two voices, one per half of the image: left half -> left speaker, right half -> right speaker.
// Each voice holds a soft chord (pad) and plays an arpeggio over it. Left and right take turns
// on the arpeggio so you can hear the stereo split clearly.
import * as Tone from "tone";
import type { Chord } from "./analysis";

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

class Voice {
  readonly pad: Tone.PolySynth;
  readonly arp: Tone.PolySynth;
  readonly filter: Tone.Filter;
  readonly panner: Tone.Panner;
  chord: Chord | null = null;

  constructor(pan: number, out: Tone.ToneAudioNode) {
    this.panner = new Tone.Panner(pan).connect(out);
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
    this.filter.frequency.rampTo(chord.cutoff, 0.3, time);
    // varied colours -> slightly out-of-tune, rougher sound
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

export class Harmonia {
  private started = false;
  private left?: Voice;
  private right?: Voice;
  private master?: Tone.Volume;
  private loop?: Tone.Loop;
  private step = 0;
  /** called on each eighth note with which side is playing, for visuals */
  onStep?: (side: "left" | "right", time: number) => void;

  async start() {
    if (this.started) return;
    await Tone.start();
    this.master = new Tone.Volume(-4).toDestination();
    const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.3 }).connect(this.master);
    await reverb.ready;
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

  private tick(time: number) {
    const s = this.step++ % 8;
    const voices = [this.left!, this.right!];
    if (s === 0) {
      // new bar: both pads restrike their chords
      for (const v of voices) if (v.chord) v.pad.triggerAttackRelease(v.chord.notes.map(midiToFreq), "1m", time, 0.6);
    }
    // left plays on the beat, right off the beat
    const side = s % 2 === 0 ? "left" : "right";
    const v = side === "left" ? this.left! : this.right!;
    if (!v.chord) return;
    const notes = v.chord.notes;
    const idx = Math.floor(s / 2) % notes.length;
    const note = notes[(idx + (side === "right" ? 1 : 0)) % notes.length];
    v.arp.triggerAttackRelease(midiToFreq(note + 12), "8n", time, 0.7);
    this.onStep?.(side, time);
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
