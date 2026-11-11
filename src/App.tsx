import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Guitar, Home, LogIn, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { defaultSettings, demoSongs, normalizeSong, type Setlist, type Settings, type Song, type WorshipEvent } from './data'
import { LocalRepository } from './repositories'
import { deleteEvent, deleteSharedSong, deleteSunday, loadSharedSnapshot, setEventSongStartingChord, setSundaySongStartingChord, upsertEvent, upsertSharedSong, upsertSunday } from './sharedRepository'
import { getUserRole, supabase, supabaseConfigured, type UserRole } from './supabaseClient'
import { EventPage, EventSongPage, HomePage, SettingsPageV5, SongEditor, SongLibrary, SongPage, SundayPageV5 } from './v5'

const id = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 9)
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
  const [events, setEvents] = useLocalState<WorshipEvent[]>('wg-events', [])
  const [settings, setSettings] = useLocalState<Settings>('wg-settings', defaultSettings)
  const [role, setRole] = useState<UserRole>('user')
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [dataLoading, setDataLoading] = useState(supabaseConfigured)
  const [error, setError] = useState('')
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
    const client = supabase
    if (!client) return
    let refreshSequence = 0
    let refreshTimer: number | undefined
    const refresh = async () => {
      const requestSequence = ++refreshSequence
      try {
        const snapshot = await loadSharedSnapshot()
        if (!active || requestSequence !== refreshSequence) return
        setSongs(snapshot.songs)
        setSetlists(snapshot.setlists)
        setEvents(snapshot.events)
      } catch (loadError) {
        if (active && requestSequence === refreshSequence) setError(loadError instanceof Error ? loadError.message : 'Unable to load shared content.')
      } finally {
        if (active && requestSequence === refreshSequence) setDataLoading(false)
      }
    }
    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => { void refresh() }, 300)
    }

    void refresh()
    const channel = client.channel('shared-content-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_sections' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sundays' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_songs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_songs' }, scheduleRefresh)
      .subscribe((status) => {
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) setError('Realtime updates are unavailable. Refresh to load the latest shared content.')
      })

    return () => {
      active = false
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
      void client.removeChannel(channel)
    }
  }, [setSongs, setSetlists, setEvents])

  const saveSong = async (song: Song) => {
    const normalized = normalizeSong(song)
    try {
      if (supabaseConfigured) await upsertSharedSong(normalized)
      setSongs((current) => current.some((item) => item.id === normalized.id) ? current.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...current])
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save song.')
    }
  }

  const duplicateSong = async (song: Song) => saveSong({ ...song, id: id(), title: `${song.title} (Copy)`, sections: song.sections.map((section) => ({ ...section, id: id() })) })

  const deleteSong = async (song: Song) => {
    try {
      if (supabaseConfigured) await deleteSharedSong(song.id)
      setSongs((current) => current.filter((item) => item.id !== song.id))
      setSetlists((current) => current.map((setlist) => {
        const startingChordOverrides = { ...setlist.startingChordOverrides }
        delete startingChordOverrides[song.id]
        return { ...setlist, songIds: setlist.songIds.filter((songId) => songId !== song.id), startingChordOverrides }
      }))
      setEvents((current) => current.map((event) => {
        const startingChordOverrides = { ...event.startingChordOverrides }
        delete startingChordOverrides[song.id]
        return { ...event, songIds: event.songIds.filter((songId) => songId !== song.id), startingChordOverrides }
      }))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete song.')
    }
  }

  const createSong = () => navigate('/songs/new')
  const createSetlist = async () => {
    const setlist: Setlist = { id: id(), name: `Sunday ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, date: new Date().toISOString().slice(0, 10), description: '', songIds: [] }
    await updateSetlist(setlist)
    navigate(`/sunday/${setlist.id}`)
  }
  const updateSetlist = async (setlist: Setlist) => {
    try {
      if (supabaseConfigured) await upsertSunday(setlist)
      setSetlists((current) => current.some((item) => item.id === setlist.id) ? current.map((item) => item.id === setlist.id ? setlist : item) : [setlist, ...current])
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update Sunday.')
    }
  }
  const updateSundayStartingChord = async (sundayId: string, songId: string, startingChord: string | null) => {
    try {
      if (supabaseConfigured) await setSundaySongStartingChord(sundayId, songId, startingChord)
      setSetlists((current) => current.map((item) => {
        if (item.id !== sundayId) return item
        const overrides = { ...item.startingChordOverrides }
        if (startingChord) overrides[songId] = startingChord
        else delete overrides[songId]
        return { ...item, startingChordOverrides: overrides }
      }))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to save Sunday starting chord.')
      throw updateError
    }
  }
  const createEvent = async () => {
    const event: WorshipEvent = { id: id(), name: 'New Event', date: new Date().toISOString().slice(0, 10), description: '', songIds: [] }
    try {
      if (supabaseConfigured) await upsertEvent(event)
      setEvents((current) => [event, ...current])
      navigate(`/events/${event.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create event.')
    }
  }
  const updateEvent = async (event: WorshipEvent) => {
    try {
      if (supabaseConfigured) await upsertEvent(event)
      setEvents((current) => current.map((item) => item.id === event.id ? event : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update event.')
    }
  }
  const removeEvent = async (eventId: string) => {
    try {
      if (supabaseConfigured) await deleteEvent(eventId)
      setEvents((current) => current.filter((event) => event.id !== eventId))
      navigate('/events')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete event.')
    }
  }
  const updateEventStartingChord = async (eventId: string, songId: string, startingChord: string | null) => {
    try {
      if (supabaseConfigured) await setEventSongStartingChord(eventId, songId, startingChord)
      setEvents((current) => current.map((item) => {
        if (item.id !== eventId) return item
        const overrides = { ...item.startingChordOverrides }
        if (startingChord) overrides[songId] = startingChord
        else delete overrides[songId]
        return { ...item, startingChordOverrides: overrides }
      }))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to save event starting chord.')
      throw updateError
    }
  }
  const duplicateSetlist = async (previous: Setlist) => updateSetlist({ ...previous, id: id(), name: `${previous.name} · Copy`, date: new Date().toISOString().slice(0, 10) })
  const signOut = async () => { await supabase?.auth.signOut(); setRole('user'); navigate('/') }

  if (authLoading || dataLoading) return <div className="page"><p>Loading shared worship content...</p></div>

  const publicNav = [{ to: '/', label: 'Home', icon: Home }, { to: '/songs', label: 'Songs', icon: BookOpen }, { to: '/sunday', label: 'Sunday', icon: CalendarDays }, { to: '/events', label: 'Events', icon: CalendarDays }, { to: '/settings', label: 'Settings', icon: SettingsIcon }]
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
          <Route path="/sunday/:sundayId" element={<SundayPageV5 songs={songs} setlists={setlists} onCreate={createSetlist} onUpdate={updateSetlist} onDuplicate={duplicateSetlist} isOwner={isOwner} />} />
          <Route path="/sunday/:sundayId/songs/:songId" element={<SongPage songs={songs} settings={settings} isOwner={isOwner} contextType="sunday" setlists={setlists} onSetStartingChord={updateSundayStartingChord} />} />
          <Route path="/events" element={<EventPage songs={songs} events={events} onCreate={createEvent} onUpdate={updateEvent} onDelete={removeEvent} isOwner={isOwner} />} />
          <Route path="/events/:eventId" element={<EventPage songs={songs} events={events} onCreate={createEvent} onUpdate={updateEvent} onDelete={removeEvent} isOwner={isOwner} />} />
          <Route path="/events/:eventId/songs/:songId" element={<SongPage songs={songs} settings={settings} isOwner={isOwner} contextType="event" events={events} onSetStartingChord={updateEventStartingChord} />} />
          <Route path="/events/:eventId/flow/:songId" element={<EventSongPage songs={songs} settings={settings} events={events} isOwner={isOwner} onSetStartingChord={updateEventStartingChord} />} />
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
