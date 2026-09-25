import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Guitar, Home, LogIn, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { defaultSettings, demoSongs, normalizeSong, type PrivateSession, type Setlist, type Settings, type Song } from './data'
import { LocalRepository } from './repositories'
import { deletePrivateSession, deleteSharedSong, deleteSunday, isUuid, loadSharedSnapshot, upsertPrivateSession, upsertSharedSong, upsertSunday } from './sharedRepository'
import { getUserRole, supabase, supabaseConfigured, type UserRole } from './supabaseClient'
import { formatSundayTitle, isSundayIso, nextUnusedSundayIso, toIsoDate, upcomingSundayIso } from './music'
import { ChordLibrary, HomePage, PrivateSessionPage, SettingsPageV5, SongEditor, SongLibrary, SongPage, SundayPageV5 } from './v5'
import { BrandLogo } from './components/BrandLogo'

const seedSetlists: Setlist[] = [{ id: 'sunday', name: 'Sunday Morning', date: 'This Sunday', description: 'A simple set for gathered worship.', songIds: demoSongs.map((song) => song.id) }]

function scrollSection(pathname: string, search: string) {
  const context = new URLSearchParams(search).get('context')
  if (pathname.startsWith('/songs/') && (context === 'sunday' || context === 'private-session')) return context
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/songs')) return 'songs'
  if (pathname.startsWith('/sunday')) return 'sunday'
  if (pathname.startsWith('/private-session')) return 'private-session'
  if (pathname.startsWith('/chords')) return 'chords'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/owner')) return 'owner'
  return 'home'
}

function useLocalState<T>(key: string, initial: T, persist = true) {
  const [repository] = useState(() => new LocalRepository<T>(key, initial))
  const [value, setValue] = useState<T>(() => {
    if (!persist) return initial
    const stored = repository.load() as T
    if (key === 'wg-songs' && Array.isArray(stored)) return stored.map(normalizeSong) as T
    if (key === 'wg-settings' && !localStorage.getItem(key)) return { ...(stored as object), theme: 'dark' } as T
    return stored
  })
  useEffect(() => {
    if (persist) repository.save(value)
  }, [persist, repository, value])
  return [value, setValue] as const
}

export default function App() {
  const [songs, setSongs] = useLocalState<Song[]>('wg-songs', supabaseConfigured ? [] : demoSongs, !supabaseConfigured)
  const [setlists, setSetlists] = useLocalState<Setlist[]>('wg-setlists', supabaseConfigured ? [] : seedSetlists, !supabaseConfigured)
  const [privateSessions, setPrivateSessions] = useLocalState<PrivateSession[]>('wg-private-sessions', [], !supabaseConfigured)
  const [settings, setSettings] = useLocalState<Settings>('wg-settings', defaultSettings)
  const [role, setRole] = useState<UserRole>('user')
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [dataLoading, setDataLoading] = useState(supabaseConfigured)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement | null>(null)
  const scrollPositionsRef = useRef<Record<string, number>>({})
  const isOwner = role === 'owner'
  const currentScrollSection = scrollSection(location.pathname, location.search)

  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    const usesDocumentScroll = getComputedStyle(main).overflowY !== 'auto'
    const restoreScroll = scrollPositionsRef.current[currentScrollSection] ?? 0
    if (usesDocumentScroll) window.scrollTo(0, restoreScroll)
    else main.scrollTop = restoreScroll

    return () => {
      scrollPositionsRef.current[currentScrollSection] = usesDocumentScroll ? window.scrollY : main.scrollTop
    }
  }, [currentScrollSection])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.style.colorScheme = settings.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0b0b0a' : '#f4f1ea')
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
      setPrivateSessions(snapshot.privateSessions)
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load shared content.')
    }).finally(() => {
      if (active) setDataLoading(false)
    })
    return () => { active = false }
  }, [setSongs, setSetlists])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let active = true
    let hasConnected = false
    let refreshInFlight: Promise<void> | null = null
    let refreshQueued = false
    const refreshAfterRealtime = () => {
      if (refreshInFlight) {
        refreshQueued = true
        return refreshInFlight
      }
      refreshInFlight = refreshShared().then(() => undefined).catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh shared content.')
      }).finally(() => {
        refreshInFlight = null
        if (active && refreshQueued) {
          refreshQueued = false
          void refreshAfterRealtime()
        }
      })
      return refreshInFlight
    }
    const channel = client
      .channel('shared-data-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, refreshAfterRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_sections' }, refreshAfterRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sundays' }, refreshAfterRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_songs' }, refreshAfterRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_sessions' }, refreshAfterRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_session_songs' }, refreshAfterRealtime)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (hasConnected) void refreshAfterRealtime()
          hasConnected = true
        }
      })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [setSongs, setSetlists, setPrivateSessions])

  const refreshShared = async () => {
    const snapshot = await loadSharedSnapshot()
    setSongs(snapshot.songs)
    setSetlists(snapshot.setlists)
    setPrivateSessions(snapshot.privateSessions)
    return snapshot
  }

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

      if (supabaseConfigured) {
        const snapshot = await refreshShared()
        const confirmed = snapshot.songs.find((item) => item.id === saved.id)
        if (!confirmed) throw new Error('Song was saved but could not be loaded from the database.')
        if (confirmed.title !== normalized.title) throw new Error('The song title did not persist after save.')
        const savedChords = confirmed.sections[0]?.chordText.trim() ?? ''
        const expectedChords = normalized.sections[0]?.chordText.trim() ?? ''
        if (expectedChords && savedChords !== expectedChords) throw new Error('The song chords did not persist after save.')
        setError('')
        return confirmed
      }

      setSongs((current) => {
        const previousId = isUuid(normalized.id) ? normalized.id : saved.id
        const withoutPrevious = current.filter((item) => item.id !== previousId && item.id !== saved.id)
        return [saved, ...withoutPrevious].sort((left, right) => left.title.trim().localeCompare(right.title.trim(), undefined, { sensitivity: 'base' }))
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
      if (supabaseConfigured) {
        await deleteSharedSong(song.id)
        await refreshShared()
      } else {
        setSongs((current) => current.filter((item) => item.id !== song.id))
        setSetlists((current) => current.map((setlist) => ({ ...setlist, songIds: setlist.songIds.filter((songId) => songId !== song.id) })))
      }
      setError('')
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete song.'
      console.error('Unable to delete song', { songId: song.id, error: deleteError })
      setError(message)
      throw deleteError instanceof Error ? deleteError : new Error(message)
    }
  }

  const createSong = () => navigate('/songs/new')
  const updateSetlist = async (setlist: Setlist) => {
    try {
      const date = toIsoDate(setlist.date)
      if (!date || !isSundayIso(date)) throw new Error('Sunday schedules must use a valid Sunday date.')
      const saved = supabaseConfigured
        ? await upsertSunday({ ...setlist, date, name: formatSundayTitle(date) })
        : { ...setlist, date, name: formatSundayTitle(date), id: isUuid(setlist.id) ? setlist.id : crypto.randomUUID() }
      if (supabaseConfigured) {
        await refreshShared()
      } else {
        setSetlists((current) => {
          const index = current.findIndex((item) => item.id === setlist.id || item.id === saved.id)
          if (index < 0) return [saved, ...current]
          const next = [...current]
          next[index] = saved
          return next
        })
      }
      setError('')
      return saved
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update Sunday.'
      console.error('Unable to update Sunday', updateError)
      setError(message)
      throw updateError instanceof Error ? updateError : new Error(message)
    }
  }
  const createSetlist = async () => {
    const date = nextUnusedSundayIso(setlists.map((item) => item.date), upcomingSundayIso())
    await updateSetlist({ id: '', name: formatSundayTitle(date), date, description: '', songIds: [] })
  }
  const duplicateSetlist = async (previous: Setlist) => {
    const date = nextUnusedSundayIso(setlists.map((item) => item.date), upcomingSundayIso())
    return updateSetlist({ ...previous, id: '', name: formatSundayTitle(date), date })
  }
  const savePrivateSession = async (session: PrivateSession) => {
    const normalized = { ...session, name: session.name.trim() || 'Event' }
    const next = supabaseConfigured ? await upsertPrivateSession(normalized) : { ...normalized, id: normalized.id || crypto.randomUUID() }
    if (supabaseConfigured) {
      const snapshot = await refreshShared()
      const confirmed = snapshot.privateSessions.find((item) => item.id === next.id)
      if (!confirmed) throw new Error('Event was saved but could not be loaded from the database.')
      setError('')
      return confirmed
    }
    setPrivateSessions((current) => {
      const index = current.findIndex((item) => item.id === normalized.id || item.id === next.id)
      if (index < 0) return [...current, next]
      const updated = [...current]
      updated[index] = next
      return updated
    })
    return next
  }
  const signOut = async () => { await supabase?.auth.signOut(); setRole('user'); navigate('/') }

  const shouldShowGlobalLoading = (authLoading || dataLoading) && location.pathname !== '/owner'

  if (shouldShowGlobalLoading) return <div className="page"><p>Loading shared worship content...</p></div>

  const publicNav = [{ to: '/', label: 'Home', icon: Home }, { to: '/songs', label: 'Songs', icon: BookOpen }, { to: '/sunday', label: 'Sunday', icon: CalendarDays }, { to: '/private-session', label: 'Events', icon: CalendarDays }, { to: '/chords', label: 'Chords', icon: Guitar }, { to: '/settings', label: 'Settings', icon: SettingsIcon }]
  return (
    <div className="app">
      <Sidebar items={publicNav} isOwner={isOwner} onSignOut={signOut} />
      <main ref={mainRef} className="main">
        {error && <div className="app-error" role="alert">{error}</div>}
        <Routes>
          <Route path="/" element={<HomePage songs={songs} setlists={setlists} onCreateSong={createSong} isOwner={isOwner} />} />
          <Route path="/songs" element={<SongLibrary songs={songs} onCreate={createSong} onDuplicate={duplicateSong} onDelete={deleteSong} isOwner={isOwner} />} />
          <Route path="/songs/new" element={isOwner ? <SongEditor key="new-song" songs={songs} onSave={saveSong} onDelete={deleteSong} /> : <ReadOnlyPage />} />
          <Route path="/songs/:songId/edit" element={isOwner ? <SongEditor key={`${location.pathname}`} songs={songs} onSave={saveSong} onDelete={deleteSong} /> : <ReadOnlyPage />} />
          <Route path="/songs/:songId" element={<SongPage key={location.pathname + location.search} songs={songs} setlists={setlists} privateSessions={privateSessions} settings={settings} isOwner={isOwner} />} />
          <Route path="/sunday" element={<SundayPageV5 songs={songs} setlists={setlists} settings={settings} onCreate={createSetlist} onUpdate={updateSetlist} onDuplicate={duplicateSetlist} onDelete={async (setlistId) => { if (supabaseConfigured) { await deleteSunday(setlistId); await refreshShared() } else setSetlists((current) => current.filter((item) => item.id !== setlistId)); }} isOwner={isOwner} />} />
          <Route path="/private-session" element={<PrivateSessionPage songs={songs} sessions={privateSessions} isOwner={isOwner} onCreate={savePrivateSession} onUpdate={savePrivateSession} onDelete={async (sessionId) => { if (supabaseConfigured) { await deletePrivateSession(sessionId); await refreshShared() } else setPrivateSessions((current) => current.filter((item) => item.id !== sessionId)); }} />} />
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
  return <div className="page auth-page"><div className="auth-shell"><div className="eyebrow">Owner access</div><h1>Sign in</h1><p className="auth-subtitle">Manage songs, Sunday schedules, and Events.</p><form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="primary-button" type="submit"><LogIn size={16} />Sign in</button>{message && <p className="auth-error" role="alert">{message}</p>}</form></div></div>
}

function ReadOnlyPage() { return <div className="page"><h1>Owner access required</h1><p>This management screen is available only to the owner account.</p></div> }

function Sidebar({ items, isOwner, onSignOut }: { items: { to: string; label: string; icon: typeof Home }[]; isOwner: boolean; onSignOut: () => void }) {
  const location = useLocation()
  const context = new URLSearchParams(location.search).get('context')
  const contextualRoute = context === 'private-session' ? '/private-session' : context === 'sunday' ? '/sunday' : '/songs'
  const contextualSong = location.pathname.startsWith('/songs/')
  return <aside className="sidebar"><Link to="/" className="brand"><BrandLogo variant="full" size={36} /></Link><div className="eyebrow nav-label">Navigation</div><nav aria-label="Primary navigation">{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => ((contextualSong ? to === contextualRoute : isActive) ? 'nav-item active' : 'nav-item')} aria-label={label}><Icon size={18} />{label}</NavLink>)}</nav><div className="sidebar-account">{isOwner ? <button className="text-button" aria-label="Sign out" onClick={onSignOut}><LogOut size={15} />Sign out</button> : <Link className="text-button" to="/owner" aria-label="Owner sign in"><LogIn size={15} />Owner sign in</Link>}</div></aside>
}
