import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Mic, Square } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { centsFromFrequency, detectPitch, frequencyToNote } from './tuner'

const IN_TUNE_THRESHOLD = 5
const GUITAR_STRINGS = [
  { number: 6, note: 'E', octave: 2, frequency: 82.4069 },
  { number: 5, note: 'A', octave: 2, frequency: 110.0000 },
  { number: 4, note: 'D', octave: 3, frequency: 146.8324 },
  { number: 3, note: 'G', octave: 3, frequency: 195.9977 },
  { number: 2, note: 'B', octave: 3, frequency: 246.9417 },
  { number: 1, note: 'E', octave: 4, frequency: 329.6276 },
]

type TunerState = { frequency: number; cents: number; note: string; octave: number } | null

export function TunerPage() {
  const navigate = useNavigate()
  const [selectedString, setSelectedString] = useState(GUITAR_STRINGS[0])
  const [isRunning, setIsRunning] = useState(false)
  const [pitch, setPitch] = useState<TunerState>(null)
  const [message, setMessage] = useState('Play a string')
  const [error, setError] = useState('')
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const smoothedFrequencyRef = useRef<number | null>(null)

  const stopTuner = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    smoothedFrequencyRef.current = null
    setIsRunning(false)
    setPitch(null)
    setMessage('Play a string')
  }

  useEffect(() => stopTuner, [])

  const startTuner = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError('This browser does not support the microphone features required for the tuner.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } })
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0
      source.connect(analyser)
      streamRef.current = stream
      audioContextRef.current = context
      analyserRef.current = analyser
      setIsRunning(true)
      const buffer = new Float32Array(analyser.fftSize)
      const readPitch = () => {
        analyser.getFloatTimeDomainData(buffer)
        const result = detectPitch(buffer, context.sampleRate, selectedString.frequency)
        if (result && result.confidence >= 0.78) {
          const previous = smoothedFrequencyRef.current
          const frequency = previous && Math.abs(result.frequency - previous) / previous < 0.12 ? previous * 0.7 + result.frequency * 0.3 : result.frequency
          smoothedFrequencyRef.current = frequency
          const detectedNote = frequencyToNote(frequency)
          setPitch({ frequency, cents: centsFromFrequency(frequency, selectedString.frequency), note: detectedNote.name, octave: detectedNote.octave })
          setMessage('')
        } else if (!smoothedFrequencyRef.current) setMessage('Listening...')
        frameRef.current = requestAnimationFrame(readPitch)
      }
      readPitch()
    } catch (startError) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      const permissionMessage = startError instanceof DOMException && startError.name === 'NotAllowedError' ? 'Microphone permission is required to use the tuner. Allow access in your browser, then try again.' : 'The microphone could not be started. Check your browser and microphone, then try again.'
      setError(permissionMessage)
      setIsRunning(false)
    }
  }

  const changeString = (nextString: typeof GUITAR_STRINGS[number]) => {
    setSelectedString(nextString)
    smoothedFrequencyRef.current = null
    setPitch(null)
    setMessage(isRunning ? 'Listening...' : 'Play a string')
  }

  const cents = pitch?.cents ?? 0
  const status = !pitch ? 'Waiting' : Math.abs(cents) <= IN_TUNE_THRESHOLD ? 'In Tune' : cents < 0 ? 'Too Low' : 'Too High'
  const indicatorPosition = pitch ? Math.max(-100, Math.min(100, cents * 3)) : 0

  return (
    <div className="page tuner-page">
      <header className="tuner-header">
        <button className="icon-button" onClick={() => { stopTuner(); navigate(-1) }} aria-label="Go back" title="Go back"><ArrowLeft size={18} /></button>
        <div><div className="eyebrow">Instrument tool</div><h1>Guitar Tuner</h1></div>
      </header>
      <section className="tuner-panel" aria-live="polite">
        <div className="tuner-status">{status}</div>
        <div className="tuner-note">{pitch ? pitch.note : '—'}<small>{pitch ? pitch.octave : ''}</small></div>
        <div className="tuner-frequency">{pitch ? `${pitch.frequency.toFixed(2)} Hz` : message}</div>
        <div className="tuner-cents">{pitch ? `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents` : 'Select a string, then play one note'}</div>
        <div className={`tuner-indicator ${status.toLowerCase().replace(' ', '-')}`}>
          <span className="tuner-indicator-label">Too Low</span>
          <div className="tuner-scale"><span className="tuner-center" /><span className="tuner-needle" style={{ transform: `translateX(${indicatorPosition}%)` }} /></div>
          <span className="tuner-indicator-label">Too High</span>
        </div>
        <div className="tuner-reference"><span>Target</span><strong>{selectedString.note}{selectedString.octave}</strong><small>{selectedString.frequency.toFixed(2)} Hz · A4 = 440 Hz</small></div>
        {error && <p className="tuner-error" role="alert">{error}</p>}
        <button className="primary-button tuner-toggle" onClick={isRunning ? stopTuner : startTuner}>{isRunning ? <><Square size={15} />Stop Tuner</> : <><Mic size={15} />Start Tuner</>}</button>
      </section>
      <section className="tuner-strings" aria-label="Guitar strings">
        <div className="eyebrow">Standard tuning</div>
        <div className="string-grid">{GUITAR_STRINGS.map((guitarString) => <button key={guitarString.number} className={selectedString.number === guitarString.number ? 'string-choice active' : 'string-choice'} onClick={() => changeString(guitarString)}><span>{guitarString.number}th</span><strong>{guitarString.note}</strong><small>{guitarString.frequency.toFixed(2)} Hz</small></button>)}</div>
      </section>
    </div>
  )
}