import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Mic, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { centsFromFrequency, detectPitch, frequencyToNote, GUITAR_STRINGS, nearestString, TUNER_AUDIO, type GuitarString } from './tuner'

export const IN_TUNE_THRESHOLD = 5
const CLOSE_THRESHOLD = 15
const HISTORY_LIMIT = 7
const STALE_PITCH_MS = 420
const REQUIRED_STABLE_FRAMES = 3
const DISPLAY_INTERVAL_MS = 55

type DetectedTuning = {
  frequency: number
  cents: number
  note: string
  octave: number
  string: GuitarString
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function TunerPage() {
  const navigate = useNavigate()
  const [isRunning, setIsRunning] = useState(false)
  const [pitch, setPitch] = useState<DetectedTuning | null>(null)
  const [selectedString, setSelectedString] = useState<GuitarString | null>(null)
  const [message, setMessage] = useState('Ready to tune')
  const [error, setError] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frequencyHistoryRef = useRef<number[]>([])
  const lastDetectedAtRef = useRef(0)
  const lastDisplayAtRef = useRef(0)
  const stableStringRef = useRef<number | null>(null)
  const stableFramesRef = useRef(0)
  const selectedStringRef = useRef<GuitarString | null>(null)
  const startRequestRef = useRef(0)
  const startingRef = useRef(false)

  useEffect(() => {
    selectedStringRef.current = selectedString
  }, [selectedString])

  const stopTuner = () => {
    startRequestRef.current += 1
    startingRef.current = false
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    frequencyHistoryRef.current = []
    lastDetectedAtRef.current = 0
    lastDisplayAtRef.current = 0
    stableStringRef.current = null
    stableFramesRef.current = 0
    setIsRunning(false)
    setPitch(null)
    setMessage('Ready to tune')
  }

  const startTuner = async () => {
    setError('')
    if (startingRef.current || audioContextRef.current) return
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError('This browser does not support microphone tuning. Try a current browser with microphone access.')
      return
    }

    startingRef.current = true
    const requestId = ++startRequestRef.current
    let pendingStream: MediaStream | null = null
    let pendingContext: AudioContext | null = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false, channelCount: 1 },
      })
      pendingStream = stream
      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const context = new AudioContext()
      pendingContext = context
      await context.resume()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0
      source.connect(analyser)
      streamRef.current = stream
      audioContextRef.current = context
      pendingStream = null
      pendingContext = null
      analyserRef.current = analyser
      startingRef.current = false
      setIsRunning(true)
      setMessage('Play a string')

      const buffer = new Float32Array(analyser.fftSize)
      const readPitch = () => {
        const currentAnalyser = analyserRef.current
        if (!currentAnalyser) return
        currentAnalyser.getFloatTimeDomainData(buffer)
        const result = detectPitch(buffer, context.sampleRate)
        const now = performance.now()

        if (result) {
          const history = [...frequencyHistoryRef.current, result.frequency].slice(-HISTORY_LIMIT)
          frequencyHistoryRef.current = history
          const stableFrequency = median(history)
          const detectedString = nearestString(stableFrequency)
          if (stableStringRef.current === detectedString.number) stableFramesRef.current += 1
          else {
            stableStringRef.current = detectedString.number
            stableFramesRef.current = 1
          }
          if (stableFramesRef.current >= REQUIRED_STABLE_FRAMES && now - lastDisplayAtRef.current >= DISPLAY_INTERVAL_MS) {
            const target = selectedStringRef.current ?? detectedString
            const targetCents = centsFromFrequency(stableFrequency, target.frequency)
            if (selectedStringRef.current && Math.abs(targetCents) > TUNER_AUDIO.maxDetuneCents) {
              frequencyHistoryRef.current = []
              stableStringRef.current = null
              stableFramesRef.current = 0
              setPitch(null)
              setMessage('Listening for selected string')
              frameRef.current = requestAnimationFrame(readPitch)
              return
            }
            const detectedNote = frequencyToNote(stableFrequency)
            setPitch({
              frequency: stableFrequency,
              cents: clamp(targetCents, -50, 50),
              note: detectedNote.name,
              octave: detectedNote.octave,
              string: target,
            })
            lastDisplayAtRef.current = now
            lastDetectedAtRef.current = now
            setMessage('')
          }
        } else if (now - lastDetectedAtRef.current > STALE_PITCH_MS) {
          frequencyHistoryRef.current = []
          stableStringRef.current = null
          stableFramesRef.current = 0
          setPitch(null)
          setMessage('Listening...')
        }
        frameRef.current = requestAnimationFrame(readPitch)
      }
      readPitch()
    } catch (startError) {
      startingRef.current = false
      pendingStream?.getTracks().forEach((track) => track.stop())
      void pendingContext?.close()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      const permissionMessage = startError instanceof DOMException && startError.name === 'NotAllowedError'
        ? 'Microphone access is required to use the tuner.'
        : 'The microphone could not be started. Check your browser and microphone, then try again.'
      setError(permissionMessage)
      setIsRunning(false)
    }
  }

  useEffect(() => () => stopTuner(), [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && audioContextRef.current?.state === 'suspended') void audioContextRef.current.resume()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const cents = pitch?.cents ?? 0
  const status = !pitch ? (isRunning ? 'LISTENING' : 'READY') : Math.abs(cents) <= IN_TUNE_THRESHOLD ? 'IN TUNE' : cents < 0 ? 'TOO LOW' : 'TOO HIGH'
  const statusClass = !pitch ? 'waiting' : Math.abs(cents) <= IN_TUNE_THRESHOLD ? 'in-tune' : cents < 0 ? 'too-low' : 'too-high'
  const indicatorPosition = pitch ? clamp(50 + cents, 6, 94) : 50

  return (
    <div className="page tuner-page">
      <header className="tuner-header">
        <button className="icon-button" onClick={() => { stopTuner(); navigate(-1) }} aria-label="Go back" title="Go back"><ArrowLeft size={18} /></button>
        <div><div className="eyebrow">Standard tuning</div><h1>Guitar Tuner</h1></div>
      </header>

      <section className={`tuner-panel ${statusClass}`} aria-live="polite">
        <div className="tuner-status">{status}</div>
        <div className="tuner-note-wrap">
          <div className="tuner-note">{pitch ? pitch.note : '--'}<small>{pitch ? pitch.octave : ''}</small></div>
          <div className="tuner-meta"><div className="tuner-frequency">{pitch ? `${pitch.frequency.toFixed(2)} Hz` : message}</div><div className="tuner-cents">{pitch ? `${cents > 0 ? '+' : ''}${cents.toFixed(1)} cents` : 'Pluck one string at a time'}</div></div>
        </div>
        <div className="tuner-meter" aria-label={`${status}, ${pitch ? `${cents.toFixed(1)} cents` : 'no pitch detected'}`}>
          <div className="tuner-meter-labels"><span>FLAT</span><span>IN TUNE</span><span>SHARP</span></div>
          <div className="tuner-meter-track"><span className="tuner-center-mark" /><span className="tuner-needle" style={{ left: `${indicatorPosition}%` }} /></div>
          <div className="tuner-meter-scale"><span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span></div>
        </div>
        <div className="tuner-detected"><span>{selectedString ? 'Target string' : 'Detected string'}</span><strong>{pitch ? `${pitch.string.number} · ${pitch.string.note}${pitch.string.octave}` : '--'}</strong><small>{selectedString ? `Tune to ${selectedString.note}${selectedString.octave}` : 'Automatic'}</small></div>
        {error && <p className="tuner-error" role="alert">{error}</p>}
        <button className="primary-button tuner-toggle" onClick={() => void (isRunning ? stopTuner() : startTuner())}>{isRunning ? <><Square size={15} />Stop Tuning</> : <><Mic size={15} />Start Tuning</>}</button>
      </section>

      <section className="tuner-strings" aria-label="Guitar strings">
        <div className="tuner-string-heading"><div><div className="eyebrow">String target</div><strong>{selectedString ? `${selectedString.number} string selected` : 'Automatic string detection'}</strong></div><button className={`text-button tuner-auto${selectedString ? '' : ' active'}`} onClick={() => setSelectedString(null)}>Auto</button></div>
        <div className="string-grid">{GUITAR_STRINGS.map((guitarString) => <button type="button" key={guitarString.number} className={`string-choice${selectedString?.number === guitarString.number || (!selectedString && pitch?.string.number === guitarString.number) ? ' active' : ''}`} onClick={() => setSelectedString(guitarString)} aria-label={`Select string ${guitarString.number}, ${guitarString.note}${guitarString.octave}`}><span>{guitarString.number}</span><strong>{guitarString.note}</strong><small>{guitarString.octave}</small></button>)}</div>
        <p className="tuner-reference">Standard tuning · A4 = 440 Hz · {TUNER_AUDIO.minFrequency}-{TUNER_AUDIO.maxFrequency} Hz detection range</p>
      </section>
    </div>
  )
}
