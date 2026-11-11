import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Image as ImageIcon, Moon, Plus, Save, Search, Sun, Trash2, Upload } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { capoShapeKey, chromatic, parseChordProgression, simplifyChord, transposeChord, type Notation } from './music'
import type { Section, Settings, Setlist, Song, WorshipEvent } from './data'

const id = () => Math.random().toString(36).slice(2, 9)

const keyIndex = (key: string) => Math.max(0, chromatic.indexOf(key.replace('b', '#')))
const shiftKey = (key: string, amount: number) => chromatic[(keyIndex(key) + amount + 24) % 12]

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
  const tokens = parseChordProgression(line)
  return tokens.length ? tokens.map((token, index) => <span key={`${token}-${index}`} className="chord-token">{displayChord(token, interval, notation, simplifyValue)}</span>) : <span className="chord-token muted">{line}</span>
}

export function HomePage({ songs, setlists, onCreateSong, isOwner }: { songs: Song[]; setlists: Setlist[]; onCreateSong: () => void; isOwner: boolean }) {
  const sunday = setlists[0]

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
        <span className="dashboard-mark">WG</span>
      </header>

      <section className="home-sunday">
        <div>
          <span className="eyebrow">This Sunday</span>
          <h2>{sunday?.name || 'No Sunday set yet'}</h2>
          <p>{sunday?.date || 'Open Sunday to prepare your set.'}</p>
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

export function EventPage({ songs, events, onCreate, onUpdate, onDelete, isOwner }: {
  songs: Song[]
  events: WorshipEvent[]
  onCreate: () => void
  onUpdate: (event: WorshipEvent) => void
  onDelete: (eventId: string) => void
  isOwner: boolean
}) {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const event = events.find((item) => item.id === eventId)
  const [query, setQuery] = useState('')
  const [name, setName] = useState(event?.name ?? '')
  const [date, setDate] = useState(event?.date ?? '')
  const [description, setDescription] = useState(event?.description ?? '')

  useEffect(() => {
    setName(event?.name ?? '')
    setDate(event?.date ?? '')
    setDescription(event?.description ?? '')
  }, [event?.id, event?.name, event?.date, event?.description])

  if (!eventId) {
    return (
      <div className="page">
        <header className="v5-page-header">
          <div><div className="eyebrow">Special services and gatherings</div><h1>Events</h1></div>
          {isOwner && <button className="primary-button" onClick={onCreate}><CalendarDays size={16} />New event</button>}
        </header>
        <div className="event-list">
          {events.map((item) => (
            <Link className="event-card" to={`/events/${item.id}`} key={item.id}>
              <span><strong>{item.name}</strong><small>{item.date} · {item.songIds.length} songs</small></span>
              <ChevronRight size={17} />
            </Link>
          ))}
          {!events.length && <div className="empty"><h2>No events yet</h2><p>{isOwner ? 'Create an event to prepare its song list.' : 'Events added by the owner will appear here.'}</p></div>}
        </div>
      </div>
    )
  }

  if (!event) return <Empty title="Event not found" />

  const available = songs.filter((song) => !event.songIds.includes(song.id) && `${song.title} ${song.artist}`.toLowerCase().includes(query.toLowerCase()))
  const moveSong = (songId: string, direction: -1 | 1) => {
    const index = event.songIds.indexOf(songId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= event.songIds.length) return
    const next = [...event.songIds]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    onUpdate({ ...event, songIds: next })
  }

  return (
    <div className="page sunday-page">
      <button className="back-button" onClick={() => navigate('/events')}><ChevronLeft size={16} />Events</button>
      <header className="sunday-header">
        <div>
          <div className="eyebrow">Event song list</div>
          {isOwner ? <input className="event-title-input" value={name} onChange={(inputEvent) => setName(inputEvent.target.value)} aria-label="Event name" /> : <h1>{event.name}</h1>}
          {isOwner ? <input className="sunday-date-input" type="date" value={date} onChange={(inputEvent) => setDate(inputEvent.target.value)} aria-label="Event date" /> : <p>{event.date}</p>}
        </div>
        <div className="sunday-header-actions">
          {event.songIds.length > 0 && <Link className="primary-button" to={`/events/${event.id}/flow/${event.songIds[0]}`}><ChevronRight size={16} />Event Flow</Link>}
          {isOwner && <button className="secondary-button" onClick={() => onUpdate({ ...event, name: name.trim() || event.name, date, description })}><Save size={16} />Save details</button>}
          {isOwner && <button className="danger-button" onClick={() => {
            if (window.confirm(`Delete “${event.name}”?`)) onDelete(event.id)
          }}><Trash2 size={15} />Delete event</button>}
        </div>
      </header>

      {isOwner && <label className="event-description-label">Description<textarea value={description} onChange={(inputEvent) => setDescription(inputEvent.target.value)} placeholder="Notes for this event." /></label>}

      <div className="sunday-layout">
        <main className="sunday-songs">
          <div className="section-heading"><div><span className="eyebrow">Songs</span><h2>{event.name}</h2></div></div>
          <div className="sunday-list">
            {event.songIds.map((songId, index) => {
              const song = songs.find((item) => item.id === songId)
              if (!song) return null
              return (
                <div className="sunday-song" key={song.id}>
                  <span className="song-order">{index + 1}</span>
                  <Link to={`/events/${event.id}/songs/${song.id}`} className="song-summary">
                    <strong>{song.title}</strong><small>{song.artist} · Starting chord {event.startingChordOverrides?.[song.id] ?? song.currentKey}</small>
                  </Link>
                  {isOwner && <div className="sunday-controls">
                    <button className="icon-button" onClick={() => moveSong(song.id, -1)} aria-label="Move earlier"><ChevronLeft size={15} /></button>
                    <button className="icon-button" onClick={() => moveSong(song.id, 1)} aria-label="Move later"><ChevronRight size={15} /></button>
                    <button className="icon-button" onClick={() => onUpdate({ ...event, songIds: event.songIds.filter((item) => item !== song.id) })} aria-label="Remove from event"><Trash2 size={15} /></button>
                  </div>}
                </div>
              )
            })}
            {!event.songIds.length && <div className="empty"><p>Add songs to start preparing this event.</p></div>}
          </div>
        </main>

        {isOwner && <aside className="add-sunday-panel">
          <div className="section-heading"><div><span className="eyebrow">Add to event</span><h2>Available songs</h2></div></div>
          <div className="search compact-search"><Search size={16} /><input value={query} onChange={(inputEvent) => setQuery(inputEvent.target.value)} placeholder="Search songs" /></div>
          <div className="available-list">
            {available.length ? available.map((song) => (
              <button key={song.id} className="available-song" onClick={() => onUpdate({ ...event, songIds: [...event.songIds, song.id] })}><strong>{song.title}</strong><small>{song.artist}</small></button>
            )) : <p className="muted-text">No songs match.</p>}
          </div>
        </aside>}
      </div>
    </div>
  )
}

export function EventSongPage({ songs, settings, events, isOwner, onSetStartingChord }: {
  songs: Song[]
  settings: Settings
  events: WorshipEvent[]
  isOwner: boolean
  onSetStartingChord: (eventId: string, songId: string, startingChord: string | null) => Promise<void>
}) {
  const { eventId, songId } = useParams()
  const event = events.find((item) => item.id === eventId)
  const currentIndex = event?.songIds.indexOf(songId ?? '') ?? -1
  if (!event || currentIndex < 0) return <Empty title="Event song not found" />

  const previousSong = event.songIds[currentIndex - 1]
  const nextSong = event.songIds[currentIndex + 1]
  return (
    <>
      <div className="page event-flow-bar">
        <Link className="secondary-button" to={`/events/${event.id}`}><ChevronLeft size={15} />Event</Link>
        <span><strong>Event Flow</strong><small>{currentIndex + 1} of {event.songIds.length}</small></span>
        <div>
          {previousSong && <Link className="icon-button" to={`/events/${event.id}/flow/${previousSong}`} aria-label="Previous song"><ChevronLeft size={16} /></Link>}
          {nextSong && <Link className="icon-button" to={`/events/${event.id}/flow/${nextSong}`} aria-label="Next song"><ChevronRight size={16} /></Link>}
        </div>
      </div>
      <SongPage songs={songs} settings={settings} isOwner={isOwner} contextType="event" events={events} onSetStartingChord={onSetStartingChord} />
    </>
  )
}

function SongRow({ song }: { song: Song }) {
  return (
    <Link className="song-row" to={`/songs/${song.id}`}>
      <span className="song-art">{song.title.slice(0, 1)}</span>
      <span className="song-meta">
        <strong>{song.title}</strong>
        <small>{song.artist}</small>
      </span>
      <span className="key-pill">{song.currentKey}</span>
      <ChevronRight size={17} />
    </Link>
  )
}

export function SongLibrary({ songs, onCreate, onUpdate, onDuplicate, onDelete, isOwner }: { songs: Song[]; onCreate: () => void; onUpdate: (song: Song) => void; onDuplicate: (song: Song) => void; onDelete: (song: Song) => void; isOwner: boolean }) {
  const [query, setQuery] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const filtered = songs.filter((song) => {
    const text = `${song.title} ${song.artist} ${song.currentKey} ${song.sections.flatMap((section) => sectionChordLines(section)).join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (!favoriteOnly || song.favorite)
  })

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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, artist, key, or chord" />
        </div>
        <button className={favoriteOnly ? 'filter-button selected' : 'filter-button'} onClick={() => setFavoriteOnly(!favoriteOnly)}>
          ★ Favorites
        </button>
      </div>

      <div className="v5-song-grid">
        {filtered.map((song) => (
          <article className="v5-song-card" key={song.id}>
            <Link to={`/songs/${song.id}`}>
              <span className="song-art large-art">{song.title.slice(0, 1)}</span>
              <div>
                <h2>{song.title}</h2>
                <p>{song.artist}</p>
                <div className="song-facts">
                  Key <b>{song.currentKey}</b> · Capo <b>{song.capo}</b>
                </div>
              </div>
            </Link>

            {isOwner && <div className="v5-card-actions">
              <button aria-label="Favorite" className={song.favorite ? 'star active' : 'star'} onClick={() => onUpdate({ ...song, favorite: !song.favorite })}>★</button>
              <Link className="text-button" to={`/songs/${song.id}/edit`}>Edit</Link>
              <button aria-label="Duplicate song" className="icon-button subtle" onClick={() => onDuplicate(song)}><Copy size={15} /></button>
              <button aria-label="Delete song" className="icon-button subtle" onClick={() => {
                if (window.confirm(`Delete “${song.title}”?`)) onDelete(song)
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

export function SongPage({ songs, settings, isOwner, contextType, setlists = [], events = [], onSetStartingChord }: {
  songs: Song[]
  settings: Settings
  isOwner: boolean
  contextType?: 'sunday' | 'event'
  setlists?: Setlist[]
  events?: WorshipEvent[]
  onSetStartingChord?: (contextId: string, songId: string, startingChord: string | null) => Promise<void>
}) {
  const { songId, sundayId, eventId } = useParams()
  const navigate = useNavigate()
  const song = songs.find((item) => item.id === songId)
  const contextId = contextType === 'sunday' ? sundayId : contextType === 'event' ? eventId : undefined
  const context = contextType === 'sunday' ? setlists.find((item) => item.id === contextId) : contextType === 'event' ? events.find((item) => item.id === contextId) : undefined
  const savedStartingChord = songId ? context?.startingChordOverrides?.[songId] : undefined
  const [guitar, setGuitar] = useState<1 | 2>(1)
  const [viewKey, setViewKey] = useState(song?.currentKey ?? song?.key ?? 'C')
  const [startingChordEditorOpen, setStartingChordEditorOpen] = useState(false)
  const [pendingStartingChord, setPendingStartingChord] = useState('')
  const [savingStartingChord, setSavingStartingChord] = useState(false)
  const [startingChordError, setStartingChordError] = useState('')

  useEffect(() => {
    const defaultKey = song?.currentKey ?? song?.key ?? 'C'
    setViewKey(savedStartingChord ?? defaultKey)
    setPendingStartingChord(savedStartingChord ?? '')
    setStartingChordError('')
  }, [song?.id, song?.currentKey, song?.key, savedStartingChord, contextType, contextId])

  if (!song) {
    return <Empty title="Song not found" />
  }
  if (contextType && !context) {
    return <Empty title={`${contextType === 'sunday' ? 'Sunday' : 'Event'} not found`} />
  }

  const interval = (keyIndex(viewKey) - keyIndex(song.key) + 12) % 12
  const shapeKey = capoShapeKey(viewKey, guitar === 1 ? song.capo : 5, settings.notation)
  const backPath = contextType === 'sunday' ? `/sunday/${contextId}` : contextType === 'event' ? `/events/${contextId}` : '/songs'
  const contextName = contextType === 'sunday' ? 'Sunday' : 'Event'

  const updateKey = (amount: number) => setViewKey((current) => shiftKey(current, amount))
  const saveStartingChord = async () => {
    if (!contextId || !onSetStartingChord) return
    setSavingStartingChord(true)
    setStartingChordError('')
    try {
      await onSetStartingChord(contextId, song.id, pendingStartingChord || null)
      setViewKey(pendingStartingChord || song.currentKey || song.key)
      setStartingChordEditorOpen(false)
    } catch (saveError) {
      setStartingChordError(saveError instanceof Error ? saveError.message : 'Unable to save the starting chord.')
    } finally {
      setSavingStartingChord(false)
    }
  }

  return (
    <div className="page continuous-page">
      <button className="back-button" onClick={() => navigate(backPath)}><ChevronLeft size={16} />{contextType ? context?.name : 'Songs'}</button>

      <header className="v5-song-header">
        <div>
          <div className="eyebrow">{contextType ? `${contextName} song` : 'Chord sheet'} · {song.artist}</div>
          <h1>{song.title}</h1>
          <div className="song-tags">
            <span>Key {viewKey}</span>
            <span>Capo {guitar === 1 ? song.capo : 5}</span>
            <span>Shapes {shapeKey}</span>
            {contextType && <span>Starting chord {savedStartingChord ?? song.currentKey}{savedStartingChord ? ' · Custom' : ' · Original'}</span>}
          </div>
        </div>
        <div className="song-header-actions">
          {isOwner && <Link className="secondary-button" to={`/songs/${song.id}/edit`}>Edit</Link>}
          {contextType && isOwner && <button className="primary-button" onClick={() => {
            setPendingStartingChord(savedStartingChord ?? '')
            setStartingChordError('')
            setStartingChordEditorOpen(true)
          }}>Set Starting Chord</button>}
        </div>
      </header>

      {contextType && startingChordEditorOpen && (
        <section className="starting-chord-editor" aria-label="Set Starting Chord">
          <div>
            <strong>Set Starting Chord</strong>
            <p>Current: {savedStartingChord ?? song.currentKey}{savedStartingChord ? ' (custom)' : ' (song default)'}</p>
          </div>
          <label>
            Starting chord
            <select value={pendingStartingChord} onChange={(event) => setPendingStartingChord(event.target.value)}>
              <option value="">Original ({song.currentKey})</option>
              {chromatic.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </label>
          {startingChordError && <p className="starting-chord-error" role="alert">{startingChordError}</p>}
          <div className="starting-chord-actions">
            <button className="secondary-button" onClick={() => setStartingChordEditorOpen(false)} disabled={savingStartingChord}>Cancel</button>
            <button className="primary-button" onClick={() => void saveStartingChord()} disabled={savingStartingChord}>{savingStartingChord ? 'Saving…' : 'Save'}</button>
          </div>
        </section>
      )}

      <div className="song-key-bar">
        <strong>{viewKey}</strong>
        <small>Original {song.key}</small>
        <button onClick={() => updateKey(-1)}>−1</button>
        <button onClick={() => setViewKey(song.key)}>Original</button>
        <button onClick={() => updateKey(1)}>＋1</button>
        <select value={viewKey} onChange={(event) => setViewKey(event.target.value)} aria-label="Select key">
          {chromatic.map((key) => <option key={key}>{key}</option>)}
        </select>
        <div className="guitar-switch">
          <button className={guitar === 1 ? 'active' : ''} onClick={() => setGuitar(1)}>Guitar 1</button>
          <button className={guitar === 2 ? 'active' : ''} onClick={() => setGuitar(2)}>Guitar 2</button>
        </div>
      </div>

      <div className="continuous-sheet">
        {song.sections.map((section) => (
          <section className="continuous-section" key={section.id}>
            <div className="continuous-label">{section.name.toUpperCase()}</div>
            {sectionChordLines(section).map((line, lineIndex) => (
              <div className="continuous-line" key={`${section.id}-${lineIndex}`}>
                {parseChordProgression(line).map((chord, chordIndex) => (
                  <span className="chord-text" key={`${chord}-${chordIndex}`}>
                    {displayChord(chord, interval, settings.notation, settings.simplify)}
                  </span>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
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

export function SongEditor({ songs, onSave, onDelete }: { songs: Song[]; onSave: (song: Song) => void | Promise<void>; onDelete: (song: Song) => void | Promise<void> }) {
  const { songId } = useParams()
  const navigate = useNavigate()
  const existing = songs.find((song) => song.id === songId)

  const [title, setTitle] = useState(existing?.title || '')
  const [artist, setArtist] = useState(existing?.artist || '')
  const [key, setKey] = useState(existing?.key || 'C')
  const [capo, setCapo] = useState(existing?.capo || 0)
  const [notes, setNotes] = useState(existing?.notes || '')
  const [image, setImage] = useState(existing?.chordImage)
  const [sections, setSections] = useState<Section[]>(existing?.sections?.length ? existing.sections : [{ id: id(), name: 'Verse 1', chordText: 'C G Am F\nC G C' }])

  const addSection = () => {
    setSections((current) => [...current, { id: id(), name: `Section ${current.length + 1}`, chordText: 'C G Am F' }])
  }

  const removeSection = (sectionId: string) => {
    setSections((current) => current.filter((section) => section.id !== sectionId))
  }

  const save = async () => {
    if (!title.trim()) {
      window.alert('Song title is required.')
      return
    }

    const normalizedSections = sections
      .filter((section) => section.name.trim() || section.chordText.trim())
      .map((section) => ({
        ...section,
        name: section.name.trim() || 'Section',
        chordText: section.chordText.trim(),
      }))

    const song: Song = {
      id: existing?.id || id(),
      title: title.trim(),
      artist: artist.trim() || 'Unknown artist',
      key,
      currentKey: existing?.currentKey || key,
      capo,
      bpm: existing?.bpm || 72,
      favorite: existing?.favorite || false,
      tags: existing?.tags || [],
      notes,
      sections: normalizedSections,
      chordImage: image,
      lastPlayed: existing?.lastPlayed,
    }

    await onSave(song)
    navigate(`/songs/${song.id}`)
  }

  const updateSection = (sectionId: string, field: 'name' | 'chordText', value: string) => {
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

  return (
    <div className="page editor-page">
      <button className="back-button" onClick={() => navigate('/songs')}><ChevronLeft size={16} />Songs</button>

      <header className="v5-page-header">
        <div>
          <div className="eyebrow">Song editor</div>
          <h1>{existing ? 'Edit song' : 'Add song'}</h1>
        </div>
        <button className="primary-button" onClick={save}><Save size={16} />Save song</button>
      </header>

      <div className="editor-form">
        <div className="form-row">
          <label>
            Song title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Amazing Grace" />
          </label>
          <label>
            Artist
            <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artist name" />
          </label>
        </div>

        <div className="form-row">
          <label>
            Key
            <select value={key} onChange={(event) => setKey(event.target.value)}>
              {chromatic.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Capo
            <select value={capo} onChange={(event) => setCapo(Number(event.target.value))}>
              {Array.from({ length: 13 }, (_, value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
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
                {sections.length > 1 && (
                  <button className="icon-button" aria-label="Remove section" onClick={() => removeSection(section.id)}><Trash2 size={15} /></button>
                )}
              </div>

              <textarea
                className="textarea-editor chord-textarea"
                value={section.chordText}
                onChange={(event) => updateSection(section.id, 'chordText', event.target.value)}
                placeholder={`C G Am F\nC G C`}
              />
              <small>Section {index + 1}</small>
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
            <button className="danger-button" onClick={() => {
              if (window.confirm(`Delete “${existing.title}”?`)) {
                onDelete(existing)
                navigate('/songs')
              }
            }}><Trash2 size={15} />Delete song</button>
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

        <div className="setting">
          <div>
            <h3>Chord size</h3>
            <p>Choose a comfortable reading size.</p>
          </div>
          <select value={settings.chordSize || 'large'} onChange={(event) => onSettings({ ...settings, chordSize: event.target.value as Settings['chordSize'] })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="xl">Extra large</option>
          </select>
        </div>

        <div className="setting">
          <div>
            <h3>Notation</h3>
            <p>Choose a preferred chord naming style.</p>
          </div>
          <select value={settings.notation} onChange={(event) => onSettings({ ...settings, notation: event.target.value as Notation })}>
            <option value="auto">Automatic</option>
            <option value="sharps">Sharps</option>
            <option value="flats">Flats</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export function SundayPageV5({ songs, setlists, onCreate, onUpdate, onDuplicate, isOwner }: { songs: Song[]; setlists: Setlist[]; onCreate: () => void; onUpdate: (setlist: Setlist) => void; onDuplicate: (setlist: Setlist) => void; isOwner: boolean }) {
  const { sundayId } = useParams()
  const navigate = useNavigate()
  const sunday = sundayId ? setlists.find((item) => item.id === sundayId) : setlists[0]
  const selectedIndex = sunday ? setlists.findIndex((item) => item.id === sunday.id) : -1
  const previous = setlists[selectedIndex + 1]
  const [query, setQuery] = useState('')

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

  const available = songs.filter((song) => !sunday.songIds.includes(song.id) && `${song.title} ${song.artist}`.toLowerCase().includes(query.toLowerCase()))

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
          <h1>Sunday</h1>
          {isOwner ? <input className="sunday-date-input" value={sunday.date} onChange={(event) => onUpdate({ ...sunday, date: event.target.value })} aria-label="Sunday date" /> : <p>{sunday.date}</p>}
        </div>
        <div className="sunday-header-actions">
          {setlists.length > 1 && <select className="schedule-select" value={sunday.id} onChange={(event) => navigate(`/sunday/${event.target.value}`)} aria-label="Select Sunday schedule">
            {setlists.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.date}</option>)}
          </select>}
          {isOwner && <button className="secondary-button" onClick={onCreate}><CalendarDays size={16} />New Sunday</button>}
          {isOwner && previous && <button className="secondary-button" onClick={() => onDuplicate(previous)}>Duplicate previous</button>}
        </div>
      </header>

      <div className="sunday-layout">
        <main className="sunday-songs">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Today's songs</span>
              <h2>{sunday.name}</h2>
            </div>
          </div>

          <div className="sunday-list">
            {sunday.songIds.map((songId, index) => {
              const song = songs.find((item) => item.id === songId)
              if (!song) return null
              return (
                <div className="sunday-song" key={song.id}>
                  <span className="song-order">{index + 1}</span>
                  <Link to={`/sunday/${sunday.id}/songs/${song.id}`} className="song-summary">
                    <strong>{song.title}</strong>
                    <small>{song.artist} · Starting chord {sunday.startingChordOverrides?.[song.id] ?? song.currentKey}</small>
                  </Link>
                  {isOwner && <div className="sunday-controls">
                    <button className="icon-button" onClick={() => moveSong(song.id, -1)} aria-label="Move earlier"><ChevronLeft size={15} /></button>
                    <button className="icon-button" onClick={() => moveSong(song.id, 1)} aria-label="Move later"><ChevronRight size={15} /></button>
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
                <small>{song.artist}</small>
              </button>
            )) : <p className="muted-text">No songs match.</p>}
          </div>
        </aside>}
      </div>
    </div>
  )
}
