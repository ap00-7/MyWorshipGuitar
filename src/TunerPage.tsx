import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Mic, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { centsFromFrequency, detectPitch, frequencyToNote, GUITAR_STRINGS, nearestString } from './tuner'

export const IN_TUNE_THRESHOLD = 5
const HISTORY_LIMIT = 8
const MIN_CONFIDENCE = 0.6

type DetectedTuning = {
  frequency: number
  cents: number
  note: string
  octave: number
  string: typeof GUITAR_STRINGS[number]
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function weightedAverage(values: number[]) {
  if (!values.length) return 0
  const weights = values.map((_, index) => index + 1)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function TunerPage() {
  const navigate = useNavigate()
  const [isRunning, setIsRunning] = useState(false)
  const [pitch, setPitch] = useState<DetectedTuning | null>(null)
  const [message, setMessage] = useState('Play a string')
  const [error, setError] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frequencyHistoryRef = useRef<number[]>([])
  const startRequestRef = useRef(0)
  const startingRef = useRef(false)

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
    setIsRunning(false)
    setPitch(null)
    setMessage('Play a string')
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          channelCount: 1,
        },
      })

      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0.15
      source.connect(analyser)

      streamRef.current = stream
      audioContextRef.current = context
      analyserRef.current = analyser
      startingRef.current = false
      setIsRunning(true)
      setMessage('Listening…')

      const buffer = new Float32Array(analyser.fftSize)
      const readPitch = () => {
        const currentAnalyser = analyserRef.current
        if (!currentAnalyser) return

        currentAnalyser.getFloatTimeDomainData(buffer)
        const result = detectPitch(buffer, context.sampleRate)

        if (result && result.confidence >= MIN_CONFIDENCE) {
          const nextHistory = [...frequencyHistoryRef.current, result.frequency].slice(-HISTORY_LIMIT)
          const smoothedFrequency = nextHistory.length >= 3
            ? weightedAverage(nextHistory) * 0.65 + median(nextHistory) * 0.35
            : result.frequency

          frequencyHistoryRef.current = nextHistory
          const detectedString = nearestString(smoothedFrequency)
          const detectedNote = frequencyToNote(smoothedFrequency)
          const cents = centsFromFrequency(smoothedFrequency, detectedString.frequency)

          setPitch({
            frequency: smoothedFrequency,
            cents: clamp(cents, -50, 50),
            note: detectedNote.name,
            octave: detectedNote.octave,
            string: detectedString,
          })
          setMessage('')
        } else {
          frequencyHistoryRef.current = []
          setPitch(null)
          setMessage('Listening…')
        }

        frameRef.current = requestAnimationFrame(readPitch)
      }

      readPitch()
    } catch (startError) {
      startingRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      const permissionMessage = startError instanceof DOMException && startError.name === 'NotAllowedError'
        ? 'Microphone permission is required. Allow access in your browser, then try again.'
        : 'The microphone could not be started. Check your browser and microphone, then try again.'
      setError(permissionMessage)
      setIsRunning(false)
    }
  }

  useEffect(() => {
    void startTuner()
    return stopTuner
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning && audioContextRef.current?.state === 'suspended') {
        void audioContextRef.current.resume()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isRunning])

  const cents = pitch?.cents ?? 0
  const status = !pitch ? 'LISTENING' : Math.abs(cents) <= IN_TUNE_THRESHOLD ? 'IN TUNE' : cents < 0 ? 'TOO LOW' : 'TOO HIGH'
  const statusClass = !pitch ? 'waiting' : Math.abs(cents) <= IN_TUNE_THRESHOLD ? 'in-tune' : cents < 0 ? 'too-low' : 'too-high'
  const indicatorPosition = pitch ? clamp(50 + cents * 1.25, 8, 92) : 50

  return (
    <div className="page tuner-page">
      <header className="tuner-header">
        <button
          className="icon-button"
          onClick={() => {
            stopTuner()
            navigate(-1)
          }}
          aria-label="Go back"
          title="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="eyebrow">Chromatic instrument tool</div>
          <h1>Guitar Tuner</h1>
        </div>
      </header>

      <section className={`tuner-panel ${statusClass}`} aria-live="polite">
        <div className="tuner-status">{status}</div>

        <div className="tuner-note-wrap">
          <div className="tuner-note">{pitch ? pitch.note : '--'}<small>{pitch ? pitch.octave : ''}</small></div>
          <div className="tuner-meta">
            <div className="tuner-frequency">{pitch ? `${pitch.frequency.toFixed(2)} Hz` : message}</div>
            <div className="tuner-cents">{pitch ? `${cents > 0 ? '+' : ''}${Math.round(cents)} cents` : 'Listening for any standard guitar string'}</div>
          </div>
        </div>

        <div className="tuner-meter" aria-label={status}>
          <div className="tuner-meter-track">
            {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((tick) => (
              <span
                key={tick}
                className="tuner-meter-tick"
                style={{ left: `${((tick + 50) / 100) * 100}%` }}
              >
                <small>{tick}</small>
              </span>
            ))}
            <span className="tuner-center-mark" />
            <span className="tuner-needle" style={{ left: `${indicatorPosition}%` }} />
          </div>
        </div>

        <div className="tuner-detected">
          <span>Closest string</span>
          <strong>{pitch ? `${pitch.string.number}th string` : '--'}</strong>
          <small>{pitch ? `${pitch.string.note}${pitch.string.octave}` : 'Play one string'}</small>
        </div>

        {error && <p className="tuner-error" role="alert">{error}</p>}

        {(!isRunning || error) && (
          <button className="primary-button tuner-toggle" onClick={isRunning ? stopTuner : startTuner}>
            {isRunning ? <><Square size={15} />Stop Tuner</> : <><Mic size={15} />Enable Microphone</>}
          </button>
        )}

        {isRunning && !error && (
          <button className="text-button tuner-stop" onClick={stopTuner}>
            <Square size={14} />Stop listening
          </button>
        )}
      </section>

      <section className="tuner-strings" aria-label="Guitar strings">
        <div className="eyebrow">Standard tuning · A4 = 440 Hz</div>
        <div className="string-grid">
          {GUITAR_STRINGS.map((guitarString) => (
            <div
              key={guitarString.number}
              className={pitch?.string.number === guitarString.number ? 'string-choice active' : 'string-choice'}
            >
              <span>{guitarString.number}th</span>
              <strong>{guitarString.note}{guitarString.octave}</strong>
              <small>{guitarString.frequency.toFixed(2)} Hz</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
