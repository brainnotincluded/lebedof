import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { VideoFeatures } from './analysis'

export type ScaleMode =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'harmonic-minor'
  | 'pentatonic-major'
  | 'pentatonic-minor'

export type ChordColor = 'triad' | 'seventh' | 'add9' | 'sus2' | 'sus4'

export type AnalysisSettings = {
  size: number
  fps: number
  smoothingSec: number
  hueBins: number
  paletteSize: number
  motionGain: number
  edgeGain: number
  edgeThreshold: number
}

export type HarmonySettings = {
  mode: ScaleMode
  chordColor: ChordColor
  baseOctave: number
  octaveRangeFromBrightness: number
  chordSeconds: number
  chordSecondsMin: number
  modulationSeconds: number
  rootFromHue: number
  degreeSurprise: number
  voiceSpread: number
}

export type TextureSettings = {
  particleIntervalSec: number
  densityBase: number
  densityFromMotion: number
  densityFromEdge: number
  velocity: number
  noteLenMinSec: number
  noteLenMaxSec: number
  registerMin: number
  registerMax: number
  stepBias: number
  humanizeMs: number
}

export type AirSettings = {
  enabled: boolean
  amount: number
  intervalSec: number
  noteLenSec: number
  highpassHz: number
}

export type FxSettings = {
  filterHz: number
  filterQ: number
  reverbWet: number
  reverbDecay: number
  reverbPreDelay: number
  chorusWet: number
  chorusDepth: number
  chorusRate: number
  delayWet: number
  delayTime: number
  delayFeedback: number
  stereoWidth: number
}

export type MasterSettings = {
  volumeDb: number
  limiterDb: number
}

export type UiSettings = {
  cameraDeviceId: string
  showAdvanced: boolean
}

export type Settings = {
  presetId: string
  analysis: AnalysisSettings
  harmony: HarmonySettings
  texture: TextureSettings
  air: AirSettings
  fx: FxSettings
  master: MasterSettings
  ui: UiSettings
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type Preset = {
  id: string
  name: string
  description: string
  patch: DeepPartial<Settings>
}

const DEFAULT_SETTINGS: Settings = {
  presetId: 'ethereal-lydian',
  analysis: {
    size: 96,
    fps: 20,
    smoothingSec: 1.0,
    hueBins: 36,
    paletteSize: 5,
    motionGain: 18,
    edgeGain: 7,
    edgeThreshold: 0.14,
  },
  harmony: {
    mode: 'lydian',
    chordColor: 'add9',
    baseOctave: 3,
    octaveRangeFromBrightness: 2,
    chordSeconds: 8,
    chordSecondsMin: 4.5,
    modulationSeconds: 28,
    rootFromHue: 0.9,
    degreeSurprise: 0.28,
    voiceSpread: 0.65,
  },
  texture: {
    particleIntervalSec: 0.22,
    densityBase: 0.18,
    densityFromMotion: 0.9,
    densityFromEdge: 0.45,
    velocity: 0.6,
    noteLenMinSec: 0.08,
    noteLenMaxSec: 0.7,
    registerMin: 4,
    registerMax: 7,
    stepBias: 0.84,
    humanizeMs: 18,
  },
  air: {
    enabled: true,
    amount: 0.7,
    intervalSec: 1.4,
    noteLenSec: 4.5,
    highpassHz: 1400,
  },
  fx: {
    filterHz: 9500,
    filterQ: 0.7,
    reverbWet: 0.62,
    reverbDecay: 10.5,
    reverbPreDelay: 0.02,
    chorusWet: 0.25,
    chorusDepth: 0.33,
    chorusRate: 0.22,
    delayWet: 0.09,
    delayTime: 0.42,
    delayFeedback: 0.33,
    stereoWidth: 0.6,
  },
  master: {
    volumeDb: -10,
    limiterDb: -1,
  },
  ui: {
    cameraDeviceId: '',
    showAdvanced: false,
  },
}

export const PRESETS: Preset[] = [
  {
    id: 'ethereal-lydian',
    name: 'Ethereal Lydian Choir',
    description: 'Светлый «ангельский» лад, много воздуха и мягкая фактура.',
    patch: {
      presetId: 'ethereal-lydian',
      harmony: { mode: 'lydian', chordColor: 'add9', degreeSurprise: 0.3 },
      fx: { reverbWet: 0.64, reverbDecay: 11.5, chorusWet: 0.28, filterHz: 10500 },
      texture: { densityBase: 0.16, stepBias: 0.86 },
      air: { enabled: true, amount: 0.78, highpassHz: 1500 },
    },
  },
  {
    id: 'warm-dorian',
    name: 'Warm Dorian Drift',
    description: 'Теплее и глубже, с мягкой меланхолией.',
    patch: {
      presetId: 'warm-dorian',
      harmony: { mode: 'dorian', chordColor: 'seventh', degreeSurprise: 0.22, voiceSpread: 0.55 },
      fx: { reverbWet: 0.58, reverbDecay: 9.5, filterHz: 8200, delayWet: 0.12 },
      texture: { densityBase: 0.2, densityFromEdge: 0.5, registerMin: 3, registerMax: 6 },
      air: { enabled: true, amount: 0.55, highpassHz: 1200 },
    },
  },
  {
    id: 'bright-pentatonic',
    name: 'Bright Pentatonic Shimmer',
    description: 'Очень много нот без диссонанса: пентатоника + сияние.',
    patch: {
      presetId: 'bright-pentatonic',
      harmony: { mode: 'pentatonic-major', chordColor: 'add9', degreeSurprise: 0.18, chordSeconds: 7 },
      texture: { densityBase: 0.28, densityFromMotion: 1.0, stepBias: 0.9, registerMin: 5, registerMax: 8 },
      fx: { reverbWet: 0.66, chorusWet: 0.22, filterHz: 11500 },
      air: { enabled: true, amount: 0.85, intervalSec: 1.1 },
    },
  },
  {
    id: 'deep-aeolian',
    name: 'Deep Aeolian Space',
    description: 'Глубокий космос: медленнее, ниже, шире.',
    patch: {
      presetId: 'deep-aeolian',
      harmony: { mode: 'aeolian', chordColor: 'seventh', chordSeconds: 10, chordSecondsMin: 6, voiceSpread: 0.72 },
      fx: { reverbWet: 0.6, reverbDecay: 12.5, filterHz: 7200, delayWet: 0.08, stereoWidth: 0.75 },
      texture: { densityBase: 0.12, densityFromMotion: 0.8, registerMin: 3, registerMax: 6 },
      air: { enabled: true, amount: 0.45, intervalSec: 2.0 },
      master: { volumeDb: -12 },
    },
  },
]


export type SettingsStore = Settings & {
  setAnalysis: (patch: Partial<AnalysisSettings>) => void
  setHarmony: (patch: Partial<HarmonySettings>) => void
  setTexture: (patch: Partial<TextureSettings>) => void
  setAir: (patch: Partial<AirSettings>) => void
  setFx: (patch: Partial<FxSettings>) => void
  setMaster: (patch: Partial<MasterSettings>) => void
  setUi: (patch: Partial<UiSettings>) => void
  applyPreset: (presetId: string) => void
  resetAll: () => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setAnalysis: (patch) => set((s) => ({ analysis: { ...s.analysis, ...patch } })),
      setHarmony: (patch) => set((s) => ({ harmony: { ...s.harmony, ...patch } })),
      setTexture: (patch) => set((s) => ({ texture: { ...s.texture, ...patch } })),
      setAir: (patch) => set((s) => ({ air: { ...s.air, ...patch } })),
      setFx: (patch) => set((s) => ({ fx: { ...s.fx, ...patch } })),
      setMaster: (patch) => set((s) => ({ master: { ...s.master, ...patch } })),
      setUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),

      applyPreset: (presetId) => {
        const preset = PRESETS.find((p) => p.id === presetId)
        if (!preset) return

        const patch = preset.patch
        set((s) => ({
          presetId,
          analysis: { ...s.analysis, ...(patch.analysis ?? {}) },
          harmony: { ...s.harmony, ...(patch.harmony ?? {}) },
          texture: { ...s.texture, ...(patch.texture ?? {}) },
          air: { ...s.air, ...(patch.air ?? {}) },
          fx: { ...s.fx, ...(patch.fx ?? {}) },
          master: { ...s.master, ...(patch.master ?? {}) },
          ui: { ...s.ui, ...(patch.ui ?? {}) },
        }))
      },

      resetAll: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'ambient-painter-settings-v1',
      partialize: (s) => ({
        presetId: s.presetId,
        analysis: s.analysis,
        harmony: s.harmony,
        texture: s.texture,
        air: s.air,
        fx: s.fx,
        master: s.master,
        ui: s.ui,
      }),
    },
  ),
)

export type AudioStatus = 'stopped' | 'starting' | 'running' | 'error'

export type RuntimeState = {
  audioStatus: AudioStatus
  audioError: string | null
  cameraStatus: 'idle' | 'starting' | 'running' | 'error'
  cameraError: string | null
  devices: MediaDeviceInfo[]
  features: VideoFeatures | null

  setAudioStatus: (status: AudioStatus, error?: string | null) => void
  setCameraStatus: (status: RuntimeState['cameraStatus'], error?: string | null) => void
  setDevices: (devices: MediaDeviceInfo[]) => void
  setFeatures: (features: VideoFeatures | null) => void
}

export const useRuntime = create<RuntimeState>()((set) => ({
  audioStatus: 'stopped',
  audioError: null,
  cameraStatus: 'idle',
  cameraError: null,
  devices: [],
  features: null,

  setAudioStatus: (status, error = null) => set({ audioStatus: status, audioError: error ?? null }),
  setCameraStatus: (status, error = null) => set({ cameraStatus: status, cameraError: error ?? null }),
  setDevices: (devices) => set({ devices }),
  setFeatures: (features) => set({ features }),
}))
