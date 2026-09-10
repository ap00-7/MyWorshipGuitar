import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Image as ImageIcon, Moon, Plus, Save, Search, Sun, Trash2, Upload, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { capoShapeKey, formatSundayDate, formatSundayTitle, formatTransposedChordLine, guitar2ProgressionAtCapo, isIsoDate, isSundayIso, keyOptions, nextUnusedSundayIso, noteIndex, parseChordProgression, shiftKey, simplifyChord, suggestGuitar2Arrangement, suggestGuitar2Progression, toIsoDate, transposeChord, upcomingSundayIso, type Notation } from './music'
import type { Section, Settings, Setlist, Song } from './data'

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
}
const rootOptions = ['All', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const typeOptions = ['All', 'Major', 'Minor', '7', 'Maj7', 'm7', 'Sus2', 'Sus4', 'Add9', 'Dim', 'Aug', '6', '9', '11', '13', '5', 'Slash']

const hasCustomGuitar2 = (song: Song) => song.guitar2Customized || song.sections.some((section) => Boolean(section.guitar2ChordText?.trim()))

const guitar2TextForSection = (section: Section, notation: Notation, guitar1Capo = 0, guitar2Capo?: number) => {
  const custom = section.guitar2ChordText?.trim()
  return custom || (guitar2Capo === undefined ? suggestGuitar2Progression(section.chordText || '', notation, guitar1Capo) : guitar2ProgressionAtCapo(section.chordText || '', guitar1Capo, guitar2Capo, notation))
}

const songGuitar2Arrangement = (song: Pick<Song, 'sections' | 'capo'>, notation: Notation) => (
  suggestGuitar2Arrangement(song.sections.map((section) => section.chordText).join('\n'), song.capo, notation)
)

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
        <span className="dashboard-mark">WG</span>
      </header>

      <section className="home-sunday">
        <div>
          <span className="eyebrow">This Sunday</span>
          <h2>{sunday?.name || 'No Sunday set yet'}</h2>
          <p>{formattedDate || 'Open Sunday to prepare your set.'}</p>
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
              <button aria-label="Favorite" className={song.favorite ? 'star active' : 'star'} onClick={() => void Promise.resolve(onUpdate({ ...song, favorite: !song.favorite })).catch((error) => window.alert(error instanceof Error ? error.message : 'Unable to update song.'))}>★</button>
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

export function SongPage({ songs, settings, isOwner }: { songs: Song[]; settings: Settings; isOwner: boolean }) {
  const { songId } = useParams()
  const navigate = useNavigate()
  const song = songs.find((item) => item.id === songId)
  const [guitar, setGuitar] = useState<1 | 2>(1)
  const [viewKey1, setViewKey1] = useState(song?.key ?? 'C')
  const [viewKey2, setViewKey2] = useState(song?.key ?? 'C')

  useEffect(() => {
    if (!song?.key) return
    setViewKey1(song.key)
    setViewKey2(song.key)
  }, [song?.id, song?.key])

  if (!song) {
    return <Empty title="Song not found" />
  }

  const customGuitar2 = hasCustomGuitar2(song)
  const suggestion = songGuitar2Arrangement(song, settings.notation)
  const selectedCapo = guitar === 1 ? song.capo : (customGuitar2 ? song.guitar2Capo : suggestion.capo)
  const viewKey = guitar === 1 ? viewKey1 : viewKey2
  const setViewKey = guitar === 1 ? setViewKey1 : setViewKey2
  const interval = (noteIndex(viewKey) - noteIndex(song.key) + 12) % 12
  const shapeKey = capoShapeKey(viewKey, selectedCapo, settings.notation)
  const updateKey = (amount: number) => setViewKey((current) => shiftKey(current, amount, settings.notation))

  return (
    <div className="page continuous-page">
      <button className="back-button" onClick={() => navigate('/songs')}><ChevronLeft size={16} />Songs</button>

      <header className="v5-song-header">
        <div>
          <div className="eyebrow">Chord sheet · {song.artist}</div>
          <h1>{song.title}</h1>
          <div className="song-tags">
            <span>Concert Key {viewKey}</span>
            <span>{guitar === 2 ? `Guitar 2: ${shapeKey} shapes` : `Guitar 1: ${shapeKey} shapes`}</span>
            <span>Capo {selectedCapo}</span>
            {guitar === 2 && <span>{customGuitar2 ? 'Custom Guitar 2' : `Suggested · ${suggestion.family} shapes`}</span>}
          </div>
        </div>
        <div className="song-header-actions">
          {isOwner && <Link className="secondary-button" to={`/songs/${song.id}/edit`}>Edit</Link>}
          <button className="primary-button" onClick={() => document.documentElement.requestFullscreen?.()}>Fullscreen</button>
        </div>
      </header>

      <div className="song-key-bar">
        <strong>{shapeKey}</strong>
        <small>Concert key {viewKey} · Guitar {guitar}</small>
        <button onClick={() => updateKey(-1)}>−1</button>
        <button onClick={() => setViewKey(song.key)}>Original</button>
        <button onClick={() => updateKey(1)}>＋1</button>
        <select value={viewKey} onChange={(event) => setViewKey(event.target.value)} aria-label="Select key">
          {keyOptions.map((key) => <option key={key}>{key}</option>)}
        </select>
        <div className="guitar-switch">
          <button className={guitar === 1 ? 'active' : ''} onClick={() => setGuitar(1)}>Guitar 1</button>
          <button className={guitar === 2 ? 'active' : ''} onClick={() => setGuitar(2)}>Guitar 2</button>
        </div>
      </div>

      <div className="continuous-sheet">
          {song.sections.map((section) => {
            const lines = guitar === 2
              ? sectionChordLines({ ...section, chordText: guitar2TextForSection(section, settings.notation, song.capo, selectedCapo) })
              : sectionChordLines(section)
            return (
              <section className="continuous-section" key={section.id || section.name}>
                <div className="continuous-label">{section.name.toUpperCase()}{guitar === 2 && !section.guitar2ChordText?.trim() ? ` · suggested capo ${suggestion.capo}` : ''}</div>
                {lines.map((line, lineIndex) => (
                  <div className="continuous-line" key={`${section.id}-${lineIndex}`}>
                    <span className="chord-text">{formatTransposedChordLine(line, interval, settings.notation, settings.simplify)}</span>
                  </div>
                ))}
              </section>
            )
          })}
        </div>

      {song.chordImage?.dataUrl && (
        <div className="image-preview song-image">
          <img src={song.chordImage.dataUrl} alt={`${song.title} chord sheet`} />
        </div>
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
  const [artist, setArtist] = useState(existing?.artist || '')
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
    setArtist(existing.artist)
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

  const save = async () => {
    if (isSaving) return
    if (!title.trim()) {
      window.alert('Song title is required.')
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
      artist: artist.trim() || 'Unknown artist',
      key,
      currentKey: key,
      capo,
      guitar2Capo: guitar2Customized ? guitar2Capo : suggestGuitar2Arrangement(sections.map((section) => section.chordText).join('\n'), capo, 'auto').capo,
      guitar2Customized,
      bpm: existing?.bpm || 72,
      favorite: existing?.favorite || false,
      tags: existing?.tags || [],
      notes,
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
            Artist
            <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Artist name" />
          </label>
        </div>

        <div className="form-row">
          <label>
            Key
            <select value={key} onChange={(event) => setKey(event.target.value)}>
              {keyOptions.map((item) => <option key={item}>{item}</option>)}
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
    { name: 'Am', root: 'A', type: 'Minor', notes: ['A', 'C', 'E'], strings: [-1, 0, 1, 2, 2, 0], fingers: ['x', '0', '1', '2', '2', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'A7', root: 'A', type: '7', notes: ['A', 'C#', 'E', 'G'], strings: [-1, 0, 2, 0, 2, 0], fingers: ['x', '0', '2', '0', '2', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'B7', root: 'B', type: '7', notes: ['B', 'D#', 'F#', 'A'], strings: [-1, 2, 1, 2, 0, 2], fingers: ['x', '2', '1', '2', '0', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'C', root: 'C', type: 'Major', notes: ['C', 'E', 'G'], strings: [-1, 1, 0, 2, 3, 0], fingers: ['x', '1', '0', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'C7', root: 'C', type: '7', notes: ['C', 'E', 'G', 'Bb'], strings: [-1, 1, 3, 2, 3, 1], fingers: ['x', '1', '3', '2', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Cmaj7', root: 'C', type: 'Maj7', notes: ['C', 'E', 'G', 'B'], strings: [-1, 0, 0, 2, 0, 0], fingers: ['x', '0', '0', '2', '0', '0'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Cadd9', root: 'C', type: 'Add9', notes: ['C', 'E', 'G', 'D'], strings: [-1, 3, 0, 2, 3, 0], fingers: ['x', '3', '0', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Csus2', root: 'C', type: 'Sus2', notes: ['C', 'D', 'G'], strings: [-1, 3, 0, 0, 1, 1], fingers: ['x', '3', '0', '0', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Csus4', root: 'C', type: 'Sus4', notes: ['C', 'F', 'G'], strings: [-1, 1, 1, 2, 3, 1], fingers: ['x', '1', '1', '2', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'D', root: 'D', type: 'Major', notes: ['D', 'F#', 'A'], strings: [-1, -1, 0, 2, 3, 2], fingers: ['x', 'x', '0', '2', '3', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dm', root: 'D', type: 'Minor', notes: ['D', 'F', 'A'], strings: [-1, -1, 0, 2, 3, 1], fingers: ['x', 'x', '0', '2', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'D7', root: 'D', type: '7', notes: ['D', 'F#', 'A', 'C'], strings: [-1, -1, 0, 2, 1, 2], fingers: ['x', 'x', '0', '2', '1', '2'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dm7', root: 'D', type: 'm7', notes: ['D', 'F', 'A', 'C'], strings: [-1, -1, 0, 2, 1, 1], fingers: ['x', 'x', '0', '2', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dmaj7', root: 'D', type: 'Maj7', notes: ['D', 'F#', 'A', 'C#'], strings: [-1, -1, 0, 2, 2, 2], fingers: ['x', 'x', '0', '2', '2', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Dsus2', root: 'D', type: 'Sus2', notes: ['D', 'E', 'A'], strings: [-1, -1, 0, 2, 3, 0], fingers: ['x', 'x', '0', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dsus4', root: 'D', type: 'Sus4', notes: ['D', 'G', 'A'], strings: [-1, -1, 0, 3, 3, 1], fingers: ['x', 'x', '0', '3', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'E', root: 'E', type: 'Major', notes: ['E', 'G#', 'B'], strings: [0, 2, 2, 1, 0, 0], fingers: ['0', '2', '2', '1', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Em', root: 'E', type: 'Minor', notes: ['E', 'G', 'B'], strings: [0, 2, 2, 0, 0, 0], fingers: ['0', '2', '2', '0', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'E7', root: 'E', type: '7', notes: ['E', 'G#', 'B', 'D'], strings: [0, 2, 0, 1, 0, 0], fingers: ['0', '2', '0', '1', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Em7', root: 'E', type: 'm7', notes: ['E', 'G', 'B', 'D'], strings: [0, 2, 0, 0, 0, 0], fingers: ['0', '2', '0', '0', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Eadd9', root: 'E', type: 'Add9', notes: ['E', 'G#', 'B', 'F#'], strings: [0, 2, 2, 1, 0, 2], fingers: ['0', '2', '2', '1', '0', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Esus4', root: 'E', type: 'Sus4', notes: ['E', 'A', 'B'], strings: [0, 2, 2, 2, 0, 0], fingers: ['0', '2', '2', '2', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'F', root: 'F', type: 'Major', notes: ['F', 'A', 'C'], strings: [1, 1, 2, 3, 3, 1], fingers: ['1', '1', '2', '3', '3', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Fmaj7', root: 'F', type: 'Maj7', notes: ['F', 'A', 'C', 'E'], strings: [-1, 3, 2, 3, 2, 1], fingers: ['x', '3', '2', '3', '2', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Fadd9', root: 'F', type: 'Add9', notes: ['F', 'A', 'C', 'G'], strings: [1, 1, 3, 3, 1, 1], fingers: ['1', '1', '3', '3', '1', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'G', root: 'G', type: 'Major', notes: ['G', 'B', 'D'], strings: [3, 2, 0, 0, 0, 3], fingers: ['3', '2', '0', '0', '0', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'G7', root: 'G', type: '7', notes: ['G', 'B', 'D', 'F'], strings: [3, 2, 0, 0, 0, 1], fingers: ['3', '2', '0', '0', '0', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gmaj7', root: 'G', type: 'Maj7', notes: ['G', 'B', 'D', 'F#'], strings: [2, 2, 0, 0, 0, 2], fingers: ['2', '2', '0', '0', '0', '2'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Gsus2', root: 'G', type: 'Sus2', notes: ['G', 'A', 'D'], strings: [3, 0, 0, 0, 3, 3], fingers: ['3', '0', '0', '0', '3', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gsus4', root: 'G', type: 'Sus4', notes: ['G', 'C', 'D'], strings: [3, 3, 0, 0, 1, 1], fingers: ['3', '3', '0', '0', '1', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Am7', root: 'A', type: 'm7', notes: ['A', 'C', 'E', 'G'], strings: [-1, 0, 0, 2, 0, 0], fingers: ['x', '0', '0', '2', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Asus2', root: 'A', type: 'Sus2', notes: ['A', 'B', 'E'], strings: [-1, 0, 2, 2, 0, 0], fingers: ['x', '0', '2', '2', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Asus4', root: 'A', type: 'Sus4', notes: ['A', 'D', 'E'], strings: [-1, 0, 2, 3, 0, 0], fingers: ['x', '0', '2', '3', '0', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Dadd9', root: 'D', type: 'Add9', notes: ['D', 'F#', 'A', 'E'], strings: [-1, -1, 0, 2, 3, 0], fingers: ['x', 'x', '0', '2', '3', '0'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'Gadd9', root: 'G', type: 'Add9', notes: ['G', 'B', 'D', 'A'], strings: [3, 2, 0, 0, 3, 3], fingers: ['3', '2', '0', '0', '3', '3'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'F#', root: 'F#', type: 'Major', notes: ['F#', 'A#', 'C#'], strings: [2, 4, 4, 3, 2, 2], fingers: ['1', '3', '4', '2', '1', '1'], difficulty: 'Intermediate', baseFret: 2 },
    { name: 'F#m', root: 'F#', type: 'Minor', notes: ['F#', 'A', 'C#'], strings: [2, 4, 4, 2, 2, 2], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 2 },
    { name: 'C#m', root: 'C#', type: 'Minor', notes: ['C#', 'E', 'G#'], strings: [-1, 4, 6, 6, 5, 4], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 4 },
    { name: 'G#m', root: 'G#', type: 'Minor', notes: ['G#', 'B', 'D#'], strings: [4, 6, 6, 4, 4, 4], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 4 },
    { name: 'Bb', root: 'Bb', type: 'Major', notes: ['Bb', 'D', 'F'], strings: [1, 1, 3, 3, 3, 1], fingers: ['1', '1', '3', '3', '3', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Bbm', root: 'Bb', type: 'Minor', notes: ['Bb', 'Db', 'F'], strings: [1, 1, 3, 3, 2, 1], fingers: ['1', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Bm', root: 'B', type: 'Minor', notes: ['B', 'D', 'F#'], strings: [-1, 2, 4, 4, 3, 2], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 2 },
    { name: 'Cm', root: 'C', type: 'Minor', notes: ['C', 'Eb', 'G'], strings: [-1, 3, 5, 5, 4, 3], fingers: ['x', '1', '3', '4', '2', '1'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'Fm', root: 'F', type: 'Minor', notes: ['F', 'Ab', 'C'], strings: [1, 3, 3, 1, 1, 1], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 1 },
    { name: 'Gm', root: 'G', type: 'Minor', notes: ['G', 'Bb', 'D'], strings: [3, 5, 5, 3, 3, 3], fingers: ['1', '3', '4', '1', '1', '1'], difficulty: 'Intermediate', baseFret: 3 },
    { name: 'D/F#', root: 'D', type: 'Slash', notes: ['D', 'F#', 'A'], strings: [2, -1, 0, 2, 3, 2], fingers: ['2', 'x', '0', '1', '3', '1'], difficulty: 'Beginner', baseFret: 1 },
    { name: 'G/B', root: 'G', type: 'Slash', notes: ['G', 'B', 'D'], strings: [0, 2, 0, 0, 0, 3], fingers: ['0', '2', '0', '0', '0', '3'], difficulty: 'Beginner', baseFret: 1 },
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
  const rows = chord.strings.map((value, index) => ({
    label: ['Low E', 'A', 'D', 'G', 'B', 'High E'][index],
    value,
    finger: chord.fingers[index],
  }))

  return (
    <div className={compact ? 'diagram compact-diagram' : 'diagram'} aria-label={`${chord.name} guitar chord diagram`}>
      <div className="diagram-row diagram-header">
        <span>6</span>
        <span>5</span>
        <span>4</span>
        <span>3</span>
        <span>2</span>
        <span>1</span>
      </div>
      <div className="diagram-grid">
        {rows.map((row, index) => {
          const cell = row.value === -1 ? 'X' : row.value === 0 ? 'O' : '●'
          const className = row.value === -1 ? 'muted' : row.value === 0 ? 'open' : 'fretted'
          return (
            <div className="diagram-cell" key={`${row.label}-${index}`}>
              <span className="string-label">{row.label}</span>
              <span className={`cell ${className}`}>{cell}</span>
              {row.value > 0 && <span className="finger-number">{row.finger}</span>}
            </div>
          )
        })}
      </div>
      <div className="diagram-frets">
        {Array.from({ length: 5 }, (_, index) => <span key={index} className="fret-line" />)}
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
  const [selectedSundayId, setSelectedSundayId] = useState('')
  const [query, setQuery] = useState('')
  const upcoming = upcomingSundayIso()
  const defaultSunday = setlists.find((item) => item.date === upcoming) ?? setlists.find((item) => item.date >= upcoming) ?? setlists[0]
  const sunday = setlists.find((item) => item.id === selectedSundayId) ?? defaultSunday
  const previous = setlists.find((item) => item.id !== sunday?.id)

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
          <h1>{formatSundayTitle(sunday.date)}</h1>
          <select className="sunday-selector" value={sunday.id} onChange={(event) => setSelectedSundayId(event.target.value)} aria-label="Select Sunday schedule">
            {setlists.map((item) => <option key={item.id} value={item.id}>{formatSundayTitle(item.date)}</option>)}
          </select>
          {isOwner ? <input className="sunday-date-input" type="date" value={sunday.date} onChange={(event) => {
            const nextDate = toIsoDate(event.target.value)
            if (nextDate && isSundayIso(nextDate)) void onUpdate({ ...sunday, date: nextDate })
          }} aria-label="Sunday date" /> : <p>{formatSundayDate(sunday.date)}</p>}
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
                <h2>{formatSundayTitle(sunday.date)}</h2>
            </div>
          </div>

          <div className="sunday-list">
            {sunday.songIds.map((songId, index) => {
              const song = songs.find((item) => item.id === songId)
              if (!song) return null
              return (
                <div className="sunday-song" key={song.id}>
                  <span className="song-order">{index + 1}</span>
                  <Link to={`/songs/${song.id}`} className="song-summary">
                    <strong>{song.title}</strong>
                    <small>{song.artist}</small>
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
