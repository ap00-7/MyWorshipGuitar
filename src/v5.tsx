import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Copy, Image as ImageIcon, Maximize2, Minimize2, Moon, Plus, Save, Search, Sun, Trash2, Upload, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { capoShapeKey, chooseBestGuitar2Option, formatSundayDate, formatSundayTitle, formatTransposedChordLine, generateCompatibleGuitar2Options, guitar2ProgressionAtCapo, isIsoDate, isSundayIso, keyOptions, nextUnusedSundayIso, normalizeKey, noteIndex, parseChordProgression, shiftKey, simplifyChord, sortSongsByTitle, soundingKey, startingChordOptions, suggestGuitar2Arrangement, suggestGuitar2Progression, toIsoDate, transposeChord, transposeProgressionText, upcomingSundayIso, type Notation } from './music'
import type { Section, Settings, Setlist, Song } from './data'
import { MetronomeEngine } from './metronome'
import { suggestIntros, type IntroSuggestion } from './intro'

const editorKey = () => crypto.randomUUID()

type ChordDefinition = {
  name: string
  root: string
  type: string
  notes: string[]
  strings: number[]
  fingers: string[]
  difficulty: string
  baseFret: number
  barre?: number
}
const rootOptions = ['All', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const typeOptions = ['All', 'Major', 'Minor', '7', 'Maj7', 'm7', 'Sus2', 'Sus4', 'Add9', 'Dim', 'Aug', '6', '9', '11', '13', '5', 'Slash']

function normalizeYouTubeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (hostname === 'youtu.be') return url.pathname.length > 1 ? url.toString() : null
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(hostname)) return null
    return url.pathname === '/watch' && Boolean(url.searchParams.get('v')) ? url.toString() : null
  } catch {
    return null
  }
}

function renderNoteText(notes: string) {
  return notes.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <Fragment key={index}>{part}</Fragment>
    const href = part.replace(/[),.!?;:]+$/, '')
    const trailing = part.slice(href.length)
    return <Fragment key={index}><a href={href} target="_blank" rel="noopener noreferrer">{href}</a>{trailing}</Fragment>
  })
}

const hasCustomGuitar2 = (song: Song) => song.guitar2Customized || song.sections.some((section) => Boolean(section.guitar2ChordText?.trim()))

const guitar2TextForSection = (section: Section, notation: Notation, guitar1Capo = 0, guitar2Capo?: number, concertTranspose = 0) => {
  const custom = section.guitar2ChordText?.trim()
  if (guitar2Capo === undefined) return custom || suggestGuitar2Progression(section.chordText || '', notation, guitar1Capo)
  if (custom) return transposeProgressionText(custom, concertTranspose, notation)
  return guitar2ProgressionAtCapo(transposeProgressionText(section.chordText || '', concertTranspose, notation), guitar1Capo, guitar2Capo, notation)
}

type SelectedGuitar2Option = {
  shapeKey: string
  capo: number
  concertKey: string
}

const selectCompatibleGuitar2Option = (concertKey: string, options: ReturnType<typeof generateCompatibleGuitar2Options>, requestedShapeKey: string | undefined, guitar1Text: string, guitar1Capo: number, notation: Notation) => {
  const option = options.find((candidate) => candidate.key === requestedShapeKey)
    ?? (requestedShapeKey ? options.find((candidate) => normalizeKey(candidate.key) === normalizeKey(requestedShapeKey)) : undefined)
    ?? chooseBestGuitar2Option(options.filter((candidate) => normalizeKey(candidate.key) !== normalizeKey(capoShapeKey(concertKey, guitar1Capo, notation))), guitar1Text, guitar1Capo, notation)
  return option ? { shapeKey: option.key, capo: option.capo, concertKey } : null
}

const sectionChordLines = (section: Section) => {
  if (typeof section.chordText === 'string' && section.chordText.trim()) {
    return section.chordText.split(/\n/).filter(Boolean)
  }
  if (Array.isArray(section.chordLines) && section.chordLines.length) {
    return section.chordLines.filter(Boolean)
  }

  if (Array.isArray(section.lines) && section.lines.length) {
    return section.lines.filter(Boolean)
  }

  return []
}

const displayChord = (chord: string, interval: number, notation: Notation, simplifyValue: boolean) => {
  const nextChord = simplifyValue ? simplifyChord(chord) : chord
  return transposeChord(nextChord, interval, notation)
}

const renderChordLine = (line: string, interval: number, notation: Notation, simplifyValue: boolean) => {
  return <span className="chord-token">{formatTransposedChordLine(line, interval, notation, simplifyValue)}</span>
}

function Metronome({ initialBpm }: { initialBpm: number }) {
  const [bpm, setBpm] = useState(() => {
    const stored = Number(localStorage.getItem('wg-metronome-bpm'))
    return Number.isFinite(stored) ? Math.min(240, Math.max(40, stored)) : Math.min(240, Math.max(40, initialBpm || 80))
  })
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const engineRef = useRef<MetronomeEngine | null>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const holdIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    const engine = new MetronomeEngine()
    engine.setTempo(bpm)
    engineRef.current = engine
    return () => {
      if (holdTimeoutRef.current) window.clearTimeout(holdTimeoutRef.current)
      if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current)
      void engine.dispose()
      engineRef.current = null
    }
  }, [])

  const clampBpm = (value: number) => Math.min(240, Math.max(40, Math.round(value)))

  const updateBpm = (value: number) => {
    const next = clampBpm(value)
    setBpm(next)
    localStorage.setItem('wg-metronome-bpm', String(next))
    engineRef.current?.setTempo(next)
  }

  const stopHold = () => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
  }

  const beginHold = (direction: 1 | -1) => {
    stopHold()

    const tick = () => {
      setBpm((current) => {
        const next = clampBpm(current + direction)
        if (next !== current) {
          localStorage.setItem('wg-metronome-bpm', String(next))
          engineRef.current?.setTempo(next)
        }
        return next
      })
    }

    tick()
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        tick()
      }, 75)
    }, 180)
  }

  const toggle = async () => {
    setError('')
    if (playing) {
      engineRef.current?.stop()
      setPlaying(false)
      return
    }
    try {
      await engineRef.current?.start()
      setPlaying(true)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start the metronome.')
    }
  }

  return (
    <section className="metronome" aria-label="Metronome">
      <div className="metronome-heading">
        <span className="eyebrow">Metronome</span>
        <button className={`metronome-toggle${playing ? ' active' : ''}`} onClick={() => void toggle()} aria-label={playing ? 'Pause metronome' : 'Play metronome'}>{playing ? '❚❚' : '▶'}</button>
      </div>
      <div className="metronome-controls">
        <button type="button" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); beginHold(-1) }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onContextMenu={(event) => event.preventDefault()} aria-label="Decrease BPM">−</button>
        <label><input type="number" min="40" max="240" value={bpm} onChange={(event) => updateBpm(Number(event.target.value))} /> BPM</label>
        <button type="button" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); beginHold(1) }} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onContextMenu={(event) => event.preventDefault()} aria-label="Increase BPM">＋</button>
      </div>
      {error && <small className="metronome-error" role="alert">{error}</small>}
    </section>
  )
}

function IntroSuggestor({ chordText, guitar2Text }: { chordText: string; guitar2Text: string }) {
  const [open, setOpen] = useState(false)
  const suggestions = suggestIntros(chordText, guitar2Text)
  if (!suggestions.length) return null
  const suggestion: IntroSuggestion = suggestions[0]

  return (
    <section className={`intro-suggestor${open ? ' open' : ''}`}>
      <button className="intro-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>Suggest Intro</button>
      {open && <div className="intro-content">
        <h3>{suggestion.title}</h3>
        <p className="intro-chords">{suggestion.chords.split('\n').map((line) => <span key={line}>{line}</span>)}</p>
      </div>}
    </section>
  )
}

export function HomePage({ songs, setlists, onCreateSong, isOwner }: { songs: Song[]; setlists: Setlist[]; onCreateSong: () => void; isOwner: boolean }) {
  const upcoming = upcomingSundayIso()
  const sunday = setlists.find((item) => item.date === upcoming) ?? setlists.find((item) => (item.date || '') >= upcoming) ?? setlists[0]
  const formattedDate = sunday?.date ? formatSundayDate(sunday.date) : null

  return (
    <div className="page v5-home">
      <header className="v5-home-header">
        <div>
          <div className="eyebrow">Worship Guitar</div>
          <h1>
            Your chord sheets,
            <em>always ready.</em>
          </h1>
        </div>
      </header>

      <section className="home-sunday">
        <div>
          <span className="eyebrow">This Sunday</span>
          <h2>{formattedDate || sunday?.name || 'No Sunday set yet'}</h2>
          {!sunday && <p>Open Sunday to prepare your set.</p>}
        </div>
        <Link className="primary-button" to="/sunday">
          Open Sunday <ChevronRight size={15} />
        </Link>
      </section>

      <div className="home-actions">
        {isOwner && <button onClick={onCreateSong}>
          <Plus size={18} />
          <b>Add song</b>
          <small>Build a chord sheet</small>
        </button>}
        <Link to="/songs">
          <Search size={18} />
          <b>Song library</b>
          <small>Find a song</small>
        </Link>
        <Link to="/chords">
          <span className="home-action-symbol">♬</span>
          <b>Chord library</b>
          <small>Find a shape</small>
        </Link>
        <Link to="/tuner">
          <span className="home-action-symbol">♩</span>
          <b>Guitar tuner</b>
          <small>Tune a string</small>
        </Link>
      </div>

      <section className="library-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Your songs</span>
            <h2>Recent songs</h2>
          </div>
          <Link to="/songs">
            All songs <ChevronRight size={14} />
          </Link>
        </div>

        <div className="song-list">
          {songs.slice(0, 4).map((song) => (
            <SongRow key={song.id} song={song} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SongRow({ song }: { song: Song }) {
  return (
    <Link className="song-row" to={`/songs/${song.id}`}>
      <span className="song-art">{song.title.slice(0, 1)}</span>
      <span className="song-meta">
        <strong>{song.title}</strong>
      </span>
      <span className="key-pill">{song.currentKey}</span>
      <ChevronRight size={17} />
    </Link>
  )
}

export function SongLibrary({ songs, onCreate, onDuplicate, onDelete, isOwner }: { songs: Song[]; onCreate: () => void; onDuplicate: (song: Song) => void; onDelete: (song: Song) => void; isOwner: boolean }) {
  const [query, setQuery] = useState('')

  const filtered = sortSongsByTitle(songs.filter((song) => {
    const text = `${song.title} ${song.currentKey} ${song.sections.flatMap((section) => sectionChordLines(section)).join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  }))

  return (
    <div className="page">
      <header className="v5-page-header">
        <div>
          <div className="eyebrow">Your chord sheets</div>
          <h1>Songs</h1>
        </div>
        {isOwner && <button className="primary-button" onClick={onCreate}><Plus size={16} />Add song</button>}
      </header>

      <div className="v5-search-row">
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, starting chord, or chord" />
        </div>
      </div>

      <div className="v5-song-grid">
        {filtered.map((song) => (
          <article className="v5-song-card" key={song.id}>
            <Link to={`/songs/${song.id}`}>
              <span className="song-art large-art">{song.title.slice(0, 1)}</span>
              <div>
                <h2>{song.title}</h2>
                <div className="song-facts">
                  Starting Chord <b>{song.currentKey}</b> · Capo <b>{song.capo}</b>
                </div>
              </div>
            </Link>

            {isOwner && <div className="v5-card-actions">
              <Link className="text-button" to={`/songs/${song.id}/edit`}>Edit</Link>
              <button aria-label="Duplicate song" className="icon-button subtle" onClick={() => void Promise.resolve(onDuplicate(song)).catch((error) => window.alert(error instanceof Error ? error.message : 'Unable to duplicate song.'))}><Copy size={15} /></button>
              <button aria-label="Delete song" className="icon-button subtle" onClick={() => {
                if (!window.confirm(`Delete “${song.title}”?`)) return
                void Promise.resolve(onDelete(song)).catch((error) => window.alert(error instanceof Error ? error.message : 'Unable to delete song.'))
              }}><Trash2 size={15} /></button>
            </div>}
          </article>
        ))}

        {!filtered.length && (
          <div className="empty">
            <h2>No songs found</h2>
            <p>Try a different search or add a new chord sheet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function SongPage({ songs, setlists, settings, isOwner }: { songs: Song[]; setlists: Setlist[]; settings: Settings; isOwner: boolean }) {
  const { songId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const song = songs.find((item) => item.id === songId)
  const sundayId = searchParams.get('sunday')
  const sunday = setlists.find((item) => item.id === sundayId)
  const sundaySongIds = sunday?.songIds ?? []
  const sundayIndex = song ? sundaySongIds.indexOf(song.id) : -1
  const [guitar, setGuitar] = useState<1 | 2>(1)
  const [guitar2Activated, setGuitar2Activated] = useState(false)
  const [viewKey1, setViewKey1] = useState(song?.key ?? 'C')
  const [selectedGuitar2Option, setSelectedGuitar2Option] = useState<SelectedGuitar2Option>(() => ({
    shapeKey: song ? capoShapeKey(song.key, song.capo, settings.notation) : 'C',
    capo: song?.capo ?? 0,
    concertKey: song?.key ?? 'C',
  }))
  const [chordScale, setChordScale] = useState(1)
  const [sheetOnly, setSheetOnly] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const nativeFullscreen = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const customGuitar2 = song ? hasCustomGuitar2(song) : false
  const compatibleGuitar2Options = useMemo(() => generateCompatibleGuitar2Options(viewKey1, settings.notation, song?.key), [viewKey1, settings.notation, song?.key])
  const guitar1Progression = song?.sections.map((section) => section.chordText).join('\n') ?? ''

  const selectGuitar2Option = (nextKey: string) => {
    const option = selectCompatibleGuitar2Option(viewKey1, compatibleGuitar2Options, nextKey, guitar1Progression, song?.capo ?? 0, settings.notation)
    if (option) {
      setSelectedGuitar2Option(option)
      setGuitar2Activated(true)
    }
  }

  useEffect(() => {
    if (!song?.key) return
    setViewKey1(song.key)
  }, [song?.id, song?.key])

  useEffect(() => {
    if (!compatibleGuitar2Options.length) return
    const stillValid = selectedGuitar2Option.concertKey === viewKey1
      && compatibleGuitar2Options.some((option) => option.key === selectedGuitar2Option.shapeKey && option.capo === selectedGuitar2Option.capo)
    if (stillValid) return
    const nextOption = selectCompatibleGuitar2Option(viewKey1, compatibleGuitar2Options, undefined, guitar1Progression, song?.capo ?? 0, settings.notation)
    if (!nextOption) return
    setSelectedGuitar2Option((current) => current.shapeKey === nextOption.shapeKey && current.capo === nextOption.capo && current.concertKey === nextOption.concertKey ? current : nextOption)
  }, [compatibleGuitar2Options, viewKey1, selectedGuitar2Option, guitar1Progression, song?.capo, settings.notation])

  const activeDisplayKey = guitar === 1 ? viewKey1 : selectedGuitar2Option.shapeKey
  const handleKeySelect = (nextKey: string) => {
    if (guitar === 1) {
      setViewKey1(nextKey)
      return
    }
    selectGuitar2Option(nextKey)
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement === sheetRef.current) setSheetOnly(true)
      else if (nativeFullscreen.current) {
        nativeFullscreen.current = false
        setSheetOnly(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    type WakeLock = { release: () => Promise<void> }
    if (!song?.id) return
    const wakeLock = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }
    let sentinel: WakeLock | null = null
    const requestWakeLock = async () => {
      if (document.hidden || !wakeLock.wakeLock) return
      try { sentinel = await wakeLock.wakeLock.request('screen') } catch { sentinel = null }
    }
    const handleVisibilityChange = () => { if (!document.hidden) void requestWakeLock() }
    void requestWakeLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (sentinel) void sentinel.release()
    }
  }, [song?.id])

  if (!song) {
    return <Empty title="Song not found" />
  }

  const selectedCapo = guitar === 1 ? song.capo : selectedGuitar2Option.capo
  const viewKey = guitar === 1 ? viewKey1 : selectedGuitar2Option.concertKey
  const interval = (noteIndex(viewKey) - noteIndex(song.key) + 12) % 12
  const shapeKey = capoShapeKey(viewKey, selectedCapo, settings.notation)
  const currentGuitar2Text = song.sections.map((section) => guitar2TextForSection(section, settings.notation, song.capo, selectedCapo, interval)).join('\n')
  const currentGuitar1Text = song.sections.map((section) => section.chordText).join('\n')
  const introText = guitar === 1 ? currentGuitar1Text : currentGuitar2Text
  const updateKey = (amount: number) => {
    if (guitar === 1) {
      setViewKey1((current) => shiftKey(current, amount, settings.notation))
      return
    }
    const nextKey = shiftKey(selectedGuitar2Option.shapeKey, amount, settings.notation)
    const option = selectCompatibleGuitar2Option(viewKey1, compatibleGuitar2Options, nextKey, guitar1Progression, song.capo, settings.notation)
    if (option) setSelectedGuitar2Option(option)
  }
  const enterSheetOnly = async () => {
    setSheetOnly(true)
    if (!sheetRef.current?.requestFullscreen) return
    try {
      await sheetRef.current.requestFullscreen()
      nativeFullscreen.current = true
    } catch { /* CSS fallback remains active when browser fullscreen is unavailable. */ }
  }
  const exitSheetOnly = async () => {
    nativeFullscreen.current = false
    setSheetOnly(false)
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
  }
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!sunday || sundayIndex < 0 || event.touches.length !== 1) return
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !sunday || sundayIndex < 0 || event.changedTouches.length !== 1) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 64 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    const targetIndex = sundayIndex + (deltaX < 0 ? 1 : -1)
    const targetId = sundaySongIds[targetIndex]
    if (!targetId || targetId === song?.id || !songs.some((item) => item.id === targetId)) return
    navigate(`/songs/${targetId}?sunday=${encodeURIComponent(sunday.id)}`)
  }

  return (
    <div className={`page continuous-page${sheetOnly ? ' sheet-only-fallback' : ''}`}>
      <button className="back-button" onClick={() => navigate(sunday ? `/sunday?sunday=${encodeURIComponent(sunday.id)}` : '/songs')}><ChevronLeft size={16} />Songs</button>

      <header className="v5-song-header">
        <div>
          <div className="eyebrow">Chord sheet</div>
          <h1>{song.title}</h1>
          <div className="song-tags">
            <span>Starting Chord {viewKey}</span>
            <span>{guitar === 2 ? `Guitar 2: ${shapeKey} shapes` : `Guitar 1: ${shapeKey} shapes`}</span>
            <span>Capo {selectedCapo}</span>
            {guitar === 2 && <span>{customGuitar2 ? 'Custom Guitar 2' : 'Dynamic Guitar 2'}</span>}
          </div>
        </div>
        <div className="song-header-actions">
          {isOwner && <Link className="secondary-button" to={`/songs/${song.id}/edit`}>Edit</Link>}
          <button className="primary-button" onClick={() => void enterSheetOnly()}><Maximize2 size={15} />Fullscreen</button>
        </div>
      </header>

      <div className="song-key-bar">
        <strong>{shapeKey}</strong>
        <small>Starting chord {activeDisplayKey} · Guitar {guitar}</small>
        <button onClick={() => updateKey(-1)}>−1</button>
        <button onClick={() => {
          if (guitar === 1) setViewKey1(song.key)
          else {
            const option = selectCompatibleGuitar2Option(viewKey1, compatibleGuitar2Options, undefined, guitar1Progression, song.capo, settings.notation)
            if (option) setSelectedGuitar2Option(option)
          }
        }}>Original</button>
        <button onClick={() => updateKey(1)}>＋1</button>
        <select value={activeDisplayKey} onChange={(event) => handleKeySelect(event.target.value)} aria-label="Select starting chord">
          {(guitar === 1 ? keyOptions : compatibleGuitar2Options.map((option) => option.key)).map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
        <div className="guitar-switch">
          <button className={guitar === 1 ? 'active' : ''} onClick={() => setGuitar(1)}>Guitar 1</button>
          <button className={guitar === 2 ? 'active' : ''} onClick={() => {
            const stillValid = selectedGuitar2Option.concertKey === viewKey1
              && compatibleGuitar2Options.some((option) => option.key === selectedGuitar2Option.shapeKey && option.capo === selectedGuitar2Option.capo)
            if (!guitar2Activated || !stillValid) {
              const option = selectCompatibleGuitar2Option(viewKey1, compatibleGuitar2Options, undefined, guitar1Progression, song.capo, settings.notation)
              if (option) setSelectedGuitar2Option(option)
            }
            setGuitar2Activated(true)
            setGuitar(2)
          }}>Guitar 2</button>
        </div>
        <div className="chord-size-controls" aria-label="Chord font size">
          <span>Chord size</span>
          <button onClick={() => setChordScale((current) => Math.max(0.7, Number((current - 0.1).toFixed(2))))} disabled={chordScale <= 0.7}>A−</button>
          <button onClick={() => setChordScale((current) => Math.min(1.35, Number((current + 0.1).toFixed(2))))} disabled={chordScale >= 1.35}>A+</button>
        </div>
      </div>

      <div className="song-tools">
        <IntroSuggestor chordText={introText} guitar2Text={guitar === 1 ? currentGuitar2Text : ''} />
      </div>

      <div className="continuous-sheet" ref={sheetRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ '--chord-font-size': `clamp(${23 * chordScale}px, ${2.5 * chordScale}vw, ${36 * chordScale}px)` } as CSSProperties}>
        {sheetOnly && <button className="sheet-exit-button" onClick={() => void exitSheetOnly()}><Minimize2 size={15} />Exit full screen</button>}
        {song.sections.map((section, sectionIndex) => {
          const lines = guitar === 2
            ? sectionChordLines({ ...section, chordText: guitar2TextForSection(section, settings.notation, song.capo, selectedCapo, interval) })
            : sectionChordLines(section)
          return (
            <section className="continuous-section" key={section.id || section.name}>
              <div className="continuous-section-header">
                <div className="continuous-label">{section.name.toUpperCase()}{guitar === 2 && !section.guitar2ChordText?.trim() ? ` · capo ${selectedCapo}` : ''}</div>
                {sectionIndex === 0 && <div className="continuous-title">{song.title}</div>}
              </div>
              {lines.map((line, lineIndex) => (
                <div className="continuous-line" key={`${section.id}-${lineIndex}`}>
                  <span className="chord-text">{formatTransposedChordLine(line, guitar === 2 ? 0 : interval, settings.notation, settings.simplify)}</span>
                </div>
              ))}
            </section>
          )
        })}
        {song.chordImage?.dataUrl && (
          <div className="image-preview song-image">
            <img src={song.chordImage.dataUrl} alt={`${song.title} chord sheet`} />
          </div>
        )}
        {sheetOnly && song.notes.trim() && (
          <section className="song-notes">
            <div className="eyebrow">Notes</div>
            <p>{renderNoteText(song.notes)}</p>
          </section>
        )}
      </div>

      {!sheetOnly && <Metronome key={song.id} initialBpm={song.bpm} />}

      {!sheetOnly && song.notes.trim() && (
        <section className="song-notes">
          <div className="eyebrow">Notes</div>
          <p>{renderNoteText(song.notes)}</p>
        </section>
      )}
      {song.youtubeUrl && (
        <section className="song-reference">
          <div className="eyebrow">Reference</div>
          <a className="secondary-button" href={song.youtubeUrl} target="_blank" rel="noreferrer">Watch on YouTube <ChevronRight size={15} /></a>
        </section>
      )}
    </div>
  )
}

function Empty({ title }: { title: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <Link className="secondary-button" to="/songs">Back to songs</Link>
    </div>
  )
}

export function SongEditor({ songs, onSave, onDelete }: { songs: Song[]; onSave: (song: Song) => Promise<Song>; onDelete: (song: Song) => void | Promise<void> }) {
  const { songId } = useParams()
  const navigate = useNavigate()
  const existing = songs.find((song) => song.id === songId)
  const blankSection = (): Section => ({ id: editorKey(), name: 'Verse 1', chordText: 'C G Am F\nC G C', guitar2ChordText: '' })

  const [title, setTitle] = useState(existing?.title || '')
  const [youtubeUrl, setYoutubeUrl] = useState(existing?.youtubeUrl || '')
  const [key, setKey] = useState(existing?.key || 'C')
  const [capo, setCapo] = useState(existing?.capo || 0)
  const [guitar2Capo, setGuitar2Capo] = useState(existing?.guitar2Capo || 0)
  const [guitar2Customized, setGuitar2Customized] = useState(existing?.guitar2Customized || false)
  const [notes, setNotes] = useState(existing?.notes || '')
  const [image, setImage] = useState(existing?.chordImage)
  const [guitar, setGuitar] = useState<1 | 2>(1)
  const [sections, setSections] = useState<Section[]>(existing?.sections?.length ? existing.sections : [blankSection()])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!existing) return
    setTitle(existing.title)
    setYoutubeUrl(existing.youtubeUrl)
    setKey(existing.key)
    setCapo(existing.capo)
    setGuitar2Capo(existing.guitar2Capo)
    setGuitar2Customized(existing.guitar2Customized)
    setNotes(existing.notes)
    setImage(existing.chordImage)
    setSections(existing.sections.length ? existing.sections : [blankSection()])
  }, [existing?.id])

  const addSection = () => {
    setSections((current) => [...current, { id: editorKey(), name: `Section ${current.length + 1}`, chordText: '', guitar2ChordText: '' }])
  }

  const removeSection = (sectionId: string) => {
    setSections((current) => current.filter((section) => section.id !== sectionId))
  }

  const moveSection = (sectionId: string, target: 'top' | 'up' | 'down' | 'bottom') => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === sectionId)
      if (index < 0) return current
      const targetIndex = target === 'top' ? 0 : target === 'up' ? index - 1 : target === 'down' ? index + 1 : current.length - 1
      if (targetIndex < 0 || targetIndex >= current.length || targetIndex === index) return current
      const next = [...current]
      const [section] = next.splice(index, 1)
      next.splice(targetIndex, 0, section)
      return next
    })
  }

  const save = async () => {
    if (isSaving) return
    if (!title.trim()) {
      window.alert('Song title is required.')
      return
    }
    const normalizedYoutubeUrl = normalizeYouTubeUrl(youtubeUrl)
    if (normalizedYoutubeUrl === null) {
      window.alert('Enter a valid YouTube URL.')
      return
    }

    const normalizedSections = sections
      .filter((section) => section.name.trim() || section.chordText.trim() || section.guitar2ChordText?.trim())
      .map((section) => {
        const guitar1 = section.chordText.trim()
        const entered = (section.guitar2ChordText ?? '').trim()
        return {
          ...section,
          name: section.name.trim() || 'Section',
          chordText: guitar1,
          guitar2ChordText: guitar2Customized ? entered : '',
        }
      })

    const song: Song = {
      id: existing?.id || '',
      title: title.trim(),
      key,
      currentKey: key,
      capo,
      guitar2Capo: guitar2Customized ? guitar2Capo : suggestGuitar2Arrangement(sections.map((section) => section.chordText).join('\n'), capo, 'auto').capo,
      guitar2Customized,
      bpm: existing?.bpm || 72,
      favorite: existing?.favorite || false,
      tags: existing?.tags || [],
      notes,
      youtubeUrl: normalizedYoutubeUrl,
      sections: normalizedSections,
      chordImage: image,
      lastPlayed: existing?.lastPlayed,
    }

    setIsSaving(true)
    try {
      const saved = await onSave(song)
      if (!saved?.id) {
        throw new Error('Song save did not return a database id.')
      }
      navigate(`/songs/${saved.id}`)
    } catch (error) {
      console.error('Song save failed', error)
      window.alert(error instanceof Error ? error.message : 'Unable to save song. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateSection = (sectionId: string, field: 'name' | 'chordText' | 'guitar2ChordText', value: string) => {
    setSections((current) => current.map((section) => (section.id === sectionId ? { ...section, [field]: value } : section)))
  }

  const saveImage = (file: File) => {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      window.alert('Please choose a PNG, JPG, or WEBP image.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setImage({ name: file.name, dataUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const removeSong = async () => {
    if (!existing || isDeleting) return
    if (!window.confirm(`Delete “${existing.title}”?`)) return
    setIsDeleting(true)
    try {
      await onDelete(existing)
      navigate('/songs')
    } catch (error) {
      console.error('Song delete failed', error)
      window.alert(error instanceof Error ? error.message : 'Unable to delete song.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="page editor-page">
      <button className="back-button" onClick={() => navigate('/songs')}><ChevronLeft size={16} />Songs</button>

      <header className="v5-page-header">
        <div>
          <div className="eyebrow">Song editor</div>
          <h1>{existing ? 'Edit song' : 'Add song'}</h1>
        </div>
        <button className="primary-button" onClick={() => void save()} disabled={isSaving}><Save size={16} />{isSaving ? 'Saving...' : 'Save song'}</button>
      </header>

      <div className="editor-form">
        <div className="form-row">
          <label>
            Song title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Amazing Grace" />
          </label>
          <label>
            YouTube reference
            <input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtu.be/..." />
          </label>
        </div>

        <div className="form-row">
          <label>
            Starting Chord
            <select value={key} onChange={(event) => setKey(event.target.value)}>
              {startingChordOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            {guitar === 1 ? 'Guitar 1 capo' : 'Guitar 2 capo'}
            <select value={guitar === 1 ? capo : guitar2Capo} onChange={(event) => {
              if (guitar === 1) setCapo(Number(event.target.value))
              else {
                setGuitar2Capo(Number(event.target.value))
                setGuitar2Customized(true)
              }
            }}>
              {Array.from({ length: 13 }, (_, value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <div className="guitar-switch editor-guitar-switch">
          <button type="button" className={guitar === 1 ? 'active' : ''} onClick={() => setGuitar(1)}>Guitar 1</button>
          <button type="button" className={guitar === 2 ? 'active' : ''} onClick={() => setGuitar(2)}>Guitar 2</button>
        </div>

        <label>
          Notes
          <textarea className="textarea-editor" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Performance notes, transitions, or reminders." />
        </label>

        <div className="editor-sections">
          {sections.map((section, index) => (
            <div className="section-card" key={section.id}>
              <div className="section-card-header">
                <input value={section.name} onChange={(event) => updateSection(section.id, 'name', event.target.value)} placeholder="Verse 1" />
                {sections.length > 1 && <div className="section-reorder-controls">
                  <button className="icon-button" title="Move to top" aria-label="Move section to top" disabled={index === 0} onClick={() => moveSection(section.id, 'top')}><ChevronsUp size={15} /></button>
                  <button className="icon-button" title="Move up" aria-label="Move section up" disabled={index === 0} onClick={() => moveSection(section.id, 'up')}><ArrowUp size={15} /></button>
                  <button className="icon-button" title="Move down" aria-label="Move section down" disabled={index === sections.length - 1} onClick={() => moveSection(section.id, 'down')}><ArrowDown size={15} /></button>
                  <button className="icon-button" title="Move to bottom" aria-label="Move section to bottom" disabled={index === sections.length - 1} onClick={() => moveSection(section.id, 'bottom')}><ChevronsDown size={15} /></button>
                </div>}
                {sections.length > 1 && (
                  <button className="icon-button" aria-label="Remove section" onClick={() => removeSection(section.id)}><Trash2 size={15} /></button>
                )}
              </div>

              <textarea
                className="textarea-editor chord-textarea"
                value={guitar === 1 ? section.chordText : guitar2TextForSection(section, 'auto', capo, guitar2Customized ? guitar2Capo : suggestGuitar2Arrangement(sections.map((item) => item.chordText).join('\n'), capo, 'auto').capo)}
                onChange={(event) => {
                  if (guitar === 2) setGuitar2Customized(true)
                  updateSection(section.id, guitar === 1 ? 'chordText' : 'guitar2ChordText', event.target.value)
                }}
                placeholder={guitar === 1 ? `C G Am F\nC G C` : suggestGuitar2Progression(section.chordText || 'C G Am F\nC G C')}
              />
              <small>Section {index + 1} · {guitar === 1 ? 'Guitar 1 chords' : (guitar2Customized ? 'Guitar 2 chords (custom)' : 'Guitar 2 suggested')}</small>
            </div>
          ))}
        </div>

        <div className="editor-actions">
          <button className="secondary-button" onClick={addSection}><Plus size={16} />Add section</button>
          <label className="upload-button">
            <Upload size={16} />
            {image ? 'Replace image' : 'Upload image'}
            <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) saveImage(file)
            }} />
          </label>
          {image && (
            <button className="danger-button" onClick={() => setImage(undefined)}><Trash2 size={15} />Delete image</button>
          )}
          {existing && (
            <button className="danger-button" disabled={isDeleting} onClick={() => void removeSong()}><Trash2 size={15} />{isDeleting ? 'Deleting...' : 'Delete song'}</button>
          )}
        </div>

        {image && (
          <div className="image-preview">
            <img src={image.dataUrl} alt="Song chord sheet" />
          </div>
        )}
      </div>
    </div>
  )
}

export function ChordLibrary() {
  const [query, setQuery] = useState('')
  const [rootFilter, setRootFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selectedChord, setSelectedChord] = useState<ChordDefinition | null>(null)

  const chordDatabase = useMemo<ChordDefinition[]>(() => [
    { name: 'A', root: 'A', type: 'Major', notes: ['A', 'C#', 'E'], strings: [-1, 0, 2, 2, 2, 0], fingers: ['x', '0', '2', '2', '2', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Am', root: 'A', type: 'Minor', notes: ['A', 'C', 'E'], strings: [-1, 0, 2, 2, 1, 0], fingers: ['x', '0', '2', '3', '1', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'A7', root: 'A', type: '7', notes: ['A', 'C#', 'E', 'G'], strings: [-1, 0, 2, 0, 2, 0], fingers: ['x', '0', '2', '0', '2', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'B7', root: 'B', type: '7', notes: ['B', 'D#', 'F#', 'A'], strings: [-1, 2, 1, 2, 0, 2], fingers: ['x', '2', '1', '2', '0', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'C', root: 'C', type: 'Major', notes: ['C', 'E', 'G'], strings: [-1, 3, 2, 0, 1, 0], fingers: ['x', '3', '2', '0', '1', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'C7', root: 'C', type: '7', notes: ['C', 'E', 'G', 'Bb'], strings: [-1, 3, 2, 3, 1, 0], fingers: ['x', '3', '2', '4', '1', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Cmaj7', root: 'C', type: 'Maj7', notes: ['C', 'E', 'G', 'B'], strings: [-1, 3, 2, 0, 0, 0], fingers: ['x', '3', '2', '0', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Cadd9', root: 'C', type: 'Add9', notes: ['C', 'D', 'E', 'G'], strings: [-1, 3, 2, 0, 3, 3], fingers: ['x', '3', '2', '0', '3', '4'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Csus2', root: 'C', type: 'Sus2', notes: ['C', 'D', 'G'], strings: [-1, 3, 0, 0, 1, 3], fingers: ['x', '3', '0', '0', '1', '4'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Csus4', root: 'C', type: 'Sus4', notes: ['C', 'F', 'G'], strings: [-1, 3, 3, 0, 1, 1], fingers: ['x', '3', '4', '0', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'D', root: 'D', type: 'Major', notes: ['D', 'F#', 'A'], strings: [-1, -1, 0, 2, 3, 2], fingers: ['x', 'x', '0', '2', '3', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dm', root: 'D', type: 'Minor', notes: ['D', 'F', 'A'], strings: [-1, -1, 0, 2, 3, 1], fingers: ['x', 'x', '0', '2', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'D7', root: 'D', type: '7', notes: ['D', 'F#', 'A', 'C'], strings: [-1, -1, 0, 2, 1, 2], fingers: ['x', 'x', '0', '2', '1', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dm7', root: 'D', type: 'm7', notes: ['D', 'F', 'A', 'C'], strings: [-1, -1, 0, 2, 1, 1], fingers: ['x', 'x', '0', '2', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dmaj7', root: 'D', type: 'Maj7', notes: ['D', 'F#', 'A', 'C#'], strings: [-1, -1, 0, 2, 2, 2], fingers: ['x', 'x', '0', '2', '2', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Dsus2', root: 'D', type: 'Sus2', notes: ['D', 'E', 'A'], strings: [-1, -1, 0, 2, 3, 0], fingers: ['x', 'x', '0', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dsus4', root: 'D', type: 'Sus4', notes: ['D', 'G', 'A'], strings: [-1, -1, 0, 2, 3, 3], fingers: ['x', 'x', '0', '1', '2', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'E', root: 'E', type: 'Major', notes: ['E', 'G#', 'B'], strings: [0, 2, 2, 1, 0, 0], fingers: ['0', '2', '2', '1', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Em', root: 'E', type: 'Minor', notes: ['E', 'G', 'B'], strings: [0, 2, 2, 0, 0, 0], fingers: ['0', '2', '2', '0', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'E7', root: 'E', type: '7', notes: ['E', 'G#', 'B', 'D'], strings: [0, 2, 0, 1, 0, 0], fingers: ['0', '2', '0', '1', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Em7', root: 'E', type: 'm7', notes: ['E', 'G', 'B', 'D'], strings: [0, 2, 0, 0, 0, 0], fingers: ['0', '2', '0', '0', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Eadd9', root: 'E', type: 'Add9', notes: ['E', 'G#', 'B', 'F#'], strings: [0, 2, 2, 1, 0, 2], fingers: ['0', '2', '2', '1', '0', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Esus4', root: 'E', type: 'Sus4', notes: ['E', 'A', 'B'], strings: [0, 2, 2, 2, 0, 0], fingers: ['0', '2', '2', '2', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'F', root: 'F', type: 'Major', notes: ['F', 'A', 'C'], strings: [1, 3, 3, 2, 1, 1], fingers: ['1', '3', '4', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Fmaj7', root: 'F', type: 'Maj7', notes: ['C', 'E', 'F', 'A'], strings: [-1, -1, 3, 2, 1, 0], fingers: ['x', 'x', '3', '2', '1', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Fadd9', root: 'F', type: 'Add9', notes: ['A', 'C', 'F', 'G'], strings: [1, 3, 3, 2, 1, 3], fingers: ['1', '3', '4', '2', '1', '4'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'G', root: 'G', type: 'Major', notes: ['G', 'B', 'D'], strings: [3, 2, 0, 0, 0, 3], fingers: ['3', '2', '0', '0', '0', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'G7', root: 'G', type: '7', notes: ['G', 'B', 'D', 'F'], strings: [3, 2, 0, 0, 0, 1], fingers: ['3', '2', '0', '0', '0', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gmaj7', root: 'G', type: 'Maj7', notes: ['G', 'B', 'D', 'F#'], strings: [2, 2, 0, 0, 0, 2], fingers: ['2', '2', '0', '0', '0', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Gsus2', root: 'G', type: 'Sus2', notes: ['G', 'A', 'D'], strings: [3, 0, 0, 0, 3, 3], fingers: ['3', '0', '0', '0', '3', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gsus4', root: 'G', type: 'Sus4', notes: ['G', 'C', 'D'], strings: [3, 3, 0, 0, 1, 3], fingers: ['3', '3', '0', '0', '1', '4'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Am7', root: 'A', type: 'm7', notes: ['A', 'C', 'E', 'G'], strings: [-1, 0, 2, 0, 1, 0], fingers: ['x', '0', '2', '0', '1', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Asus2', root: 'A', type: 'Sus2', notes: ['A', 'B', 'E'], strings: [-1, 0, 2, 2, 0, 0], fingers: ['x', '0', '2', '2', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Asus4', root: 'A', type: 'Sus4', notes: ['A', 'D', 'E'], strings: [-1, 0, 2, 2, 3, 0], fingers: ['x', '0', '2', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dadd9', root: 'D', type: 'Add9', notes: ['D', 'F#', 'A', 'E'], strings: [2, -1, 0, 2, 3, 0], fingers: ['2', 'x', '0', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gadd9', root: 'G', type: 'Add9', notes: ['A', 'B', 'D', 'G'], strings: [3, 2, 0, 2, 0, 3], fingers: ['3', '2', '0', '1', '0', '4'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'F#', root: 'F#', type: 'Major', notes: ['A#', 'C#', 'F#'], strings: [2, 4, 4, 3, 2, 2], fingers: ['1', '3', '4', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'F#m', root: 'F#', type: 'Minor', notes: ['A', 'C#', 'F#'], strings: [2, 4, 4, 2, 2, 2], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'C#m', root: 'C#', type: 'Minor', notes: ['C#', 'E', 'G#'], strings: [-1, 4, 6, 6, 5, 4], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 4 },
    { name: 'G#m', root: 'G#', type: 'Minor', notes: ['G#', 'B', 'D#'], strings: [4, 6, 6, 4, 4, 4], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 4 },
    { name: 'Bb', root: 'Bb', type: 'Major', notes: ['Bb', 'D', 'F'], strings: [1, 1, 3, 3, 3, 1], fingers: ['1', '1', '3', '3', '3', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bbm', root: 'Bb', type: 'Minor', notes: ['Bb', 'Db', 'F'], strings: [1, 1, 3, 3, 2, 1], fingers: ['1', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bm', root: 'B', type: 'Minor', notes: ['B', 'D', 'F#'], strings: [-1, 2, 4, 4, 3, 2], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'Cm', root: 'C', type: 'Minor', notes: ['C', 'Eb', 'G'], strings: [-1, 3, 5, 5, 4, 3], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 3, barre: 3 },
    { name: 'Fm', root: 'F', type: 'Minor', notes: ['F', 'Ab', 'C'], strings: [1, 3, 3, 1, 1, 1], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Gm', root: 'G', type: 'Minor', notes: ['G', 'Bb', 'D'], strings: [3, 5, 5, 3, 3, 3], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 3, barre: 3 },
    { name: 'D/F#', root: 'D', type: 'Slash', notes: ['D', 'F#', 'A'], strings: [2, -1, 0, 2, 3, 2], fingers: ['2', 'x', '0', '1', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'G/B', root: 'G', type: 'Slash', notes: ['G', 'B', 'D'], strings: [-1, 2, 0, 0, 0, 3], fingers: ['x', '2', '0', '0', '0', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Ab', root: 'Ab', type: 'Major', notes: ['Ab', 'C', 'Eb'], strings: [4, 6, 6, 5, 4, 4], fingers: ['1', '3', '4', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Ab6', root: 'Ab', type: '6', notes: ['Ab', 'C', 'Eb', 'F'], strings: [4, 3, 3, 5, 4, 4], fingers: ['2', '1', '1', '3', '2', '2'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'Ab7', root: 'Ab', type: '7', notes: ['Ab', 'C', 'Eb', 'Gb'], strings: [4, 3, 4, 5, 4, 4], fingers: ['2', '1', '2', '3', '2', '2'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'Ab9', root: 'Ab', type: '9', notes: ['Ab', 'C', 'Eb', 'Gb', 'Bb'], strings: [4, 3, 4, 3, 4, 4], fingers: ['2', '1', '3', '1', '4', '4'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'G#m6', root: 'G#', type: '6', notes: ['G#', 'B', 'D#', 'F'], strings: [4, 6, 6, 4, 6, 4], fingers: ['1', '3', '4', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'G#m7', root: 'G#', type: 'm7', notes: ['G#', 'B', 'D#', 'F#'], strings: [4, 6, 4, 4, 4, 4], fingers: ['1', '3', '1', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Abmaj7', root: 'Ab', type: 'Maj7', notes: ['Ab', 'C', 'Eb', 'G'], strings: [4, 6, 5, 5, 4, 4], fingers: ['1', '3', '2', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'G#dim', root: 'G#', type: 'Dim', notes: ['G#', 'B', 'D', 'F'], strings: [4, 5, 6, 4, 6, 4], fingers: ['1', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Ab+', root: 'Ab', type: 'Aug', notes: ['Ab', 'C', 'E'], strings: [4, 3, 2, 1, 1, 0], fingers: ['3', '2', '1', '1', '1', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Absus', root: 'Ab', type: 'Sus4', notes: ['Ab', 'Db', 'Eb'], strings: [4, 6, 6, 6, 4, 4], fingers: ['1', '3', '4', '4', '1', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'A6', root: 'A', type: '6', notes: ['A', 'C#', 'E', 'F#'], strings: [-1, 0, 2, 2, 2, 2], fingers: ['x', '0', '1', '1', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'A9', root: 'A', type: '9', notes: ['A', 'C#', 'E', 'G', 'B'], strings: [-1, 0, 2, 4, 2, 3], fingers: ['x', '0', '1', '3', '1', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Am6', root: 'A', type: '6', notes: ['A', 'C', 'E', 'F#'], strings: [-1, 0, 2, 2, 1, 2], fingers: ['x', '0', '2', '3', '1', '4'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Amaj7', root: 'A', type: 'Maj7', notes: ['A', 'C#', 'E', 'G#'], strings: [-1, 0, 2, 1, 2, 0], fingers: ['x', '0', '2', '1', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Adim', root: 'A', type: 'Dim', notes: ['A', 'C', 'Eb', 'Gb'], strings: [-1, 0, 1, 2, 1, -1], fingers: ['x', '0', '1', '3', '2', 'x'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'A+', root: 'A', type: 'Aug', notes: ['A', 'C#', 'F'], strings: [-1, 0, 3, 2, 2, 1], fingers: ['x', '0', '3', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Asus', root: 'A', type: 'Sus4', notes: ['A', 'D', 'E'], strings: [-1, 0, 2, 2, 3, 0], fingers: ['x', '0', '1', '1', '2', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Bb6', root: 'Bb', type: '6', notes: ['Bb', 'D', 'F', 'G'], strings: [1, 1, 3, 3, 3, 3], fingers: ['1', '1', '2', '3', '3', '3'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bb7', root: 'Bb', type: '7', notes: ['Bb', 'D', 'F', 'Ab'], strings: [1, 1, 3, 1, 3, 1], fingers: ['1', '1', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bb9', root: 'Bb', type: '9', notes: ['Bb', 'D', 'F', 'Ab', 'C'], strings: [1, 1, 3, 1, 1, 3], fingers: ['1', '1', '3', '1', '1', '4'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bbm6', root: 'Bb', type: '6', notes: ['Bb', 'Db', 'F', 'G'], strings: [1, 1, 3, 3, 2, 3], fingers: ['1', '1', '3', '4', '2', '4'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bbm7', root: 'Bb', type: 'm7', notes: ['Bb', 'Db', 'F', 'Ab'], strings: [1, 1, 3, 1, 2, 1], fingers: ['1', '1', '3', '1', '2', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bbmaj7', root: 'Bb', type: 'Maj7', notes: ['Bb', 'D', 'F', 'A'], strings: [1, 1, 3, 2, 3, 1], fingers: ['1', '1', '3', '2', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bbdim', root: 'Bb', type: 'Dim', notes: ['Bb', 'Db', 'E', 'G'], strings: [1, 2, 3, 1, 3, 1], fingers: ['1', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Bb+', root: 'Bb', type: 'Aug', notes: ['Bb', 'D', 'F#'], strings: [1, 0, 3, 2, 2, 1], fingers: ['1', '0', '3', '2', '2', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Bbsus', root: 'Bb', type: 'Sus4', notes: ['Bb', 'Eb', 'F'], strings: [1, 1, 3, 3, 4, 1], fingers: ['1', '1', '2', '3', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'B', root: 'B', type: 'Major', notes: ['B', 'D#', 'F#'], strings: [-1, 2, 4, 4, 4, 2], fingers: ['x', '1', '3', '4', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'B6', root: 'B', type: '6', notes: ['B', 'D#', 'F#', 'G#'], strings: [2, 2, 4, 4, 4, 4], fingers: ['1', '1', '3', '3', '3', '3'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'B9', root: 'B', type: '9', notes: ['B', 'D#', 'F#', 'A', 'C#'], strings: [2, 2, 1, 2, 2, 2], fingers: ['2', '3', '1', '4', '4', '4'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Bm6', root: 'B', type: '6', notes: ['B', 'D', 'F#', 'G#'], strings: [-1, 2, 4, 4, 3, 4], fingers: ['x', '1', '3', '4', '2', '4'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'Bm7', root: 'B', type: 'm7', notes: ['B', 'D', 'F#', 'A'], strings: [-1, 2, 4, 2, 3, 2], fingers: ['x', '1', '3', '1', '2', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'Bmaj7', root: 'B', type: 'Maj7', notes: ['B', 'D#', 'F#', 'A#'], strings: [-1, 2, 4, 3, 4, 2], fingers: ['x', '1', '3', '2', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'Bdim', root: 'B', type: 'Dim', notes: ['B', 'D', 'F', 'Ab'], strings: [-1, 2, 3, 4, 3, -1], fingers: ['x', '1', '2', '4', '3', 'x'], difficulty: 'Intermediate', baseFret: 2 },
    { name: 'B+', root: 'B', type: 'Aug', notes: ['B', 'D#', 'G'], strings: [-1, 2, 1, 0, 0, 3], fingers: ['x', '2', '1', '0', '0', '3'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Bsus', root: 'B', type: 'Sus4', notes: ['B', 'E', 'F#'], strings: [-1, 2, 4, 4, 5, 2], fingers: ['x', '1', '3', '3', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'C6', root: 'C', type: '6', notes: ['C', 'E', 'G', 'A'], strings: [-1, 3, 2, 2, 1, 0], fingers: ['x', '3', '2', '1', '1', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'C9', root: 'C', type: '9', notes: ['C', 'E', 'G', 'Bb', 'D'], strings: [-1, 3, 2, 3, 3, 3], fingers: ['x', '2', '1', '3', '4', '4'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Cm6', root: 'C', type: '6', notes: ['C', 'Eb', 'G', 'A'], strings: [-1, 3, 1, 2, 1, 3], fingers: ['x', '3', '1', '2', '1', '4'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Cm7', root: 'C', type: 'm7', notes: ['C', 'Eb', 'G', 'Bb'], strings: [-1, 3, 5, 3, 4, 3], fingers: ['x', '1', '3', '1', '2', '1'], difficulty: 'Intermediate', baseFret: 3, barre: 3 },
    { name: 'Cdim', root: 'C', type: 'Dim', notes: ['C', 'Eb', 'Gb', 'A'], strings: [-1, 3, 4, 2, 4, 2], fingers: ['x', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 2 },
    { name: 'C+', root: 'C', type: 'Aug', notes: ['C', 'E', 'G#'], strings: [-1, 3, 2, 1, 1, 0], fingers: ['x', '3', '2', '1', '1', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Csus', root: 'C', type: 'Sus4', notes: ['C', 'F', 'G'], strings: [-1, 3, 3, 0, 1, 1], fingers: ['x', '3', '4', '0', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Db', root: 'Db', type: 'Major', notes: ['Db', 'F', 'Ab'], strings: [-1, 4, 6, 6, 6, 4], fingers: ['x', '1', '3', '4', '4', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Db6', root: 'Db', type: '6', notes: ['Db', 'F', 'Ab', 'Bb'], strings: [4, 4, 6, 6, 6, 6], fingers: ['1', '1', '3', '3', '3', '3'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Db7', root: 'Db', type: '7', notes: ['Db', 'F', 'Ab', 'Cb'], strings: [-1, 4, 6, 4, 6, 4], fingers: ['x', '1', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Db9', root: 'Db', type: '9', notes: ['Db', 'F', 'Ab', 'Cb', 'Eb'], strings: [4, 4, 3, 4, 4, 4], fingers: ['2', '3', '1', '4', '4', '4'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'C#m6', root: 'C#', type: '6', notes: ['C#', 'E', 'G#', 'A#'], strings: [-1, 4, 6, 6, 5, 6], fingers: ['x', '1', '3', '4', '2', '4'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'C#m7', root: 'C#', type: 'm7', notes: ['C#', 'E', 'G#', 'B'], strings: [-1, 4, 6, 4, 5, 4], fingers: ['x', '1', '3', '1', '2', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'Dbmaj7', root: 'Db', type: 'Maj7', notes: ['Db', 'F', 'Ab', 'C'], strings: [-1, 4, 6, 5, 6, 4], fingers: ['x', '1', '3', '2', '4', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'C#dim', root: 'C#', type: 'Dim', notes: ['C#', 'E', 'G', 'Bb'], strings: [-1, 4, 5, 3, 5, 3], fingers: ['x', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'Db+', root: 'Db', type: 'Aug', notes: ['Db', 'F', 'A'], strings: [-1, 4, 3, 2, 2, 1], fingers: ['x', '3', '2', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Dbsus', root: 'Db', type: 'Sus4', notes: ['Db', 'Gb', 'Ab'], strings: [-1, 4, 6, 6, 7, 4], fingers: ['x', '1', '3', '3', '4', '1'], difficulty: 'Intermediate', baseFret: 4, barre: 4 },
    { name: 'D6', root: 'D', type: '6', notes: ['D', 'F#', 'A', 'B'], strings: [-1, -1, 0, 2, 0, 2], fingers: ['x', 'x', '0', '1', '0', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'D9', root: 'D', type: '9', notes: ['D', 'F#', 'A', 'C', 'E'], strings: [-1, 5, 4, 5, 5, 5], fingers: ['x', '2', '1', '3', '4', '4'], difficulty: 'Intermediate', baseFret: 4 },
    { name: 'Dm6', root: 'D', type: '6', notes: ['D', 'F', 'A', 'B'], strings: [-1, -1, 0, 2, 0, 1], fingers: ['x', 'x', '0', '2', '0', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Ddim', root: 'D', type: 'Dim', notes: ['D', 'F', 'Ab', 'B'], strings: [-1, -1, 0, 1, 0, 1], fingers: ['x', 'x', '0', '1', '0', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'D+', root: 'D', type: 'Aug', notes: ['D', 'F#', 'A#'], strings: [-1, -1, 0, 3, 2, 2], fingers: ['x', 'x', '0', '3', '1', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Dsus', root: 'D', type: 'Sus4', notes: ['D', 'G', 'A'], strings: [-1, -1, 0, 2, 3, 3], fingers: ['x', 'x', '0', '1', '2', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Eb', root: 'Eb', type: 'Major', notes: ['Eb', 'G', 'Bb'], strings: [-1, 6, 8, 8, 8, 6], fingers: ['x', '1', '3', '4', '4', '1'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Ebm', root: 'Eb', type: 'Minor', notes: ['Eb', 'Gb', 'Bb'], strings: [-1, 6, 8, 8, 7, 6], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Eb6', root: 'Eb', type: '6', notes: ['Eb', 'G', 'Bb', 'C'], strings: [6, 6, 8, 8, 8, 8], fingers: ['1', '1', '3', '3', '3', '3'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Eb7', root: 'Eb', type: '7', notes: ['Eb', 'G', 'Bb', 'Db'], strings: [-1, 6, 8, 6, 8, 6], fingers: ['x', '1', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Eb9', root: 'Eb', type: '9', notes: ['Eb', 'G', 'Bb', 'Db', 'F'], strings: [6, 6, 5, 6, 6, 6], fingers: ['2', '3', '1', '4', '4', '4'], difficulty: 'Intermediate', baseFret: 5 },
    { name: 'Ebm6', root: 'Eb', type: '6', notes: ['Eb', 'Gb', 'Bb', 'C'], strings: [-1, 6, 8, 8, 7, 8], fingers: ['x', '1', '3', '4', '2', '4'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Ebm7', root: 'Eb', type: 'm7', notes: ['Eb', 'Gb', 'Bb', 'Db'], strings: [-1, 6, 8, 6, 7, 6], fingers: ['x', '1', '3', '1', '2', '1'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Ebmaj7', root: 'Eb', type: 'Maj7', notes: ['Eb', 'G', 'Bb', 'D'], strings: [-1, 6, 8, 7, 8, 6], fingers: ['x', '1', '3', '2', '4', '1'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'Ebdim', root: 'Eb', type: 'Dim', notes: ['Eb', 'Gb', 'A', 'C'], strings: [-1, 6, 7, 5, 7, 5], fingers: ['x', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 5 },
    { name: 'Eb+', root: 'Eb', type: 'Aug', notes: ['Eb', 'G', 'B'], strings: [-1, 6, 5, 4, 4, 3], fingers: ['x', '3', '2', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'Ebsus', root: 'Eb', type: 'Sus4', notes: ['Eb', 'Ab', 'Bb'], strings: [-1, 6, 8, 8, 9, 6], fingers: ['x', '1', '3', '3', '4', '1'], difficulty: 'Intermediate', baseFret: 6, barre: 6 },
    { name: 'E6', root: 'E', type: '6', notes: ['E', 'G#', 'B', 'C#'], strings: [0, 2, 2, 1, 2, 0], fingers: ['0', '2', '2', '1', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'E9', root: 'E', type: '9', notes: ['E', 'G#', 'B', 'D', 'F#'], strings: [0, 2, 0, 1, 0, 2], fingers: ['0', '2', '0', '1', '0', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Em6', root: 'E', type: '6', notes: ['E', 'G', 'B', 'C#'], strings: [0, 2, 2, 0, 2, 0], fingers: ['0', '2', '3', '0', '4', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Emaj7', root: 'E', type: 'Maj7', notes: ['E', 'G#', 'B', 'D#'], strings: [0, 2, 1, 1, 0, 0], fingers: ['0', '3', '1', '2', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Edim', root: 'E', type: 'Dim', notes: ['E', 'G', 'Bb', 'Db'], strings: [0, 1, 2, 0, 2, 0], fingers: ['0', '1', '2', '0', '3', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'E+', root: 'E', type: 'Aug', notes: ['E', 'G#', 'C'], strings: [0, 3, 2, 1, 1, 0], fingers: ['0', '3', '2', '1', '1', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Esus', root: 'E', type: 'Sus4', notes: ['E', 'A', 'B'], strings: [0, 2, 2, 2, 0, 0], fingers: ['0', '1', '1', '1', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'F6', root: 'F', type: '6', notes: ['F', 'A', 'C', 'D'], strings: [1, 3, 3, 2, 3, 1], fingers: ['1', '3', '4', '2', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'F7', root: 'F', type: '7', notes: ['F', 'A', 'C', 'Eb'], strings: [1, 3, 1, 2, 1, 1], fingers: ['1', '3', '1', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'F9', root: 'F', type: '9', notes: ['F', 'A', 'C', 'Eb', 'G'], strings: [1, 3, 1, 2, 1, 3], fingers: ['1', '3', '1', '2', '1', '4'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Fm6', root: 'F', type: '6', notes: ['F', 'Ab', 'C', 'D'], strings: [1, 3, 3, 1, 3, 1], fingers: ['1', '3', '4', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Fm7', root: 'F', type: 'm7', notes: ['F', 'Ab', 'C', 'Eb'], strings: [1, 3, 1, 1, 1, 1], fingers: ['1', '3', '1', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Fdim', root: 'F', type: 'Dim', notes: ['F', 'Ab', 'B', 'D'], strings: [1, 2, 3, 1, 3, 1], fingers: ['1', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'F+', root: 'F', type: 'Aug', notes: ['F', 'A', 'C#'], strings: [1, 0, 3, 2, 2, 1], fingers: ['1', '0', '3', '2', '2', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Fsus', root: 'F', type: 'Sus4', notes: ['F', 'Bb', 'C'], strings: [1, 3, 3, 3, 1, 1], fingers: ['1', '3', '4', '4', '1', '1'], difficulty: 'Intermediate', baseFret: 1, barre: 1 },
    { name: 'Gb6', root: 'Gb', type: '6', notes: ['Gb', 'Bb', 'Db', 'Eb'], strings: [2, 2, 4, 4, 4, 4], fingers: ['1', '1', '3', '3', '3', '3'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'F#7', root: 'F#', type: '7', notes: ['F#', 'A#', 'C#', 'E'], strings: [2, 4, 2, 3, 2, 2], fingers: ['1', '3', '1', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'F#9', root: 'F#', type: '9', notes: ['F#', 'A#', 'C#', 'E', 'G#'], strings: [2, 4, 2, 3, 2, 4], fingers: ['1', '3', '1', '2', '1', '4'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'F#m6', root: 'F#', type: '6', notes: ['F#', 'A', 'C#', 'D#'], strings: [2, 4, 4, 2, 4, 2], fingers: ['1', '3', '4', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'F#m7', root: 'F#', type: 'm7', notes: ['F#', 'A', 'C#', 'E'], strings: [2, 4, 2, 2, 2, 2], fingers: ['1', '3', '1', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'Gbmaj7', root: 'Gb', type: 'Maj7', notes: ['Gb', 'Bb', 'Db', 'F'], strings: [2, 4, 3, 3, 4, 2], fingers: ['1', '3', '2', '2', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'F#dim', root: 'F#', type: 'Dim', notes: ['F#', 'A', 'C', 'Eb'], strings: [2, 3, 4, 2, 4, 2], fingers: ['1', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'Gb+', root: 'Gb', type: 'Aug', notes: ['Gb', 'Bb', 'D'], strings: [2, 1, 4, 3, 3, 2], fingers: ['2', '1', '4', '3', '3', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Gbsus', root: 'Gb', type: 'Sus4', notes: ['Gb', 'Cb', 'Db'], strings: [2, 4, 4, 4, 5, 2], fingers: ['1', '3', '3', '3', '4', '1'], difficulty: 'Intermediate', baseFret: 2, barre: 2 },
    { name: 'G6', root: 'G', type: '6', notes: ['G', 'B', 'D', 'E'], strings: [3, 2, 0, 0, 0, 0], fingers: ['3', '2', '0', '0', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'G9', root: 'G', type: '9', notes: ['G', 'B', 'D', 'F', 'A'], strings: [3, 2, 0, 1, 0, 3], fingers: ['3', '2', '0', '1', '0', '4'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gm6', root: 'G', type: '6', notes: ['G', 'Bb', 'D', 'E'], strings: [3, 5, 5, 3, 3, 5], fingers: ['1', '3', '4', '1', '1', '4'], difficulty: 'Intermediate', baseFret: 3, barre: 3 },
    { name: 'Gm7', root: 'G', type: 'm7', notes: ['G', 'Bb', 'D', 'F'], strings: [3, 5, 3, 3, 3, 3], fingers: ['1', '3', '1', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 3, barre: 3 },
    { name: 'Gdim', root: 'G', type: 'Dim', notes: ['G', 'Bb', 'Db', 'E'], strings: [3, 4, 5, 3, 5, 3], fingers: ['1', '2', '3', '1', '4', '1'], difficulty: 'Intermediate', baseFret: 3, barre: 3 },
    { name: 'G+', root: 'G', type: 'Aug', notes: ['G', 'B', 'D#'], strings: [3, 2, 1, 0, 0, 3], fingers: ['3', '2', '1', '0', '0', '4'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Gsus', root: 'G', type: 'Sus4', notes: ['G', 'C', 'D'], strings: [3, 3, 0, 0, 1, 3], fingers: ['3', '4', '0', '0', '1', '2'], difficulty: 'Beginner', baseFret: 1 },
  ], [])

  const visible = chordDatabase.filter((chord) => {
    const queryText = `${chord.name} ${chord.root} ${chord.type}`.toLowerCase()
    const matchesQuery = !query || queryText.includes(query.toLowerCase())
    const matchesRoot = rootFilter === 'All' || chord.root === rootFilter
    const matchesType = typeFilter === 'All' || chord.type === typeFilter
    return matchesQuery && matchesRoot && matchesType
  })

  useEffect(() => {
    if (!selectedChord) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedChord(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedChord])

  const closeModal = () => setSelectedChord(null)

  return (
    <div className="page chord-library-page">
      <header className="v5-page-header">
        <div>
          <div className="eyebrow">Reference for guitarists</div>
          <h1>Chord library</h1>
        </div>
      </header>

      <div className="v5-search-row chord-search-row">
        <div className="search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chord names, roots, or types" />
        </div>
        <select value={rootFilter} onChange={(event) => setRootFilter(event.target.value)}>
          {rootOptions.map((root) => <option key={root}>{root}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          {typeOptions.map((type) => <option key={type}>{type}</option>)}
        </select>
      </div>

      <div className="chord-family-grid">
        {visible.map((chord) => (
          <button key={chord.name} type="button" className="library-chord" onClick={() => setSelectedChord(chord)}>
            <strong>{chord.name}</strong>
            <small>{chord.type}</small>
            <GuitarChordDiagram chord={chord} compact />
          </button>
        ))}
      </div>

      {selectedChord && (
        <div className="chord-detail-backdrop" role="presentation" onClick={(event) => {
          if (event.target === event.currentTarget) closeModal()
        }}>
          <ChordDetail chord={selectedChord} onClose={closeModal} />
        </div>
      )}
    </div>
  )
}

function GuitarChordDiagram({ chord, compact = false }: { chord: ChordDefinition; compact?: boolean }) {
  const fretCount = 5
  const strings = ['Low E', 'A', 'D', 'G', 'B', 'High E']
  const markers = chord.strings.map((position, index) => ({ position, finger: chord.fingers[index], label: strings[index] }))

  return (
    <div className={compact ? 'diagram compact-diagram' : 'diagram'} aria-label={`${chord.name} guitar chord diagram, low E to high E`}>
      <div className="diagram-row diagram-header">
        {markers.map((marker, index) => <span key={marker.label} title={marker.label}>{6 - index}</span>)}
      </div>
      <div className="diagram-position">{chord.baseFret > 1 ? `${chord.baseFret}fr` : '1fr'}</div>
      <div className="diagram-markers" aria-hidden="true">
        {markers.map((marker, index) => {
          const className = marker.position < 0 ? 'muted' : marker.position === 0 ? 'open' : 'fretted'
          return <span key={marker.label} className={`diagram-mark ${className}`} style={{ gridColumn: index + 1 }}>{marker.position < 0 ? 'X' : marker.position === 0 ? 'O' : ''}</span>
        })}
      </div>
      <div className="diagram-board" style={{ '--diagram-frets': fretCount } as CSSProperties}>
        {markers.map((marker, index) => <span key={`string-${marker.label}`} className="diagram-string" style={{ left: `${((index + 0.5) / markers.length) * 100}%` }} aria-hidden="true" />)}
        {Array.from({ length: fretCount }, (_, index) => <span key={`fret-${index}`} className="diagram-fret" style={{ gridRow: index + 1 }} />)}
        {markers.map((marker, index) => marker.position > 0 && marker.position >= chord.baseFret && marker.position < chord.baseFret + fretCount
          ? <span key={marker.label} className="diagram-mark fretted" style={{ gridColumn: index + 1, gridRow: marker.position - chord.baseFret + 1 }}><small>{marker.finger}</small></span>
          : null)}
        {chord.barre && <span className="diagram-barre" style={{ gridColumn: `1 / ${markers.length + 1}`, gridRow: chord.barre - chord.baseFret + 1 }} />}
      </div>
    </div>
  )
}

function ChordDetail({ chord, onClose }: { chord: ChordDefinition; onClose: () => void }) {
  return (
    <section className="chord-detail" role="dialog" aria-modal="true" aria-label={`${chord.name} detail`}>
      <button type="button" className="close-button" onClick={onClose} aria-label="Close chord details"><X size={18} /></button>
      <div className="eyebrow">Chord detail</div>
      <h2>{chord.name}</h2>
      <GuitarChordDiagram chord={chord} />
      <div className="detail-meta">
        <p><strong>Notes:</strong> {chord.notes.join(' ')}</p>
        <p><strong>Fingering:</strong> {chord.strings.map((value) => (value === -1 ? 'X' : value === 0 ? 'O' : String(value))).join(' ')}</p>
        <p><strong>Difficulty:</strong> {chord.difficulty}</p>
      </div>
    </section>
  )
}

export function SettingsPageV5({ settings, onSettings }: { settings: Settings; onSettings: (settings: Settings) => void }) {
  return (
    <div className="page">
      <header className="v5-page-header">
        <div>
          <div className="eyebrow">Personal preferences</div>
          <h1>Settings</h1>
        </div>
      </header>

      <div className="settings-list v5-settings">
        <div className="setting">
          <div>
            <h3>Theme</h3>
            <p>Choose the color theme for the app.</p>
          </div>
          <div className="segmented">
            <button className={settings.theme === 'light' ? 'selected' : ''} onClick={() => onSettings({ ...settings, theme: 'light' })}><Sun size={15} />Light</button>
            <button className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => onSettings({ ...settings, theme: 'dark' })}><Moon size={15} />Dark</button>
          </div>
        </div>

      </div>
    </div>
  )
}

export function PrivateSessionPage({ songs, sessions, isOwner, onCreate, onUpdate, onDelete }: { songs: Song[]; sessions: { id: string; name: string; date: string; description: string; songIds: string[] }[]; isOwner: boolean; onCreate: (session: { id: string; name: string; date: string; description: string; songIds: string[] }) => Promise<{ id: string; name: string; date: string; description: string; songIds: string[] }>; onUpdate: (session: { id: string; name: string; date: string; description: string; songIds: string[] }) => Promise<{ id: string; name: string; date: string; description: string; songIds: string[] }>; onDelete: (sessionId: string) => Promise<void> | void; }) {
  const [selectedId, setSelectedId] = useState(() => sessions[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const sortedSessions = [...sessions].sort((left, right) => (right.date || '').localeCompare(left.date || ''))
  const session = sortedSessions.find((item) => item.id === selectedId) ?? sortedSessions[0]

  useEffect(() => {
    if (!sortedSessions.length) {
      setSelectedId('')
      return
    }
    if (!selectedId || !sortedSessions.some((item) => item.id === selectedId)) setSelectedId(sortedSessions[0].id)
  }, [selectedId, sortedSessions])

  if (!sortedSessions.length) {
    return <div className="page"><header className="private-session-header"><div><div className="eyebrow">Scheduled worship</div><h1>Private Session</h1></div>{isOwner && <button className="primary-button" onClick={() => void onCreate({ id: '', name: 'Private Session', date: new Date().toISOString().slice(0, 10), description: '', songIds: [] })}>Create session</button>}</header><div className="empty private-session-empty"><h2>No private sessions yet</h2>{isOwner ? <p>Create one to plan a rehearsal, personal set, or any non-Sunday date.</p> : <p>There are no private sessions available right now.</p>}</div></div>
  }

  const available = songs.filter((song) => !session.songIds.includes(song.id) && song.title.toLowerCase().includes(query.toLowerCase()))

  const moveSong = (songId: string, direction: -1 | 1) => {
    const index = session.songIds.indexOf(songId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= session.songIds.length) return
    const next = [...session.songIds]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    void onUpdate({ ...session, songIds: next })
  }

  return (
    <div className="page private-session-page">
      <header className="private-session-header">
        <div>
          <div className="eyebrow">Flexible schedule</div>
          <h1>Private Session</h1>
          <select className="private-session-selector" value={session.id} onChange={(event) => setSelectedId(event.target.value)} aria-label="Select private session">{sortedSessions.map((item) => <option key={item.id} value={item.id}>{item.name || 'Private Session'} · {item.date}</option>)}</select>
          {isOwner && <input className="private-session-date-input" type="date" value={session.date} onChange={(event) => { const nextDate = event.target.value; if (nextDate) void onUpdate({ ...session, date: nextDate }); }} aria-label="Private session date" />}
        </div>
        <div className="private-session-actions">
          {isOwner && <button className="primary-button" onClick={() => void onCreate({ id: '', name: 'Private Session', date: new Date().toISOString().slice(0, 10), description: '', songIds: [] })}>New session</button>}
          {isOwner && session && <button className="secondary-button" onClick={() => void onDelete(session.id)} aria-label="Delete private session">Delete</button>}
        </div>
      </header>

      <div className="private-session-layout">
        <main className="private-session-songs">
          <div className="section-heading"><div><span className="eyebrow">Planned songs</span></div></div>
          <div className="private-session-list">
            {session.songIds.map((songId, index) => {
              const song = songs.find((item) => item.id === songId)
              if (!song) return null
              return (
                <div className="private-session-song" key={song.id}>
                  <span className="song-order">{index + 1}</span>
                  <Link to={`/songs/${song.id}`} className="song-summary"><strong>{song.title}</strong></Link>
                  {isOwner && <div className="private-session-controls">
                    <button className="icon-button" onClick={() => moveSong(song.id, -1)} disabled={index === 0} aria-label="Move earlier"><ChevronLeft size={15} /></button>
                    <button className="icon-button" onClick={() => moveSong(song.id, 1)} disabled={index === session.songIds.length - 1} aria-label="Move later"><ChevronRight size={15} /></button>
                    <button className="icon-button" onClick={() => void onUpdate({ ...session, songIds: session.songIds.filter((item) => item !== song.id) })} aria-label="Remove from private session"><Trash2 size={15} /></button>
                  </div>}
                </div>
              )
            })}
            {!session.songIds.length && <p className="muted-text">No songs added yet.</p>}
          </div>
        </main>

        {isOwner && <aside className="add-sunday-panel">
          <div className="section-heading"><div><span className="eyebrow">Add songs</span><h2>Available songs</h2></div></div>
          <div className="search compact-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs" /></div>
          <div className="available-list">{available.length ? available.map((song) => <button key={song.id} className="available-song" onClick={() => void onUpdate({ ...session, songIds: [...session.songIds, song.id] })}><strong>{song.title}</strong></button>) : <p className="muted-text">No songs match.</p>}</div>
        </aside>}
      </div>
    </div>
  )
}

export function SundayPageV5({ songs, setlists, settings, onCreate, onUpdate, onDuplicate, isOwner }: { songs: Song[]; setlists: Setlist[]; settings: Settings; onCreate: () => void; onUpdate: (setlist: Setlist) => void; onDuplicate: (setlist: Setlist) => void; isOwner: boolean }) {
  const [searchParams] = useSearchParams()
  const [selectedSundayId, setSelectedSundayId] = useState(() => searchParams.get('sunday') || '')
  const [query, setQuery] = useState('')
  const upcoming = upcomingSundayIso()
  const sundaySetlists = setlists.filter((item) => isSundayIso(item.date))
  const defaultSunday = sundaySetlists.find((item) => item.date === upcoming) ?? sundaySetlists.find((item) => item.date >= upcoming) ?? sundaySetlists[0]
  const sunday = sundaySetlists.find((item) => item.id === selectedSundayId) ?? defaultSunday
  const previous = sundaySetlists.find((item) => item.id !== sunday?.id)

  useEffect(() => {
    if (sunday && sunday.id !== selectedSundayId) setSelectedSundayId(sunday.id)
  }, [selectedSundayId, sunday])

  if (!sunday) {
    return (
      <div className="page">
        <header className="sunday-header">
          <div>
            <div className="eyebrow">This week's worship service</div>
              <h1>Sunday</h1>
          </div>
          <div className="sunday-header-actions">
            {isOwner && <button className="secondary-button" onClick={onCreate}><CalendarDays size={16} />New Sunday</button>}
          </div>
        </header>
      </div>
    )
  }

  const available = songs.filter((song) => !sunday.songIds.includes(song.id) && song.title.toLowerCase().includes(query.toLowerCase()))

  const moveSong = (songId: string, direction: -1 | 1) => {
    const index = sunday.songIds.indexOf(songId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= sunday.songIds.length) return

    const next = [...sunday.songIds]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    onUpdate({ ...sunday, songIds: next })
  }

  return (
    <div className="page sunday-page">
      <header className="sunday-header">
        <div>
          <div className="eyebrow">This week's worship service</div>
          <h1>Sunday Service</h1>
          <select className="sunday-selector" value={sunday.id} onChange={(event) => setSelectedSundayId(event.target.value)} aria-label="Select Sunday schedule">
            {sundaySetlists.map((item) => <option key={item.id} value={item.id}>{formatSundayTitle(item.date)}</option>)}
          </select>
          {isOwner && <input className="sunday-date-input" type="date" value={sunday.date} onChange={(event) => {
            const nextDate = toIsoDate(event.target.value)
            if (nextDate && isSundayIso(nextDate)) void onUpdate({ ...sunday, date: nextDate })
          }} aria-label="Sunday date" />}
        </div>
        <div className="sunday-header-actions">
          {isOwner && <button className="secondary-button" onClick={onCreate}><CalendarDays size={16} />New Sunday</button>}
          {isOwner && previous && <button className="secondary-button" onClick={() => onDuplicate(previous)}>Duplicate previous</button>}
        </div>
      </header>

      <div className="sunday-layout">
        <main className="sunday-songs">
          <div className="section-heading">
            <div>
                <span className="eyebrow">Songs for this service</span>
            </div>
          </div>

          <div className="sunday-list">
            {sunday.songIds.map((songId, index) => {
              const song = songs.find((item) => item.id === songId)
              if (!song) return null
              return (
                <div className="sunday-song" key={song.id}>
                  <span className="song-order">{index + 1}</span>
                  <Link to={`/songs/${song.id}?sunday=${encodeURIComponent(sunday.id)}`} className="song-summary">
                    <strong>{song.title}</strong>
                  </Link>
                  {isOwner && <div className="sunday-controls">
                    <button className="icon-button" onClick={() => moveSong(song.id, -1)} aria-label="Move earlier" disabled={index === 0}><ChevronLeft size={15} /></button>
                    <button className="icon-button" onClick={() => moveSong(song.id, 1)} aria-label="Move later" disabled={index === sunday.songIds.length - 1}><ChevronRight size={15} /></button>
                    <button className="icon-button" onClick={() => onUpdate({ ...sunday, songIds: sunday.songIds.filter((item) => item !== song.id) })} aria-label="Remove from Sunday"><Trash2 size={15} /></button>
                  </div>}
                </div>
              )
            })}
          </div>

        </main>

        {isOwner && <aside className="add-sunday-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Add to Sunday</span>
              <h2>Available songs</h2>
            </div>
          </div>

          <div className="search compact-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs" />
          </div>

          <div className="available-list">
            {available.length ? available.map((song) => (
              <button key={song.id} className="available-song" onClick={() => onUpdate({ ...sunday, songIds: [...sunday.songIds, song.id] })}>
                <strong>{song.title}</strong>
              </button>
            )) : <p className="muted-text">No songs match.</p>}
          </div>
        </aside>}
      </div>
    </div>
  )
}
