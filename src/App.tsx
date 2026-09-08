import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, Guitar, Home, Settings as SettingsIcon } from 'lucide-react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { defaultSettings, demoSongs, type Setlist, type Settings, type Song } from './data'
import { LocalRepository } from './repositories'
import { ChordLibrary, HomePage, SettingsPageV5, SongEditor, SongLibrary, SongPage, SundayPageV5 } from './v5'

const id = () => Math.random().toString(36).slice(2, 9)
const seedSetlists: Setlist[] = [
  {
    id: 'sunday',
    name: 'Sunday Morning',
    date: 'This Sunday',
    description: 'A simple set for gathered worship.',
    songIds: demoSongs.map((song) => song.id),
  },
]

function useLocalState<T>(key: string, initial: T) {
  const [repository] = useState(() => new LocalRepository<T>(key, initial))
  const [value, setValue] = useState<T>(() => { 
    const stored = repository.load()
    if (key === 'wg-settings' && !localStorage.getItem(key)) {
      return { ...(stored as object), theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' } as T
    }
    return stored
  })

  useEffect(() => repository.save(value), [repository, value])
  return [value, setValue] as const
}

export default function App() {
  const [songs, setSongs] = useLocalState<Song[]>('wg-songs', demoSongs)
  const [setlists, setSetlists] = useLocalState<Setlist[]>('wg-setlists', seedSetlists)
  const [settings, setSettings] = useLocalState<Settings>('wg-settings', defaultSettings)
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  const saveSong = (song: Song) => {
    setSongs((current) => {
      const exists = current.some((item) => item.id === song.id)
      return exists
        ? current.map((item) => (item.id === song.id ? song : item))
        : [song, ...current]
    })
  }

  const duplicateSong = (song: Song) => {
    const copy: Song = {
      ...song,
      id: id(),
      title: `${song.title} (Copy)`,
      sections: song.sections.map((section) => ({
        ...section,
        id: id(),
        chordText: section.chordText ?? '',
      })),
    }
    setSongs((current) => [copy, ...current])
  }

  const deleteSong = (song: Song) => {
    setSongs((current) => current.filter((item) => item.id !== song.id))
    setSetlists((current) =>
      current.map((setlist) => ({
        ...setlist,
        songIds: setlist.songIds.filter((songId) => songId !== song.id),
      })),
    )
  }

  const createSong = () => navigate('/songs/new')

  const createSetlist = () => {
    const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const name = `Sunday ${dateLabel}`
    setSetlists((current) => [{ id: id(), name, date: 'New Sunday', description: '', songIds: [] }, ...current])
  }

  const publicNav = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/songs', label: 'Songs', icon: BookOpen },
    { to: '/sunday', label: 'Sunday', icon: CalendarDays },
    { to: '/chords', label: 'Chords', icon: Guitar },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className="app">
      <Sidebar items={publicNav} />
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage songs={songs} setlists={setlists} onCreateSong={createSong} />} />
          <Route path="/songs" element={<SongLibrary songs={songs} onCreate={createSong} onUpdate={saveSong} onDuplicate={duplicateSong} onDelete={deleteSong} />} />
          <Route path="/songs/new" element={<SongEditor songs={songs} onSave={saveSong} onDelete={deleteSong} />} />
          <Route path="/songs/:songId/edit" element={<SongEditor songs={songs} onSave={saveSong} onDelete={deleteSong} />} />
          <Route path="/songs/:songId" element={<SongPage songs={songs} settings={settings} onUpdate={saveSong} />} />
          <Route path="/sunday" element={<SundayPageV5 songs={songs} setlists={setlists} onCreate={createSetlist} onUpdate={(setlist) => setSetlists((current) => current.map((item) => (item.id === setlist.id ? setlist : item)))} onDuplicate={(previous) => setSetlists((current) => [{ ...previous, id: id(), name: `${previous.name} · Copy`, date: 'New Sunday' }, ...current])} />} />
          <Route path="/chords" element={<ChordLibrary />} />
          <Route path="/settings" element={<SettingsPageV5 settings={settings} onSettings={setSettings} />} />
          <Route path="*" element={<HomePage songs={songs} setlists={setlists} onCreateSong={createSong} />} />
        </Routes>
      </main>
    </div>
  )
}

function Sidebar({ items }: { items: { to: string; label: string; icon: typeof Home }[] }) {
  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <span className="brand-mark"><Guitar size={19} /></span>
        <span>
          Worship
          <b>Guitar</b>
        </span>
      </Link>

      <div className="eyebrow nav-label">Navigation</div>
      <nav>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="profile-dot">WG</div>
        <div>
          <strong>Saved on this device</strong>
        </div>
      </div>
    </aside>
  )
}
