import * as Tone from 'tone'

import type { VideoFeatures } from './analysis'
import type { ChordColor, ScaleMode, SettingsStore } from './state'

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo
  if (x > hi) return hi
  return x
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

function pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
  let sum = 0
  for (const w of weights) sum += Math.max(0, w)
  if (sum <= 1e-12) return items[Math.floor(Math.random() * items.length)]!

  let r = Math.random() * sum
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]!)
    if (r <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

const CIRCLE_OF_FIFTHS_PC = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const

function hueToPitchClass(hueDeg: number): number {
  const idx = ((Math.round((hueDeg % 360) / 30) % 12) + 12) % 12
  return CIRCLE_OF_FIFTHS_PC[idx]!
}

function modeIntervals(mode: ScaleMode): number[] {
  switch (mode) {
    case 'ionian':
      return [0, 2, 4, 5, 7, 9, 11]
    case 'dorian':
      return [0, 2, 3, 5, 7, 9, 10]
    case 'phrygian':
      return [0, 1, 3, 5, 7, 8, 10]
    case 'lydian':
      return [0, 2, 4, 6, 7, 9, 11]
    case 'mixolydian':
      return [0, 2, 4, 5, 7, 9, 10]
    case 'aeolian':
      return [0, 2, 3, 5, 7, 8, 10]
    case 'harmonic-minor':
      return [0, 2, 3, 5, 7, 8, 11]
    case 'pentatonic-major':
      return [0, 2, 4, 7, 9]
    case 'pentatonic-minor':
      return [0, 3, 5, 7, 10]
    default:
      return [0, 2, 4, 5, 7, 9, 11]
  }
}

function midiFromPcOct(pc: number, octave: number): number {
  // MIDI: C4 = 60 => 12 * (4 + 1)
  return 12 * (octave + 1) + ((pc % 12) + 12) % 12
}

function pcFromMidi(midi: number): number {
  const pc = midi % 12
  return pc < 0 ? pc + 12 : pc
}

function nearestMidiWithPc(anchorMidi: number, pc: number): number {
  const aPc = pcFromMidi(anchorMidi)
  const want = ((pc % 12) + 12) % 12
  let d = want - aPc
  d = ((d + 18) % 12) - 6 // [-6..+5]
  return anchorMidi + d
}

function chordPitchClasses(
  keyPc: number,
  intervals: number[],
  degree: number,
  color: ChordColor,
  addTension: number,
): number[] {
  const degCount = intervals.length
  const deg = ((degree % degCount) + degCount) % degCount

  const degPc = (keyPc + intervals[deg]!) % 12

  const third = (keyPc + intervals[(deg + 2) % degCount]!) % 12
  const fifth = (keyPc + intervals[(deg + 4) % degCount]!) % 12

  const seventh = (keyPc + intervals[(deg + 6) % degCount]!) % 12
  const ninth = (keyPc + intervals[(deg + 1) % degCount]!) % 12
  const fourth = (keyPc + intervals[(deg + 3) % degCount]!) % 12

  let pcs: number[] = []
  switch (color) {
    case 'triad':
      pcs = [degPc, third, fifth]
      break
    case 'seventh':
      pcs = [degPc, third, fifth, seventh]
      break
    case 'add9':
      pcs = [degPc, third, fifth, ninth]
      break
    case 'sus2':
      pcs = [degPc, ninth, fifth]
      break
    case 'sus4':
      pcs = [degPc, fourth, fifth]
      break
  }

  // optional gentle tension when texture is rich
  if (addTension > 0.55 && Math.random() < (addTension - 0.55) * 0.35) {
    // add 11 (4th) or 6th, but keep it soft (higher voice)
    const extra = Math.random() < 0.6 ? fourth : (keyPc + intervals[(deg + 5) % degCount]!) % 12
    if (!pcs.includes(extra)) pcs = [...pcs, extra]
  }

  // unique pcs while preserving order
  const seen = new Set<number>()
  return pcs.filter((p) => {
    if (seen.has(p)) return false
    seen.add(p)
    return true
  })
}

function voiceChord(
  pcs: number[],
  anchorMidi: number,
  prev: number[] | null,
  spread01: number,
  minMidi: number,
  maxMidi: number,
): number[] {
  const minGap = lerp(2, 5, spread01)
  const spreadOctaves = Math.round(lerp(0, 2, spread01))

  const candidates: number[][] = []

  for (let inv = 0; inv < pcs.length; inv++) {
    const voiced: number[] = []
    let last = anchorMidi - 24

    for (let i = 0; i < pcs.length; i++) {
      const pc = pcs[(i + inv) % pcs.length]!
      let m = nearestMidiWithPc(anchorMidi, pc)

      while (m <= last + minGap) m += 12
      last = m
      voiced.push(m)
    }

    // widen: lift a couple top voices by an octave
    for (let k = 0; k < spreadOctaves; k++) {
      const idx = voiced.length - 1 - k
      if (idx >= 1) voiced[idx]! += 12
    }

    // clamp range (soft)
    while (Math.min(...voiced) < minMidi) {
      for (let i = 0; i < voiced.length; i++) voiced[i]! += 12
    }
    while (Math.max(...voiced) > maxMidi) {
      for (let i = 0; i < voiced.length; i++) voiced[i]! -= 12
    }

    candidates.push(voiced.slice().sort((a, b) => a - b))
  }

  if (!prev || prev.length === 0) {
    return candidates[0]!
  }

  const prevSorted = prev.slice().sort((a, b) => a - b)
  let best = candidates[0]!
  let bestCost = Number.POSITIVE_INFINITY

  for (const cand of candidates) {
    const n = Math.min(prevSorted.length, cand.length)
    let cost = 0
    for (let i = 0; i < n; i++) {
      const d = Math.abs(cand[i]! - prevSorted[i]!)
      cost += d
      if (d > 9) cost += (d - 9) * 1.5
    }
    // gentle penalty for very wide spacing
    const span = cand[cand.length - 1]! - cand[0]!
    cost += Math.max(0, span - 30) * 0.6

    if (cost < bestCost) {
      bestCost = cost
      best = cand
    }
  }

  return best
}

function nextDegree(prev: number, degreeCount: number, surprise01: number, tension01: number): number {
  if (degreeCount <= 1) return 0

  // sometimes jump to something unexpected (but not too far)
  const surprise = clamp01(surprise01) * lerp(0.35, 1, tension01)
  if (Math.random() < surprise) {
    const jumps = [2, 3, 4, -2, -3]
    const j = jumps[Math.floor(Math.random() * jumps.length)]!
    return ((prev + j) % degreeCount + degreeCount) % degreeCount
  }

  const opts = [
    (prev + 3) % degreeCount,
    (prev + 4) % degreeCount,
    (prev + 1) % degreeCount,
    (prev + degreeCount - 1) % degreeCount,
    (prev + 2) % degreeCount,
  ]

  const weights = [
    1.2, // fourth-ish
    1.0, // fifth-ish
    0.8,
    0.6,
    0.7,
  ]

  // add a bit more movement when tension is high
  weights[2]! *= lerp(0.9, 1.15, tension01)
  weights[4]! *= lerp(0.85, 1.2, tension01)

  return pickWeighted(opts, weights)
}

function pickNoteNear(
  pcs: number[],
  lastMidi: number,
  minMidi: number,
  maxMidi: number,
  stepBias01: number,
): number {
  const sigma = lerp(10, 3.2, clamp01(stepBias01))

  const candidates: number[] = []
  const weights: number[] = []
  for (const pc of pcs) {
    let m = nearestMidiWithPc(lastMidi, pc)

    while (m < minMidi) m += 12
    while (m > maxMidi) m -= 12

    // also consider octave above/below
    for (const mm of [m - 12, m, m + 12]) {
      if (mm < minMidi || mm > maxMidi) continue
      const d = Math.abs(mm - lastMidi)
      candidates.push(mm)
      weights.push(Math.exp(-(d * d) / (2 * sigma * sigma)))
    }
  }

  return pickWeighted(candidates, weights)
}

export class AmbientEngine {
  private getSettings: () => SettingsStore

  private features: VideoFeatures | null = null

  private padSynth: Tone.PolySynth<Tone.FMSynth> | null = null
  private particleSynth: Tone.PolySynth<Tone.Synth> | null = null
  private airSynth: Tone.PolySynth<Tone.Synth> | null = null

  private padBus: Tone.Gain | null = null
  private particleBus: Tone.Gain | null = null
  private airBus: Tone.Gain | null = null
  private fxBus: Tone.Gain | null = null

  private filter: Tone.Filter | null = null
  private chorus: Tone.Chorus | null = null
  private delay: Tone.FeedbackDelay | null = null
  private reverb: Tone.Reverb | null = null
  private widener: Tone.StereoWidener | null = null
  private limiter: Tone.Limiter | null = null

  private lastReverbDecay = 0
  private lastReverbPreDelay = 0

  private particlePan: Tone.Panner | null = null
  private airHP: Tone.Filter | null = null

  private chordLoop: Tone.Loop | null = null
  private particleLoop: Tone.Loop | null = null
  private airLoop: Tone.Loop | null = null

  private currentKeyPc: number | null = null
  private currentDegree = 0
  private currentChordMidis: number[] = []
  private currentChordNotes: string[] = []
  private lastParticleMidi: number | null = null

  private started = false

  constructor(getSettings: () => SettingsStore) {
    this.getSettings = getSettings
  }

  setFeatures(f: VideoFeatures | null): void {
    this.features = f
  }

  private ensureGraph(): void {
    if (this.padSynth) return

    // busses
    this.padBus = new Tone.Gain(dbToGain(-10))
    this.particleBus = new Tone.Gain(dbToGain(-16))
    this.airBus = new Tone.Gain(dbToGain(-18))
    this.fxBus = new Tone.Gain(1)

    // FX chain
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 9000,
      Q: 0.7,
    })

    this.chorus = new Tone.Chorus({
      frequency: 0.22,
      delayTime: 6,
      depth: 0.3,
      spread: 180,
      feedback: 0.18,
      wet: 0.22,
    }).start()

    this.delay = new Tone.FeedbackDelay({
      delayTime: 0.42,
      feedback: 0.33,
      wet: 0.08,
    })

    this.reverb = new Tone.Reverb({
      decay: 10,
      preDelay: 0.02,
      wet: 0.6,
    })
    this.lastReverbDecay = 10
    this.lastReverbPreDelay = 0.02

    this.widener = new Tone.StereoWidener({ width: 0.55 })

    this.limiter = new Tone.Limiter(-1)

    // layer-specific
    this.particlePan = new Tone.Panner(0)
    this.airHP = new Tone.Filter({ type: 'highpass', frequency: 1400, Q: 0.7 })

    // routing
    this.padBus.connect(this.fxBus)
    this.particleBus.connect(this.particlePan)
    this.particlePan.connect(this.fxBus)
    this.airBus.connect(this.airHP)
    this.airHP.connect(this.fxBus)

    this.fxBus.chain(this.filter, this.chorus, this.delay, this.reverb, this.widener, this.limiter, Tone.Destination)

    // synths
    this.padSynth = new Tone.PolySynth({
      voice: Tone.FMSynth,
      maxPolyphony: 10,
      volume: -8,
      options: {
        harmonicity: 1.5,
        modulationIndex: 8,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 2.4, decay: 0.9, sustain: 0.85, release: 7.2 },
        modulationEnvelope: { attack: 1.8, decay: 0.7, sustain: 0.6, release: 3.8 },
      },
    })
    this.padSynth.connect(this.padBus)

    this.particleSynth = new Tone.PolySynth({
      voice: Tone.Synth,
      maxPolyphony: 16,
      volume: -16,
      options: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.0, release: 0.9 },
      },
    })
    this.particleSynth.connect(this.particleBus)

    this.airSynth = new Tone.PolySynth({
      voice: Tone.Synth,
      maxPolyphony: 10,
      volume: -20,
      options: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.6, decay: 0.2, sustain: 0.55, release: 6.5 },
      },
    })
    this.airSynth.connect(this.airBus)
  }

  async start(): Promise<void> {
    if (this.started) return

    this.ensureGraph()

    // required by browsers
    await Tone.start()

    // make sure reverb is generated
    if (this.reverb) {
      await this.reverb.ready
    }

    Tone.Transport.bpm.value = 60
    Tone.Transport.stop()
    Tone.Transport.position = 0

    this.setupLoops()

    this.applyAllParams(true)

    Tone.Transport.start('+0.05')
    this.started = true
  }

  stop(): void {
    if (!this.started) return

    try {
      this.chordLoop?.stop(0)
      this.particleLoop?.stop(0)
      this.airLoop?.stop(0)

      Tone.Transport.stop()

      // release everything
      if (this.padSynth && this.currentChordNotes.length) {
        this.padSynth.triggerRelease(this.currentChordNotes)
      }
      this.currentChordNotes = []
      this.currentChordMidis = []
      this.lastParticleMidi = null
    } finally {
      this.started = false
    }
  }

  dispose(): void {
    this.stop()

    this.chordLoop?.dispose()
    this.particleLoop?.dispose()
    this.airLoop?.dispose()

    this.padSynth?.dispose()
    this.particleSynth?.dispose()
    this.airSynth?.dispose()

    this.padBus?.dispose()
    this.particleBus?.dispose()
    this.airBus?.dispose()
    this.fxBus?.dispose()

    this.filter?.dispose()
    this.chorus?.dispose()
    this.delay?.dispose()
    this.reverb?.dispose()
    this.widener?.dispose()
    this.limiter?.dispose()

    this.particlePan?.dispose()
    this.airHP?.dispose()

    this.padSynth = null
    this.particleSynth = null
    this.airSynth = null
  }

  private setupLoops(): void {
    if (this.chordLoop) return

    this.chordLoop = new Tone.Loop((time) => this.tickChord(time), 8)
    this.particleLoop = new Tone.Loop((time) => this.tickParticles(time), 0.22)
    this.airLoop = new Tone.Loop((time) => this.tickAir(time), 1.4)

    this.chordLoop.start(0)
    this.particleLoop.start(0)
    this.airLoop.start(0)
  }

  private applyAllParams(immediate: boolean): void {
    const s = this.getSettings()
    const f = this.features

    const bright = f?.brightness ?? 0.55
    const sat = f?.saturation ?? 0.5
    const motion = f?.motion ?? 0

    // loop tempos (dynamic)
    const chordSec = lerp(s.harmony.chordSeconds, s.harmony.chordSecondsMin, motion)
    if (this.chordLoop) this.chordLoop.interval = clamp(chordSec, 2.5, 20)
    if (this.particleLoop) this.particleLoop.interval = clamp(s.texture.particleIntervalSec, 0.06, 1.0)
    if (this.airLoop) this.airLoop.interval = clamp(s.air.intervalSec, 0.2, 8.0)

    const ramp = immediate ? 0.001 : 0.6

    // master
    this.padBus?.gain.rampTo(dbToGain(-10), ramp)
    this.particleBus?.gain.rampTo(dbToGain(-16), ramp)
    this.airBus?.gain.rampTo(dbToGain(-18), ramp)

    this.fxBus?.gain.rampTo(dbToGain(0), ramp)

    if (this.limiter) this.limiter.threshold.value = s.master.limiterDb

    // output volume
    Tone.Destination.volume.rampTo(s.master.volumeDb, ramp)

    // filter & FX
    const filterHz = clamp(
      s.fx.filterHz * (0.7 + 0.7 * bright) * (0.8 + 0.6 * sat),
      300,
      18000,
    )
    this.filter?.frequency.rampTo(filterHz, ramp)
    if (this.filter) this.filter.Q.value = s.fx.filterQ

    if (this.chorus) {
      this.chorus.depth = clamp01(s.fx.chorusDepth + sat * 0.08)
      this.chorus.frequency.value = clamp(s.fx.chorusRate, 0.05, 1.2)
      this.chorus.wet.rampTo(clamp01(s.fx.chorusWet + sat * 0.06), ramp)
    }

    this.delay?.delayTime.rampTo(s.fx.delayTime, ramp)
    this.delay?.feedback.rampTo(clamp01(s.fx.delayFeedback + motion * 0.08), ramp)
    this.delay?.wet.rampTo(clamp01(s.fx.delayWet + motion * 0.05), ramp)

    if (this.reverb) {
      this.reverb.wet.rampTo(clamp01(s.fx.reverbWet + (1 - motion) * 0.05), ramp)

      if (Math.abs(this.lastReverbDecay - s.fx.reverbDecay) > 0.01) {
        this.reverb.decay = s.fx.reverbDecay
        this.lastReverbDecay = s.fx.reverbDecay
      }

      if (Math.abs(this.lastReverbPreDelay - s.fx.reverbPreDelay) > 0.001) {
        this.reverb.preDelay = s.fx.reverbPreDelay
        this.lastReverbPreDelay = s.fx.reverbPreDelay
      }
    }

    if (this.widener) this.widener.width.value = clamp01(s.fx.stereoWidth + sat * 0.1)

    this.airHP?.frequency.rampTo(clamp(s.air.highpassHz * (0.85 + sat * 0.3), 500, 6000), ramp)

    // subtle spatial pan from hue
    if (this.particlePan && f) {
      const pan = Math.sin((f.hue * Math.PI) / 180) * 0.55
      this.particlePan.pan.rampTo(pan, ramp)
    }
  }

  private tickChord(time: number): void {
    const s = this.getSettings()
    const f = this.features

    this.applyAllParams(false)

    if (!this.padSynth) return

    const bright = f?.brightness ?? 0.55
    const sat = f?.saturation ?? 0.5
    const motion = f?.motion ?? 0
    const edge = f?.edge ?? 0

    const targetPc = f ? hueToPitchClass(f.hue) : 0
    if (this.currentKeyPc == null) this.currentKeyPc = targetPc

    // drift the key towards the target, max 1 semitone per chord, strength rootFromHue
    if (this.currentKeyPc != null && f) {
      const cur = this.currentKeyPc
      const want = targetPc
      let d = want - cur
      d = ((d + 18) % 12) - 6
      const step = Math.sign(d)
      const strength = clamp01(s.harmony.rootFromHue)
      if (Math.abs(d) >= 1 && Math.random() < strength) {
        this.currentKeyPc = (cur + step + 12) % 12
      }
    }

    const keyPc = this.currentKeyPc ?? targetPc
    const intervals = modeIntervals(s.harmony.mode)
    const degCount = intervals.length

    // degree movement
    const tension = clamp01(edge * 0.7 + motion * 0.5 + sat * 0.25)
    this.currentDegree = nextDegree(this.currentDegree, degCount, s.harmony.degreeSurprise, tension)

    // compute register
    const octShift = Math.round((bright - 0.5) * s.harmony.octaveRangeFromBrightness)
    const baseOct = clamp(s.harmony.baseOctave + octShift, 1, 6)

    const anchorKeyMidi = midiFromPcOct(keyPc, baseOct)
    const chordRootMidi = anchorKeyMidi + intervals[this.currentDegree]!

    const pcs = chordPitchClasses(keyPc, intervals, this.currentDegree, s.harmony.chordColor, edge)

    const voiced = voiceChord(
      pcs,
      chordRootMidi,
      this.currentChordMidis.length ? this.currentChordMidis : null,
      s.harmony.voiceSpread,
      midiFromPcOct(0, baseOct - 1),
      midiFromPcOct(11, baseOct + 3),
    )

    const notes = voiced.map((m) => Tone.Frequency(m, 'midi').toNote())

    // gentle dynamics: more saturation = slightly louder pad
    const vel = clamp(0.4 + sat * 0.25 + (1 - motion) * 0.15, 0.25, 0.85)

    if (this.currentChordNotes.length) {
      this.padSynth.triggerRelease(this.currentChordNotes, time)
    }
    this.padSynth.triggerAttack(notes, time, vel)

    this.currentChordMidis = voiced
    this.currentChordNotes = notes

    // seed particles near the chord
    if (this.lastParticleMidi == null && voiced.length) {
      this.lastParticleMidi = voiced[Math.floor(voiced.length / 2)]!
    }
  }

  private tickParticles(time: number): void {
    const s = this.getSettings()
    const f = this.features

    if (!this.particleSynth || !f) return

    const motion = f.motion
    const edge = f.edge
    const sat = f.saturation
    const bright = f.brightness

    // density: base + video influence
    const density = clamp01(s.texture.densityBase + motion * s.texture.densityFromMotion + edge * s.texture.densityFromEdge)

    // 0..~2 notes per tick
    const nNotes = density > 0.72 ? (Math.random() < density ? 2 : 1) : Math.random() < density ? 1 : 0
    if (nNotes === 0) return

    // melodic register
    const minMidi = midiFromPcOct(0, clamp(s.texture.registerMin + Math.round((bright - 0.5) * 1), 1, 8))
    const maxMidi = midiFromPcOct(11, clamp(s.texture.registerMax + Math.round((bright - 0.5) * 1), 2, 9))

    // pool: mostly chord tones + some scale tones
    const chordPcs = this.currentChordMidis.length
      ? Array.from(new Set(this.currentChordMidis.map((m) => pcFromMidi(m))))
      : [hueToPitchClass(f.hue)]

    const intervals = modeIntervals(s.harmony.mode)
    const keyPc = this.currentKeyPc ?? hueToPitchClass(f.hue)
    const scalePcs = intervals.map((x) => (keyPc + x) % 12)

    const pool: number[] = []
    // chord weighted more
    pool.push(...chordPcs, ...chordPcs, ...scalePcs)

    let last = this.lastParticleMidi ?? midiFromPcOct(keyPc, 5)

    for (let i = 0; i < nNotes; i++) {
      const midi = pickNoteNear(pool, last, minMidi, maxMidi, s.texture.stepBias)
      last = midi

      const len = lerp(s.texture.noteLenMaxSec, s.texture.noteLenMinSec, clamp01(motion * 0.9 + edge * 0.35))
      const jitter = (Math.random() - 0.5) * (s.texture.humanizeMs / 1000)

      const vel = clamp01(s.texture.velocity * (0.55 + 0.35 * sat) * (0.85 + 0.3 * density))
      const note = Tone.Frequency(midi, 'midi').toNote()

      this.particleSynth.triggerAttackRelease(note, len, time + jitter, vel)
    }

    this.lastParticleMidi = last
  }

  private tickAir(time: number): void {
    const s = this.getSettings()
    const f = this.features

    if (!this.airSynth || !f || !s.air.enabled) return

    const bright = f.brightness
    const sat = f.saturation
    const motion = f.motion

    const p = clamp01(0.15 + s.air.amount * (0.35 + 0.35 * bright + 0.2 * sat) * (0.9 - motion * 0.5))
    if (Math.random() > p) return

    const chordMidis = this.currentChordMidis.length ? this.currentChordMidis : [midiFromPcOct(hueToPitchClass(f.hue), 5)]

    const base = chordMidis[chordMidis.length - 1]!
    const minMidi = midiFromPcOct(0, 6)
    const maxMidi = midiFromPcOct(11, 8)

    const pcs = Array.from(new Set(chordMidis.map((m) => pcFromMidi(m))))

    const note1 = pickNoteNear(pcs, clamp(base + 12, minMidi, maxMidi), minMidi, maxMidi, 0.9)
    const note2 = Math.random() < 0.5 ? pickNoteNear(pcs, note1 + 7, minMidi, maxMidi, 0.85) : null

    const len = clamp(s.air.noteLenSec * (0.85 + bright * 0.35), 1.5, 12)

    const vel = clamp01(0.12 + s.air.amount * (0.25 + 0.15 * sat))

    this.airSynth.triggerAttackRelease(Tone.Frequency(note1, 'midi').toNote(), len, time + 0.01, vel)
    if (note2 != null) {
      this.airSynth.triggerAttackRelease(Tone.Frequency(note2, 'midi').toNote(), len * 0.9, time + 0.03, vel * 0.8)
    }
  }
}
