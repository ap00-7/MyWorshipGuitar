export class MetronomeEngine {
  private context: AudioContext | null = null
  private nextNoteTime = 0
  private beat = 0
  private schedulerId: number | null = null
  private bpm = 80
  private readonly scheduleAheadTime = 0.1

  setTempo(bpm: number) {
    this.bpm = Math.min(240, Math.max(40, bpm))
  }

  async start() {
    if (this.schedulerId !== null) return
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) throw new Error('Web Audio is not supported in this browser.')
    this.context ??= new AudioContextConstructor()
    await this.context.resume()
    this.beat = 0
    this.nextNoteTime = this.context.currentTime + 0.05
    this.schedulerId = window.setInterval(() => this.scheduleAhead(), 25)
    this.scheduleAhead()
  }

  stop() {
    if (this.schedulerId !== null) window.clearInterval(this.schedulerId)
    this.schedulerId = null
    this.beat = 0
  }

  async dispose() {
    this.stop()
    await this.context?.close()
    this.context = null
  }

  private scheduleAhead() {
    if (!this.context) return
    const secondsPerBeat = 60 / this.bpm
    while (this.nextNoteTime < this.context.currentTime + this.scheduleAheadTime) {
      this.scheduleClick(this.nextNoteTime, this.beat === 0)
      this.nextNoteTime += secondsPerBeat
      this.beat = (this.beat + 1) % 4
    }
  }

  private scheduleClick(time: number, accent: boolean) {
    if (!this.context) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(accent ? 1320 : 920, time)
    const targetVolume = accent ? 0.18 : 0.12
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(targetVolume, time + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.start(time)
    oscillator.stop(time + 0.07)
  }
}
