import type { AnalysisSettings } from './state'

export type VideoFeatures = {
  t: number
  size: number
  fps: number

  hue: number
  palette: string[]
  hueBins: number[]

  brightness: number
  saturation: number
  contrast: number
  motion: number
  edge: number
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function expAlpha(dtSec: number, tauSec: number): number {
  const tau = Math.max(0.001, tauSec)
  const dt = Math.max(0, dtSec)
  return 1 - Math.exp(-dt / tau)
}

function wrapHueDeg(deg: number): number {
  const x = deg % 360
  return x < 0 ? x + 360 : x
}

function hueFromRgb(r: number, g: number, b: number): { hue: number; sat: number; val: number } {
  const rf = r / 255
  const gf = g / 255
  const bf = b / 255

  const max = Math.max(rf, gf, bf)
  const min = Math.min(rf, gf, bf)
  const d = max - min

  let h = 0
  if (d > 1e-6) {
    switch (max) {
      case rf:
        h = (gf - bf) / d + (gf < bf ? 6 : 0)
        break
      case gf:
        h = (bf - rf) / d + 2
        break
      default:
        h = (rf - gf) / d + 4
        break
    }
    h *= 60
  }

  const s = max <= 1e-6 ? 0 : d / max
  return { hue: wrapHueDeg(h), sat: clamp01(s), val: clamp01(max) }
}

function luminance(r: number, g: number, b: number): number {
  // Rec.709
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export class VideoAnalyzer {
  private getSettings: () => AnalysisSettings

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private timer: number | null = null

  private prevGray: Float32Array | null = null
  private lastT: number | null = null

  // EMA state
  private emaBrightness = 0
  private emaSaturation = 0
  private emaContrast = 0
  private emaMotion = 0
  private emaEdge = 0

  // circular smoothing for hue
  private emaHueX = 1
  private emaHueY = 0

  private emaHueBins: Float32Array | null = null

  constructor(getSettings: () => AnalysisSettings) {
    this.getSettings = getSettings

    this.canvas = document.createElement('canvas')
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Cannot create 2D canvas context')
    this.ctx = ctx
  }

  start(video: HTMLVideoElement, onFeatures: (f: VideoFeatures) => void): void {
    this.stop()

    const tick = () => {
      const s = this.getSettings()
      const size = Math.max(32, Math.min(256, Math.floor(s.size)))
      const fps = Math.max(5, Math.min(60, Math.floor(s.fps)))

      const now = performance.now()
      const dtSec = this.lastT == null ? 1 / fps : Math.max(0.001, (now - this.lastT) / 1000)
      this.lastT = now

      // keep canvas in sync
      if (this.canvas.width !== size || this.canvas.height !== size) {
        this.canvas.width = size
        this.canvas.height = size
        this.prevGray = null
        this.emaHueBins = null
      }

      // draw downscaled frame
      this.ctx.drawImage(video, 0, 0, size, size)
      const img = this.ctx.getImageData(0, 0, size, size)
      const data = img.data

      const gray = new Float32Array(size * size)

      const hueBinsCount = Math.max(12, Math.min(72, Math.floor(s.hueBins)))
      const hueBins = new Float32Array(hueBinsCount)

      let sumB = 0
      let sumS = 0
      let sumY = 0
      let sumY2 = 0

      // compute hsv+lum + hue histogram
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!

        const y = luminance(r, g, b)
        gray[p] = y

        const { hue, sat, val } = hueFromRgb(r, g, b)

        sumB += val
        sumS += sat
        sumY += y
        sumY2 += y * y

        // weight: emphasize vivid strokes
        const w = sat * Math.sqrt(val)
        const bin = Math.floor((hue / 360) * hueBinsCount) % hueBinsCount
        hueBins[bin] += w
      }

      const n = size * size
      const meanB = sumB / n
      const meanS = sumS / n
      const meanY = sumY / n
      const varY = Math.max(0, sumY2 / n - meanY * meanY)
      const stdY = Math.sqrt(varY)

      // motion (frame diff)
      let motionRaw = 0
      if (this.prevGray) {
        let acc = 0
        for (let i = 0; i < gray.length; i++) acc += Math.abs(gray[i]! - this.prevGray[i]!)
        motionRaw = acc / gray.length
      }

      // edge density via Sobel (cheap)
      const edgeThreshold = clamp01(s.edgeThreshold)
      let edges = 0
      const w = size
      const h = size
      if (w >= 3 && h >= 3) {
        for (let y = 1; y < h - 1; y++) {
          const row = y * w
          for (let x = 1; x < w - 1; x++) {
            const i = row + x

            const a00 = gray[i - w - 1]!
            const a01 = gray[i - w]!
            const a02 = gray[i - w + 1]!
            const a10 = gray[i - 1]!
            const a12 = gray[i + 1]!
            const a20 = gray[i + w - 1]!
            const a21 = gray[i + w]!
            const a22 = gray[i + w + 1]!

            const gx = -a00 - 2 * a10 - a20 + a02 + 2 * a12 + a22
            const gy = -a00 - 2 * a01 - a02 + a20 + 2 * a21 + a22
            const mag = Math.abs(gx) + Math.abs(gy)

            // mag is roughly in [0..~8] for normalized gray
            if (mag > edgeThreshold * 2.6) edges++
          }
        }
      }
      const edgeRaw = edges / Math.max(1, (w - 2) * (h - 2))

      // gains (make small values audible)
      const motion = 1 - Math.exp(-motionRaw * Math.max(1, s.motionGain))
      const edge = 1 - Math.exp(-edgeRaw * Math.max(1, s.edgeGain))

      // pick dominant hue
      let best = 0
      let bestV = -1
      let sumHueW = 0
      for (let i = 0; i < hueBins.length; i++) {
        sumHueW += hueBins[i]!
        if (hueBins[i]! > bestV) {
          bestV = hueBins[i]!
          best = i
        }
      }

      const dominantHue = (best + 0.5) * (360 / hueBinsCount)

      // palette: top-k bins
      const paletteSize = Math.max(1, Math.min(8, Math.floor(s.paletteSize)))
      const idx = [...Array(hueBinsCount).keys()]
      idx.sort((a, b) => (hueBins[b]! - hueBins[a]!))
      const palette: string[] = []
      for (let k = 0; k < paletteSize; k++) {
        const i = idx[k]!
        const hue = (i + 0.5) * (360 / hueBinsCount)
        // make palette visually nicer
        const sat = 68
        const light = 55
        palette.push(`hsl(${hue.toFixed(1)}deg ${sat}% ${light}%)`)
      }

      // normalize bins
      const hueBinsNorm = new Float32Array(hueBinsCount)
      const denom = sumHueW > 1e-9 ? sumHueW : 1
      for (let i = 0; i < hueBinsCount; i++) hueBinsNorm[i] = hueBins[i]! / denom

      // smoothing
      const a = expAlpha(dtSec, Math.max(0.05, s.smoothingSec))

      this.emaBrightness += a * (meanB - this.emaBrightness)
      this.emaSaturation += a * (meanS - this.emaSaturation)
      this.emaContrast += a * (stdY - this.emaContrast)
      this.emaMotion += a * (motion - this.emaMotion)
      this.emaEdge += a * (edge - this.emaEdge)

      // circular smoothing for hue
      const rad = (dominantHue * Math.PI) / 180
      const hx = Math.cos(rad)
      const hy = Math.sin(rad)
      this.emaHueX += a * (hx - this.emaHueX)
      this.emaHueY += a * (hy - this.emaHueY)
      const smHue = wrapHueDeg((Math.atan2(this.emaHueY, this.emaHueX) * 180) / Math.PI)

      if (!this.emaHueBins || this.emaHueBins.length !== hueBinsNorm.length) {
        this.emaHueBins = new Float32Array(hueBinsNorm)
      } else {
        for (let i = 0; i < hueBinsNorm.length; i++) {
          this.emaHueBins[i]! += a * (hueBinsNorm[i]! - this.emaHueBins[i]!)
        }
      }

      this.prevGray = gray

      const f: VideoFeatures = {
        t: now,
        size,
        fps,
        hue: smHue,
        palette,
        hueBins: Array.from(this.emaHueBins),
        brightness: clamp01(this.emaBrightness),
        saturation: clamp01(this.emaSaturation),
        contrast: clamp01(this.emaContrast * 2.6), // perceptual scaling
        motion: clamp01(this.emaMotion),
        edge: clamp01(this.emaEdge),
      }

      onFeatures(f)

      // schedule next
      this.timer = window.setTimeout(tick, Math.round(1000 / fps))
    }

    tick()
  }

  stop(): void {
    if (this.timer != null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    this.prevGray = null
    this.lastT = null
  }
}
