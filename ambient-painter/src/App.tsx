import {
  Accordion,
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { VideoFeatures } from './analysis'
import { VideoAnalyzer } from './analysis'
import { AmbientEngine } from './audio'
import { PRESETS, useRuntime, useSettings } from './state'
import type { ChordColor, ScaleMode } from './state'

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function formatPct01(x: number): string {
  return `${Math.round(clamp01(x) * 100)}%`
}

function pct(x: number): number {
  return Math.round(clamp01(x) * 100)
}

function safeErr(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyzerRef = useRef<VideoAnalyzer | null>(null)
  const engineRef = useRef<AmbientEngine | null>(null)

  const presetId = useSettings((s) => s.presetId)
  const applyPreset = useSettings((s) => s.applyPreset)
  const resetAll = useSettings((s) => s.resetAll)

  const analysis = useSettings((s) => s.analysis)
  const harmony = useSettings((s) => s.harmony)
  const texture = useSettings((s) => s.texture)
  const air = useSettings((s) => s.air)
  const fx = useSettings((s) => s.fx)
  const master = useSettings((s) => s.master)
  const ui = useSettings((s) => s.ui)

  const setAnalysis = useSettings((s) => s.setAnalysis)
  const setHarmony = useSettings((s) => s.setHarmony)
  const setTexture = useSettings((s) => s.setTexture)
  const setAir = useSettings((s) => s.setAir)
  const setFx = useSettings((s) => s.setFx)
  const setMaster = useSettings((s) => s.setMaster)
  const setUi = useSettings((s) => s.setUi)

  const devices = useRuntime((s) => s.devices)
  const features = useRuntime((s) => s.features)
  const cameraStatus = useRuntime((s) => s.cameraStatus)
  const cameraError = useRuntime((s) => s.cameraError)
  const audioStatus = useRuntime((s) => s.audioStatus)
  const audioError = useRuntime((s) => s.audioError)
  const setDevices = useRuntime((s) => s.setDevices)
  const setFeatures = useRuntime((s) => s.setFeatures)
  const setCameraStatus = useRuntime((s) => s.setCameraStatus)
  const setAudioStatus = useRuntime((s) => s.setAudioStatus)

  const deviceOptions = useMemo(
    () =>
      devices.map((d, i) => ({
        value: d.deviceId,
        label: d.label?.trim() || `Camera ${i + 1}`,
      })),
    [devices],
  )

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
    } catch {
      // ignore
    }
  }, [setDevices])

  const stopCamera = useCallback(() => {
    analyzerRef.current?.stop()
    analyzerRef.current = null

    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setFeatures(null)
    setCameraStatus('idle')
  }, [setCameraStatus, setFeatures])

  const startCamera = useCallback(
    async (deviceId?: string) => {
      try {
        setCameraStatus('starting')

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('getUserMedia is not available in this browser')
        }

        // stop previous
        stopCamera()

        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream

        const video = videoRef.current
        if (!video) throw new Error('Video element not mounted')

        video.srcObject = stream
        video.playsInline = true
        video.muted = true

        await video.play()

        // device list becomes available with labels after permission
        void refreshDevices()

        // start analysis
        const analyzer = new VideoAnalyzer(() => useSettings.getState().analysis)
        analyzerRef.current = analyzer
        analyzer.start(video, (f: VideoFeatures) => {
          useRuntime.getState().setFeatures(f)
        })

        setCameraStatus('running')
      } catch (e) {
        const msg = safeErr(e)
        setCameraStatus('error', msg)
        notifications.show({
          color: 'red',
          title: 'Camera error',
          message: msg,
        })
      }
    },
    [refreshDevices, setCameraStatus, stopCamera],
  )

  const stopAudio = useCallback(() => {
    try {
      engineRef.current?.stop()
    } finally {
      setAudioStatus('stopped')
    }
  }, [setAudioStatus])

  const startAudio = useCallback(async () => {
    try {
      setAudioStatus('starting')
      if (!engineRef.current) {
        engineRef.current = new AmbientEngine(() => useSettings.getState())
      }
      await engineRef.current.start()
      setAudioStatus('running')
    } catch (e) {
      const msg = safeErr(e)
      setAudioStatus('error', msg)
      notifications.show({
        color: 'red',
        title: 'Audio error',
        message: msg,
      })
    }
  }, [setAudioStatus])

  // keep engine updated with the latest features
  useEffect(() => {
    engineRef.current?.setFeatures(features)
  }, [features])

  // initial devices list + hot-plug
  useEffect(() => {
    void refreshDevices()
    const md = navigator.mediaDevices
    const onChange = () => void refreshDevices()
    md?.addEventListener?.('devicechange', onChange)
    return () => md?.removeEventListener?.('devicechange', onChange)
  }, [refreshDevices])

  // cleanup
  useEffect(() => {
    return () => {
      stopAudio()
      stopCamera()
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [stopAudio, stopCamera])

  const statusBadge = (status: string, error?: string | null) => {
    const color = status === 'running' ? 'green' : status === 'starting' ? 'yellow' : status === 'error' ? 'red' : 'gray'
    return (
      <Tooltip label={error || status} disabled={!error}>
        <Badge color={color} variant="light">
          {status}
        </Badge>
      </Tooltip>
    )
  }

  const meters = features
    ? [
        { name: 'Brightness', v: features.brightness },
        { name: 'Saturation', v: features.saturation },
        { name: 'Contrast', v: features.contrast },
        { name: 'Motion', v: features.motion },
        { name: 'Edge', v: features.edge },
      ]
    : []

  return (
    <AppShell
      header={{ height: 64 }}
      padding="md"
      styles={{
        main: {
          background:
            'radial-gradient(1200px 800px at 15% 15%, rgba(132, 94, 247, 0.15) 0%, rgba(0,0,0,0) 60%), radial-gradient(1000px 700px at 90% 10%, rgba(0, 204, 255, 0.10) 0%, rgba(0,0,0,0) 55%), #0b0d10',
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Title order={3}>Ambient Painter</Title>
            <Badge variant="outline" color="violet">
              camera→music
            </Badge>
          </Group>

          <Group gap="sm">
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                Camera
              </Text>
              {statusBadge(cameraStatus, cameraError)}
            </Group>
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                Audio
              </Text>
              {statusBadge(audioStatus, audioError)}
            </Group>

            <Divider orientation="vertical" />

            <Button
              variant={cameraStatus === 'running' ? 'light' : 'filled'}
              color="cyan"
              onClick={() => (cameraStatus === 'running' ? stopCamera() : startCamera(ui.cameraDeviceId || undefined))}
            >
              {cameraStatus === 'running' ? 'Stop camera' : 'Start camera'}
            </Button>

            <Button
              variant={audioStatus === 'running' ? 'light' : 'filled'}
              color="violet"
              onClick={() => (audioStatus === 'running' ? stopAudio() : startAudio())}
            >
              {audioStatus === 'running' ? 'Stop audio' : 'Start audio'}
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper withBorder radius="lg" p={0} style={{ overflow: 'hidden' }}>
              <Box style={{ position: 'relative' }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    objectFit: 'cover',
                    display: 'block',
                    background: '#000',
                  }}
                />

                <Box
                  style={{
                    position: 'absolute',
                    left: 12,
                    right: 12,
                    bottom: 12,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  {features ? (
                    <Paper
                      radius="md"
                      p="sm"
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={6} style={{ minWidth: 210 }}>
                          <Group gap={6}>
                            <Badge color="cyan" variant="light">
                              hue {Math.round(features.hue)}°
                            </Badge>
                            <Badge color="violet" variant="light">
                              {analysis.size}px @ {analysis.fps}fps
                            </Badge>
                          </Group>

                          <Group gap={6} wrap="nowrap">
                            {features.palette.map((c) => (
                              <Box
                                key={c}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  background: c,
                                  border: '1px solid rgba(255,255,255,0.25)',
                                }}
                              />
                            ))}
                          </Group>
                        </Stack>

                        <Stack gap={8} style={{ flex: 1 }}>
                          {meters.map((m) => (
                            <Box key={m.name}>
                              <Group justify="space-between" gap={8} mb={4}>
                                <Text size="xs" c="dimmed">
                                  {m.name}
                                </Text>
                                <Code fz={11}>{formatPct01(m.v)}</Code>
                              </Group>
                              <Progress size="sm" value={pct(m.v)} />
                            </Box>
                          ))}
                        </Stack>
                      </Group>
                    </Paper>
                  ) : (
                    <Paper
                      radius="md"
                      p="md"
                      style={{
                        background: 'rgba(0,0,0,0.38)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Center>
                        <Stack gap={6} align="center">
                          <Text c="dimmed">Start the camera to drive the music.</Text>
                          <Text size="sm" c="dimmed">
                            Совет: поставь холст так, чтобы в кадре были мазки и цвета.
                          </Text>
                        </Stack>
                      </Center>
                    </Paper>
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper withBorder radius="lg" p="md" style={{ height: 'calc(100vh - 64px - 32px)' }}>
              <ScrollArea h="100%" offsetScrollbars>
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Title order={4}>Controls</Title>
                      <Text size="sm" c="dimmed">
                        Пресеты + тонкая настройка. Всё сохраняется в браузере.
                      </Text>
                    </Stack>

                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        onClick={() => {
                          resetAll()
                          notifications.show({
                            color: 'gray',
                            title: 'Settings reset',
                            message: 'Вернул настройки по умолчанию.',
                          })
                        }}
                      >
                        ↺
                      </ActionIcon>
                      <Switch
                        size="sm"
                        label="Advanced"
                        checked={ui.showAdvanced}
                        onChange={(e) => setUi({ showAdvanced: e.currentTarget.checked })}
                      />
                    </Group>
                  </Group>

                  <Divider />

                  <Stack gap={8}>
                    <Select
                      label="Preset"
                      value={presetId}
                      data={PRESETS.map((p) => ({ value: p.id, label: p.name }))}
                      onChange={(v) => v && applyPreset(v)}
                      description={PRESETS.find((p) => p.id === presetId)?.description}
                      searchable
                    />

                    <Select
                      label="Camera"
                      value={ui.cameraDeviceId || null}
                      data={deviceOptions}
                      onChange={(v) => {
                        const next = v || ''
                        setUi({ cameraDeviceId: next })
                        if (cameraStatus === 'running') {
                          void startCamera(next || undefined)
                        }
                      }}
                      placeholder={deviceOptions.length ? 'Choose camera…' : 'No cameras detected'}
                      rightSection={
                        <Button size="xs" variant="subtle" onClick={() => void refreshDevices()}>
                          ↻
                        </Button>
                      }
                    />
                  </Stack>

                  <Accordion variant="contained" radius="md" defaultValue="analysis">
                    <Accordion.Item value="analysis">
                      <Accordion.Control>Analysis</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <Slider
                            label="Downscale size"
                            min={48}
                            max={160}
                            step={8}
                            value={analysis.size}
                            onChange={(v) => setAnalysis({ size: v })}
                          />
                          <Slider
                            label="Analysis FPS"
                            min={8}
                            max={30}
                            step={1}
                            value={analysis.fps}
                            onChange={(v) => setAnalysis({ fps: v })}
                          />
                          <Slider
                            label="Smoothing (sec)"
                            min={0.15}
                            max={2.2}
                            step={0.05}
                            value={analysis.smoothingSec}
                            onChange={(v) => setAnalysis({ smoothingSec: v })}
                          />

                          {ui.showAdvanced ? (
                            <>
                              <Slider
                                label="Hue bins"
                                min={12}
                                max={60}
                                step={2}
                                value={analysis.hueBins}
                                onChange={(v) => setAnalysis({ hueBins: v })}
                              />
                              <Slider
                                label="Palette size"
                                min={2}
                                max={8}
                                step={1}
                                value={analysis.paletteSize}
                                onChange={(v) => setAnalysis({ paletteSize: v })}
                              />
                              <Slider
                                label="Motion gain"
                                min={4}
                                max={40}
                                step={1}
                                value={analysis.motionGain}
                                onChange={(v) => setAnalysis({ motionGain: v })}
                              />
                              <Slider
                                label="Edge gain"
                                min={2}
                                max={24}
                                step={1}
                                value={analysis.edgeGain}
                                onChange={(v) => setAnalysis({ edgeGain: v })}
                              />
                              <Slider
                                label="Edge threshold"
                                min={0.06}
                                max={0.28}
                                step={0.01}
                                value={analysis.edgeThreshold}
                                onChange={(v) => setAnalysis({ edgeThreshold: v })}
                              />
                            </>
                          ) : null}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="harmony">
                      <Accordion.Control>Harmony</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <Select
                            label="Mode"
                            value={harmony.mode}
                            data={[
                              { value: 'lydian', label: 'Lydian (angelic)' },
                              { value: 'dorian', label: 'Dorian (warm)' },
                              { value: 'ionian', label: 'Ionian (major)' },
                              { value: 'aeolian', label: 'Aeolian (minor)' },
                              { value: 'mixolydian', label: 'Mixolydian' },
                              { value: 'phrygian', label: 'Phrygian (tense)' },
                              { value: 'harmonic-minor', label: 'Harmonic minor' },
                              { value: 'pentatonic-major', label: 'Pentatonic major' },
                              { value: 'pentatonic-minor', label: 'Pentatonic minor' },
                            ]}
                            onChange={(v) => v && setHarmony({ mode: v as ScaleMode })}
                          />
                          <Select
                            label="Chord color"
                            value={harmony.chordColor}
                            data={[
                              { value: 'add9', label: 'Add9 (airy)' },
                              { value: 'seventh', label: '7th (rich)' },
                              { value: 'triad', label: 'Triad' },
                              { value: 'sus2', label: 'Sus2' },
                              { value: 'sus4', label: 'Sus4' },
                            ]}
                            onChange={(v) => v && setHarmony({ chordColor: v as ChordColor })}
                          />

                          <Group grow>
                            <NumberInput
                              label="Base octave"
                              min={1}
                              max={6}
                              value={harmony.baseOctave}
                              onChange={(v) => setHarmony({ baseOctave: Number(v) })}
                            />
                            <NumberInput
                              label="Octave range"
                              min={0}
                              max={4}
                              value={harmony.octaveRangeFromBrightness}
                              onChange={(v) => setHarmony({ octaveRangeFromBrightness: Number(v) })}
                            />
                          </Group>

                          <Slider
                            label="Chord seconds"
                            min={3}
                            max={16}
                            step={0.25}
                            value={harmony.chordSeconds}
                            onChange={(v) => setHarmony({ chordSeconds: v })}
                          />
                          <Slider
                            label="Min chord seconds (when motion high)"
                            min={2.5}
                            max={12}
                            step={0.25}
                            value={harmony.chordSecondsMin}
                            onChange={(v) => setHarmony({ chordSecondsMin: v })}
                          />

                          <Slider
                            label="Root follows hue"
                            min={0}
                            max={1}
                            step={0.02}
                            value={harmony.rootFromHue}
                            onChange={(v) => setHarmony({ rootFromHue: v })}
                          />
                          <Slider
                            label="Degree surprise"
                            min={0}
                            max={1}
                            step={0.02}
                            value={harmony.degreeSurprise}
                            onChange={(v) => setHarmony({ degreeSurprise: v })}
                          />
                          <Slider
                            label="Voice spread"
                            min={0}
                            max={1}
                            step={0.02}
                            value={harmony.voiceSpread}
                            onChange={(v) => setHarmony({ voiceSpread: v })}
                          />
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="texture">
                      <Accordion.Control>Texture / Particles</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <Slider
                            label="Particle interval (sec)"
                            min={0.08}
                            max={0.6}
                            step={0.01}
                            value={texture.particleIntervalSec}
                            onChange={(v) => setTexture({ particleIntervalSec: v })}
                          />
                          <Slider
                            label="Density base"
                            min={0}
                            max={0.7}
                            step={0.01}
                            value={texture.densityBase}
                            onChange={(v) => setTexture({ densityBase: v })}
                          />
                          <Slider
                            label="Density from motion"
                            min={0}
                            max={1.4}
                            step={0.02}
                            value={texture.densityFromMotion}
                            onChange={(v) => setTexture({ densityFromMotion: v })}
                          />
                          <Slider
                            label="Density from edge"
                            min={0}
                            max={1.2}
                            step={0.02}
                            value={texture.densityFromEdge}
                            onChange={(v) => setTexture({ densityFromEdge: v })}
                          />
                          <Slider
                            label="Velocity"
                            min={0.05}
                            max={1}
                            step={0.01}
                            value={texture.velocity}
                            onChange={(v) => setTexture({ velocity: v })}
                          />

                          <Group grow>
                            <NumberInput
                              label="Register min"
                              min={1}
                              max={8}
                              value={texture.registerMin}
                              onChange={(v) => setTexture({ registerMin: Number(v) })}
                            />
                            <NumberInput
                              label="Register max"
                              min={2}
                              max={9}
                              value={texture.registerMax}
                              onChange={(v) => setTexture({ registerMax: Number(v) })}
                            />
                          </Group>

                          <Group grow>
                            <NumberInput
                              label="Note len min (s)"
                              min={0.03}
                              max={0.5}
                              step={0.01}
                              value={texture.noteLenMinSec}
                              onChange={(v) => setTexture({ noteLenMinSec: Number(v) })}
                            />
                            <NumberInput
                              label="Note len max (s)"
                              min={0.08}
                              max={2}
                              step={0.02}
                              value={texture.noteLenMaxSec}
                              onChange={(v) => setTexture({ noteLenMaxSec: Number(v) })}
                            />
                          </Group>

                          <Slider
                            label="Step bias (more = smoother melody)"
                            min={0}
                            max={1}
                            step={0.02}
                            value={texture.stepBias}
                            onChange={(v) => setTexture({ stepBias: v })}
                          />

                          {ui.showAdvanced ? (
                            <Slider
                              label="Humanize (ms)"
                              min={0}
                              max={60}
                              step={1}
                              value={texture.humanizeMs}
                              onChange={(v) => setTexture({ humanizeMs: v })}
                            />
                          ) : null}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="air">
                      <Accordion.Control>Air / High voices</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <Switch
                            label="Enable air layer"
                            checked={air.enabled}
                            onChange={(e) => setAir({ enabled: e.currentTarget.checked })}
                          />
                          <Slider
                            label="Air amount"
                            min={0}
                            max={1}
                            step={0.02}
                            value={air.amount}
                            onChange={(v) => setAir({ amount: v })}
                          />
                          <Slider
                            label="Air interval (sec)"
                            min={0.4}
                            max={3.5}
                            step={0.05}
                            value={air.intervalSec}
                            onChange={(v) => setAir({ intervalSec: v })}
                          />
                          <Slider
                            label="Air note length (sec)"
                            min={1}
                            max={10}
                            step={0.25}
                            value={air.noteLenSec}
                            onChange={(v) => setAir({ noteLenSec: v })}
                          />
                          <Slider
                            label="Highpass (Hz)"
                            min={600}
                            max={4000}
                            step={50}
                            value={air.highpassHz}
                            onChange={(v) => setAir({ highpassHz: v })}
                          />
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="fx">
                      <Accordion.Control>FX</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <Slider
                            label="Filter (Hz)"
                            min={900}
                            max={18000}
                            step={100}
                            value={fx.filterHz}
                            onChange={(v) => setFx({ filterHz: v })}
                          />
                          <Slider
                            label="Filter Q"
                            min={0.2}
                            max={2.2}
                            step={0.05}
                            value={fx.filterQ}
                            onChange={(v) => setFx({ filterQ: v })}
                          />

                          <Divider label="Reverb" labelPosition="center" />

                          <Slider
                            label="Reverb wet"
                            min={0}
                            max={1}
                            step={0.02}
                            value={fx.reverbWet}
                            onChange={(v) => setFx({ reverbWet: v })}
                          />
                          <Slider
                            label="Reverb decay"
                            min={2}
                            max={18}
                            step={0.25}
                            value={fx.reverbDecay}
                            onChange={(v) => setFx({ reverbDecay: v })}
                          />
                          {ui.showAdvanced ? (
                            <Slider
                              label="Reverb preDelay"
                              min={0}
                              max={0.08}
                              step={0.005}
                              value={fx.reverbPreDelay}
                              onChange={(v) => setFx({ reverbPreDelay: v })}
                            />
                          ) : null}

                          <Divider label="Chorus" labelPosition="center" />

                          <Slider
                            label="Chorus wet"
                            min={0}
                            max={1}
                            step={0.02}
                            value={fx.chorusWet}
                            onChange={(v) => setFx({ chorusWet: v })}
                          />
                          <Slider
                            label="Chorus depth"
                            min={0}
                            max={1}
                            step={0.02}
                            value={fx.chorusDepth}
                            onChange={(v) => setFx({ chorusDepth: v })}
                          />
                          {ui.showAdvanced ? (
                            <Slider
                              label="Chorus rate"
                              min={0.05}
                              max={1.0}
                              step={0.01}
                              value={fx.chorusRate}
                              onChange={(v) => setFx({ chorusRate: v })}
                            />
                          ) : null}

                          <Divider label="Delay" labelPosition="center" />

                          <Slider
                            label="Delay wet"
                            min={0}
                            max={0.5}
                            step={0.01}
                            value={fx.delayWet}
                            onChange={(v) => setFx({ delayWet: v })}
                          />
                          <Slider
                            label="Delay time"
                            min={0.1}
                            max={1.2}
                            step={0.01}
                            value={fx.delayTime}
                            onChange={(v) => setFx({ delayTime: v })}
                          />
                          <Slider
                            label="Delay feedback"
                            min={0}
                            max={0.8}
                            step={0.01}
                            value={fx.delayFeedback}
                            onChange={(v) => setFx({ delayFeedback: v })}
                          />

                          <Slider
                            label="Stereo width"
                            min={0}
                            max={1}
                            step={0.02}
                            value={fx.stereoWidth}
                            onChange={(v) => setFx({ stereoWidth: v })}
                          />
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="master">
                      <Accordion.Control>Master</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          <Slider
                            label="Volume (dB)"
                            min={-30}
                            max={0}
                            step={1}
                            value={master.volumeDb}
                            onChange={(v) => setMaster({ volumeDb: v })}
                          />
                          <Slider
                            label="Limiter threshold (dB)"
                            min={-12}
                            max={-0.1}
                            step={0.1}
                            value={master.limiterDb}
                            onChange={(v) => setMaster({ limiterDb: v })}
                          />
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>

                  {cameraError ? (
                    <Paper withBorder radius="md" p="sm">
                      <Text size="sm" c="red">
                        Camera error: {cameraError}
                      </Text>
                    </Paper>
                  ) : null}

                  {audioError ? (
                    <Paper withBorder radius="md" p="sm">
                      <Text size="sm" c="red">
                        Audio error: {audioError}
                      </Text>
                    </Paper>
                  ) : null}
                </Stack>
              </ScrollArea>
            </Paper>
          </Grid.Col>
        </Grid>
      </AppShell.Main>
    </AppShell>
  )
}
