// The sound engine (Tone.js on top of the Web Audio API).
//
//   value of a slice      -> pitch (pentatonic scale, so it never sounds "wrong")
//   horizontal position   -> stereo pan (left .. right)
//   how much data/ice     -> loudness
//   frame summary change  -> drone pitch + distortion ("roughness")
//   start of each frame   -> a soft drum beat, so you can count years
import * as Tone from "tone";
import type { Instrument } from "./records";

const PENTATONIC = [0, 2, 4, 7, 9];
/** C3 .. C6 pentatonic, 16 notes */
const SCALE = [48, 60, 72].flatMap((base) => PENTATONIC.map((s) => base + s)).concat(84);
const DRONE_BASE = 38; // D2
const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

export const noteFor = (v01: number) => SCALE[Math.round(Math.min(1, Math.max(0, v01)) * (SCALE.length - 1))];

function makeInstrument(kind: Instrument): Tone.PolySynth {
  switch (kind) {
    case "warm":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.25, release: 0.35 },
        volume: -16,
      });
    case "bell":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 10,
        envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.9 },
        modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
        volume: -12,
      });
    case "pluck":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.25 },
        volume: -8,
      });
  }
}

export class Sonifier {
  private started = false;
  private master!: Tone.Volume;
  private reverb!: Tone.Reverb;
  private panner!: Tone.Panner;
  private rough!: Tone.Distortion;
  private filter!: Tone.Filter;
  private inst?: Tone.PolySynth;
  private drone!: Tone.Synth;
  private beat!: Tone.MembraneSynth;
  private droneOn = false;
  private kind?: Instrument;

  /** Must be called from a user gesture (click / key press): browsers block audio until then. */
  async start(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.master = new Tone.Volume(-4).toDestination();
    this.reverb = new Tone.Reverb({ decay: 3, wet: 0.25 }).connect(this.master);
    await this.reverb.ready;
    this.panner = new Tone.Panner(0).connect(this.reverb);
    this.rough = new Tone.Distortion({ distortion: 0.8, wet: 0 }).connect(this.panner);
    this.filter = new Tone.Filter(3200, "lowpass").connect(this.rough);
    this.drone = new Tone.Synth({
      oscillator: { type: "fattriangle", count: 2, spread: 12 },
      envelope: { attack: 0.8, decay: 0, sustain: 1, release: 1.2 },
      volume: -22,
    }).connect(this.reverb);
    this.beat = new Tone.MembraneSynth({ volume: -20 }).connect(this.master);
    this.started = true;
    if (this.kind) this.setInstrument(this.kind);
  }

  setInstrument(kind: Instrument): void {
    this.kind = kind;
    if (!this.started) return;
    this.inst?.dispose();
    this.inst = makeInstrument(kind).connect(this.filter);
  }

  setMuted(muted: boolean): void {
    if (this.started) this.master.mute = muted;
  }

  /** Called at the first beat of every frame. change01 is -1..1 (how far from the first frame). */
  frameStart(time: number, change: number): void {
    const freq = midiToFreq(DRONE_BASE + Math.round(change * 7));
    if (!this.droneOn) {
      this.drone.triggerAttack(freq, time);
      this.droneOn = true;
    } else {
      this.drone.frequency.rampTo(freq, 0.4, time);
    }
    this.rough.wet.rampTo(Math.min(1, Math.abs(change)) * 0.7, 0.2, time);
    this.beat.triggerAttackRelease("C1", "16n", time, 0.6);
  }

  /** One slice of the needle sweep. */
  note(time: number, v01: number, pan: number, loudness: number, duration = 0.14): void {
    if (!this.inst) return;
    this.panner.pan.setValueAtTime(pan, time);
    this.inst.triggerAttackRelease(midiToFreq(noteFor(v01)), duration, time, 0.25 + 0.75 * loudness);
  }

  /** Play a note right now (explore mode, audio legend). */
  preview(v01: number, pan = 0, roughness = 0, delay = 0): void {
    if (!this.started) return;
    const t = Tone.now() + 0.02 + delay;
    this.rough.wet.setValueAtTime(roughness, t);
    this.note(t, v01, pan, 0.8, 0.25);
  }

  stopDrone(): void {
    if (this.droneOn) this.drone.triggerRelease();
    this.droneOn = false;
  }
}
