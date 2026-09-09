import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Guitar, Home, LogIn, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { defaultSettings, demoSongs, normalizeSong, type Setlist, type Settings, type Song } from './data'
import { LocalRepository } from './repositories'
import { deleteSharedSong, isUuid, loadSharedSnapshot, upsertSharedSong, upsertSunday } from './sharedRepository'
import { getUserRole, supabase, supabaseConfigured, type UserRole } from './supabaseClient'
import { ChordLibrary, HomePage, SettingsPageV5, SongEditor, SongLibrary, SongPage, SundayPageV5 } from './v5'

const seedSetlists: Setlist[] = [{ id: 'sunday', name: 'Sunday Morning', date: 'This Sunday', description: 'A simple set for gathered worship.', songIds: demoSongs.map((song) => song.id) }]

function useLocalState<T>(key: string, initial: T) {
  const [repository] = useState(() => new LocalRepository<T>(key, initial))
  const [value, setValue] = useState<T>(() => {
    const stored = repository.load() as T
    if (key === 'wg-songs' && Array.isArray(stored)) return stored.map(normalizeSong) as T
    if (key === 'wg-settings' && !localStorage.getItem(key)) return { ...(stored as object), theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' } as T
    return stored
  })
  useEffect(() => {
    if (!supabaseConfigured) repository.save(value)
  }, [repository, value])
  return [value, setValue] as const
}

export default function App() {
  const [songs, setSongs] = useLocalState<Song[]>('wg-songs', demoSongs)
  const [setlists, setSetlists] = useLocalState<Setlist[]>('wg-setlists', seedSetlists)
  const [settings, setSettings] = useLocalState<Settings>('wg-settings', defaultSettings)
  const [role, setRole] = useState<UserRole>('user')
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [dataLoading, setDataLoading] = useState(supabaseConfigured)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const isOwner = role === 'owner'

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  useEffect(() => {
    const client = supabase
    if (!client) {
      setAuthLoading(false)
      setDataLoading(false)
      return
    }

    let active = true
    const loadSession = async () => {
      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError) {
        if (active) setError(sessionError.message)
      } else if (active) {
        try {
          setRole(await getUserRole(data.session?.user.id))
        } catch (roleError) {
          setError(roleError instanceof Error ? roleError.message : 'Unable to load account role.')
        }
      }
      if (active) setAuthLoading(false)
    }
    void loadSession()

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      void getUserRole(session?.user.id).then((nextRole) => {
        if (active) setRole(nextRole)
      }).catch((roleError) => {
        if (active) setError(roleError instanceof Error ? roleError.message : 'Unable to load account role.')
      })
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return
    let active = true
    void loadSharedSnapshot().then((snapshot) => {
      if (!active) return
      setSongs(snapshot.songs)
      setSetlists(snapshot.setlists)
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load shared content.')
    }).finally(() => {
      if (active) setDataLoading(false)
    })
    return () => { active = false }
  }, [setSongs, setSetlists])

  const saveSong = async (song: Song) => {
    const normalized = normalizeSong(song)
    try {
      const saved = supabaseConfigured
        ? await upsertSharedSong(normalized)
        : {
            ...normalized,
            id: isUuid(normalized.id) ? normalized.id : crypto.randomUUID(),
            sections: normalized.sections.map((section) => ({ ...section, id: isUuid(section.id) ? section.id : crypto.randomUUID() })),
          }
      setSongs((current) => {
        const previousId = isUuid(normalized.id) ? normalized.id : saved.id
        const withoutPrevious = current.filter((item) => item.id !== previousId && item.id !== saved.id)
        return [saved, ...withoutPrevious]
      })
      setError('')
      return saved
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save song.'
      console.error('Unable to save song', { songId: normalized.id, title: normalized.title, error: saveError })
      setError(message)
      throw saveError instanceof Error ? saveError : new Error(message)
    }
  }

  const duplicateSong = async (song: Song) => saveSong({
    ...song,
    id: '',
    title: `${song.title} (Copy)`,
    sections: song.sections.map((section) => ({ ...section, id: '' })),
  })

  const deleteSong = async (song: Song) => {
    try {
      if (supabaseConfigured) await deleteSharedSong(song.id)
      setSongs((current) => current.filter((item) => item.id !== song.id))
      setSetlists((current) => current.map((setlist) => ({ ...setlist, songIds: setlist.songIds.filter((songId) => songId !== song.id) })))
      setError('')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete song.')
    }
  }

  const createSong = () => navigate('/songs/new')
  const updateSetlist = async (setlist: Setlist) => {
    try {
      const saved = supabaseConfigured
        ? await upsertSunday(setlist)
        : { ...setlist, id: isUuid(setlist.id) ? setlist.id : crypto.randomUUID() }
      setSetlists((current) => {
        const index = current.findIndex((item) => item.id === setlist.id || item.id === saved.id)
        if (index < 0) return [saved, ...current]
        const next = [...current]
        next[index] = saved
        return next
      })
      setError('')
      return saved
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update Sunday.')
    }
  }
  const createSetlist = async () => {
    await updateSetlist({ id: '', name: `Sunday ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, date: new Date().toISOString().slice(0, 10), description: '', songIds: [] })
  }
  const duplicateSetlist = async (previous: Setlist) => updateSetlist({ ...previous, id: '', name: `${previous.name} · Copy`, date: new Date().toISOString().slice(0, 10) })
  const signOut = async () => { await supabase?.auth.signOut(); setRole('user'); navigate('/') }

  const shouldShowGlobalLoading = (authLoading || dataLoading) && location.pathname !== '/owner'

  if (shouldShowGlobalLoading) return <div className="page"><p>Loading shared worship content...</p></div>

  const publicNav = [{ to: '/', label: 'Home', icon: Home }, { to: '/songs', label: 'Songs', icon: BookOpen }, { to: '/sunday', label: 'Sunday', icon: CalendarDays }, { to: '/chords', label: 'Chords', icon: Guitar }, { to: '/settings', label: 'Settings', icon: SettingsIcon }]
  return (
    <div className="app">
      <Sidebar items={publicNav} isOwner={isOwner} onSignOut={signOut} />
      <main className="main">
        {error && <div className="app-error" role="alert">{error}</div>}
        <Routes>
          <Route path="/" element={<HomePage songs={songs} setlists={setlists} onCreateSong={createSong} isOwner={isOwner} />} />
          <Route path="/songs" element={<SongLibrary songs={songs} onCreate={createSong} onUpdate={saveSong} onDuplicate={duplicateSong} onDelete={deleteSong} isOwner={isOwner} />} />
          <Route path="/songs/new" element={isOwner ? <SongEditor songs={songs} onSave={saveSong} onDelete={deleteSong} /> : <ReadOnlyPage />} />
          <Route path="/songs/:songId/edit" element={isOwner ? <SongEditor songs={songs} onSave={saveSong} onDelete={deleteSong} /> : <ReadOnlyPage />} />
          <Route path="/songs/:songId" element={<SongPage songs={songs} settings={settings} isOwner={isOwner} />} />
          <Route path="/sunday" element={<SundayPageV5 songs={songs} setlists={setlists} onCreate={createSetlist} onUpdate={updateSetlist} onDuplicate={duplicateSetlist} isOwner={isOwner} />} />
          <Route path="/chords" element={<ChordLibrary />} />
          <Route path="/settings" element={<SettingsPageV5 settings={settings} onSettings={setSettings} />} />
          <Route path="/owner" element={<OwnerLogin />} />
          <Route path="*" element={<HomePage songs={songs} setlists={setlists} onCreateSong={createSong} isOwner={isOwner} />} />
        </Routes>
      </main>
    </div>
  )
}

function OwnerLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) { setMessage('Supabase is not configured yet.'); return }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    else navigate('/')
  }
  return <div className="page auth-page"><div className="eyebrow">Owner access</div><h1>Sign in</h1><form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="primary-button" type="submit"><LogIn size={16} />Sign in</button>{message && <p role="alert">{message}</p>}</form></div>
}

function ReadOnlyPage() { return <div className="page"><h1>Owner access required</h1><p>This management screen is available only to the owner account.</p></div> }

function Sidebar({ items, isOwner, onSignOut }: { items: { to: string; label: string; icon: typeof Home }[]; isOwner: boolean; onSignOut: () => void }) {
  return <aside className="sidebar"><Link to="/" className="brand"><span className="brand-mark"><Guitar size={19} /></span><span>Worship<b>Guitar</b></span></Link><div className="eyebrow nav-label">Navigation</div><nav>{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}><Icon size={18} />{label}</NavLink>)}</nav><div className="sidebar-account">{isOwner ? <button className="text-button" onClick={onSignOut}><LogOut size={15} />Sign out</button> : <Link className="text-button" to="/owner"><LogIn size={15} />Owner sign in</Link>}</div></aside>
}
