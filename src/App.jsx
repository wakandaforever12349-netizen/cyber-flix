import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertCircle, ArrowLeft, ChevronDown, Clapperboard, Info, LoaderCircle, Play, Search, ShieldCheck, Sparkles, Tv, X } from 'lucide-react'
import Hls from 'hls.js'
import { getHomeCatalog, resolvePlayback, searchAll } from './lib/api.js'

const fallbackHero = {
  title: 'Stories worth staying in for.',
  description: 'Discover films, series and new favourites from connected entertainment catalogues.',
  backdrop: '',
}

function sourceName(source) {
  return ({ xcasper: 'XCASPER', showbox: 'ShowBox', newtoxic: 'NewToxic', moviebox: 'MOVIEBOX', dramabox: 'DRAMABOX', nunodrama: 'NUNODRAMA', shorttv: 'SHORTTV', 'chinese-drama': 'VIKI DRAMAS', education: 'LEARN', music: 'MUSIC', 'live-sports': 'LIVE SPORTS', sportz: 'SPORTZ', novel: 'NOVELHUB' })[source] || 'CATALOG'
}

function MediaCard({ item, onSelect }) {
  return (
    <button className="media-card" onClick={() => onSelect(item)} title={`Open ${item.title}`}>
      <div className="poster">
        {item.poster ? <img src={item.poster} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} /> : <div className="poster-placeholder"><Clapperboard size={30} /><span>{item.title}</span></div>}
        <span className="source-tag">{sourceName(item.source)}</span>
        <span className="card-play"><Play size={20} fill="currentColor" /></span>
      </div>
      <div className="card-meta">
        <strong>{item.title}</strong>
        <span>{[item.year, item.type].filter(Boolean).join(' · ')}</span>
      </div>
    </button>
  )
}

function PlayerModal({ item, onClose }) {
  const [loading, setLoading] = useState(true)
  const [streams, setStreams] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState([])
  const [showDebug, setShowDebug] = useState(false)
  const controller = useRef(null)
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  useEffect(() => {
    controller.current = new AbortController()
    setLoading(true)
    resolvePlayback(item, controller.current.signal)
      .then(result => {
        setStreams(result.streams)
        setSelected(result.streams[0] || null)
        setAttempts(result.attempts || [])
        setError(result.streams.length ? '' : 'The API response did not include a playable video URL.')
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to resolve a stream.')
          setAttempts(err.attempts || [])
        }
      })
      .finally(() => setLoading(false))
    return () => controller.current?.abort()
  }, [item])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !selected?.url) return
    hlsRef.current?.destroy()
    hlsRef.current = null
    const isHls = /\.m3u8(?:[?#]|$)/i.test(selected.url) || /hls/i.test(`${selected.format} ${selected.label}`)
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsRef.current = hls
      hls.loadSource(selected.url)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError(`The HLS stream failed: ${data.details || data.type}. Try another quality or source.`)
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = selected.url
    } else {
      video.src = selected.url
    }
    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [selected])

  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="player-modal" role="dialog" aria-modal="true" aria-label={`Play ${item.title}`}>
        <header className="modal-header">
          <div><span className="eyebrow">NOW PLAYING · {sourceName(item.source)}</span><h2>{item.title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close player"><X /></button>
        </header>
        {loading ? <div className="player-state"><LoaderCircle className="spin" size={36} /><strong>Finding playable streams…</strong><p>Checking the selected source and its playback endpoints.</p></div> :
          streams.length && selected ? <div className="video-wrap">
            <video ref={videoRef} key={selected.url} controls autoPlay playsInline poster={item.backdrop || item.poster} onError={() => setError('This stream URL was returned by the API, but the browser could not play it. Try another quality or source.')}>
              Your browser cannot play this video format.
            </video>
            <div className="stream-controls">
              <label htmlFor="quality">Stream quality</label>
              <div className="select-wrap"><select id="quality" value={selected.url} onChange={e => setSelected(streams.find(s => s.url === e.target.value))}>
                {streams.map((s, i) => <option key={s.url} value={s.url}>{s.label || s.quality || `Stream ${i + 1}`}{s.format ? ` · ${s.format}` : ''}</option>)}
              </select><ChevronDown size={16} /></div>
            </div>
            {error && <p className="small-note playback-warning"><AlertCircle size={14} /> {error}</p>}<p className="small-note"><Info size={14} /> HLS playback is supported through hls.js where the browser allows it. A provider may still block expired, restricted, or cross-origin streams.</p>
          </div> :
          <div className="player-state error-state"><AlertCircle size={36} /><strong>Stream unavailable</strong><p>{error || 'No playable video URL was returned by the API.'}</p><button className="secondary-button" onClick={() => setShowDebug(v => !v)}>{showDebug ? 'Hide diagnostics' : 'Show diagnostics'}</button>
            {showDebug && <div className="diagnostics">{attempts.length ? attempts.map((a, i) => <div key={i}><b>{a.label}</b><span>{a.ok ? `${a.streamCount} playable URL(s) found` : a.message}</span></div>) : <p>No endpoint diagnostics were returned.</p>}</div>}
          </div>}
        <footer className="modal-footer"><span><ShieldCheck size={15} /> Playback links are read from the API response</span><button className="text-button" onClick={onClose}>Close player</button></footer>
      </section>
    </div>
  )
}

function DetailsModal({ item, onClose, onPlay }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className="details-modal" role="dialog" aria-modal="true">
      <button className="icon-button close-details" onClick={onClose} aria-label="Close details"><X /></button>
      <div className="details-backdrop" style={item.backdrop ? { backgroundImage: `linear-gradient(0deg,#111 2%,rgba(17,17,17,.2) 100%),url("${item.backdrop}")` } : {}}>
        <span className="source-tag">{sourceName(item.source)}</span>
        <div className="details-copy"><span className="eyebrow">CYBER FLIX ORIGINAL EXPERIENCE</span><h2>{item.title}</h2>
          <div className="detail-facts">{item.year && <span>{item.year}</span>}{item.rating && <span>★ {item.rating}</span>}{item.type && <span>{item.type}</span>}</div>
          <p>{item.description || 'A title from our connected catalogue. More information may be available from the provider.'}</p>
          <div className="hero-actions"><button className="primary-button" onClick={() => onPlay(item)}><Play size={17} fill="currentColor" /> Play</button><button className="secondary-button" onClick={onClose}><ArrowLeft size={17} /> Back to browse</button></div>
        </div>
      </div>
      {item.genres?.length > 0 && <div className="genre-line"><b>Genres:</b> {item.genres.join(', ')}</div>}
    </section>
  </div>
}

export default function App() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [playerItem, setPlayerItem] = useState(null)
  const [activeNav, setActiveNav] = useState('Home')
  const [status, setStatus] = useState('Connecting to catalogues…')
  const searchAbort = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    getHomeCatalog(controller.signal)
      .then(data => {
        setSections(data)
        setStatus(data.length ? `${data.length} catalogue sections loaded` : 'API reachable, but no catalogue items were returned')
        if (!data.length) setHomeError('The connected endpoints returned no recognised lists. Check the API schema or endpoint availability.')
      })
      .catch(error => { setHomeError(error.message); setStatus('Catalog connection failed') })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setSearchResults([]); setSearchError(''); setSearching(false); searchAbort.current?.abort(); return }
    const controller = new AbortController()
    searchAbort.current?.abort()
    searchAbort.current = controller
    setSearching(true)
    setSearchError('')
    const timeout = setTimeout(() => {
      searchAll(q, controller.signal)
        .then(setSearchResults)
        .catch(error => { if (error.name !== 'AbortError') { setSearchResults([]); setSearchError(error.message) } })
        .finally(() => { if (!controller.signal.aborted) setSearching(false) })
    }, 350)
    return () => { clearTimeout(timeout); controller.abort() }
  }, [query])

  const allItems = useMemo(() => {
    const map = new Map()
    sections.flatMap(s => s.items).forEach(item => {
      const key = `${item.source}:${item.id}`
      if (!map.has(key)) map.set(key, item)
    })
    return [...map.values()]
  }, [sections])
  const hero = allItems.find(item => item.backdrop || item.poster) || fallbackHero
  const matchesNav = item => {
    if (activeNav === 'Movies') return !/tv|series|show/i.test(String(item.type)) && !['music','live-sports','sportz','education','novel'].includes(item.source)
    if (activeNav === 'Series') return /tv|series|show|drama|anime/i.test(`${item.type} ${item.category} ${item.title}`)
    if (activeNav === 'Music') return item.source === 'music'
    if (activeNav === 'Live') return ['live-sports','sportz'].includes(item.source)
    if (activeNav === 'Learning') return item.source === 'education'
    if (activeNav === 'Short dramas') return ['dramabox','nunodrama','shorttv','chinese-drama'].includes(item.source)
    if (activeNav === 'Books') return item.source === 'novel'
    return true
  }
  const browseItems = allItems.filter(matchesNav)
  const openPlay = item => { setSelectedItem(null); setPlayerItem(item) }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setActiveNav('Home'); setQuery('') }}><span className="brand-mark"><Clapperboard size={21} /></span><span>CYBER<span className="brand-accent">FLIX</span></span></a>
      <nav className="main-nav">{['Home', 'Movies', 'Series', 'Short dramas', 'Music', 'Live', 'Learning', 'Books'].map(nav => <button key={nav} className={activeNav === nav ? 'active' : ''} onClick={() => { setActiveNav(nav); setQuery('') }}>{nav}</button>)}</nav>
      <div className="top-actions"><div className="search-box"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Titles, genres, people" aria-label="Search titles" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</div><span className="avatar">CF</span></div>
    </header>

    {!query.trim() && <section className="hero" style={hero.backdrop ? { backgroundImage: `linear-gradient(90deg,#09090b 0%,rgba(9,9,11,.76) 40%,rgba(9,9,11,.1) 100%),linear-gradient(0deg,#09090b 0%,transparent 55%),url("${hero.backdrop}")` } : {}}>
      <div className="hero-content"><div className="hero-kicker"><Sparkles size={15} /> YOUR NEXT OBSESSION STARTS HERE</div><h1>{hero.title || fallbackHero.title}</h1><p>{hero.description || fallbackHero.description}</p><div className="hero-actions"><button className="primary-button" onClick={() => hero.id ? setSelectedItem(hero) : document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}><Play size={18} fill="currentColor" /> Explore title</button><button className="secondary-button" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}><Info size={18} /> Browse catalogue</button></div><div className="hero-status"><span className={homeError ? 'status-dot bad' : 'status-dot'} />{status}</div></div>
      <div className="hero-ornament"><span>CF</span><div /></div>
    </section>}

    <main id="catalog" className="catalog">
      {query.trim() ? <section className="search-results"><div className="section-heading"><div><span className="eyebrow">SEARCH RESULTS</span><h2>Results for “{query}”</h2></div>{searching && <span className="loading-inline"><LoaderCircle size={16} className="spin" /> Searching sources</span>}</div>
        {searchError && <div className="notice"><AlertCircle size={18} /><span>{searchError}</span></div>}
        {!searching && !searchError && searchResults.length === 0 && <div className="empty-state"><Search size={28} /><h3>No results yet</h3><p>Try another title or spelling.</p></div>}
        <div className="media-grid">{searchResults.map(item => <MediaCard key={`${item.source}:${item.id}`} item={item} onSelect={setSelectedItem} />)}</div>
      </section> : <>
        {homeError && <div className="notice"><AlertCircle size={18} /><div><b>Catalogue notice</b><span>{homeError}</span></div></div>}
        {loading ? <div className="loading-panel"><LoaderCircle size={28} className="spin" /><span>Loading your entertainment universe…</span></div> :
          sections.length ? sections.map(section => {
            const items = section.items.filter(matchesNav)
            if (!items.length) return null
            return <section className="catalog-row" key={`${section.source}:${section.title}`}><div className="section-heading"><div><span className="eyebrow">{section.source.toUpperCase()} COLLECTION</span><h2>{section.title}</h2></div><span className="row-count">{items.length} titles</span></div><div className="media-grid">{items.slice(0, 12).map(item => <MediaCard key={`${item.source}:${item.id}`} item={item} onSelect={setSelectedItem} />)}</div></section>
          }) : <div className="empty-state"><Tv size={32} /><h3>Your catalogue is waiting</h3><p>Check API availability and response shapes. The interface is ready, but no catalogue items have been confirmed yet.</p><button className="secondary-button" onClick={() => location.reload()}>Retry connection</button></div>}
        {allItems.length > 0 && <section className="catalog-row"><div className="section-heading"><div><span className="eyebrow">YOUR DISCOVERY MIX</span><h2>Browse all</h2></div></div><div className="media-grid">{browseItems.slice(0, 12).map(item => <MediaCard key={`browse:${item.source}:${item.id}`} item={item} onSelect={setSelectedItem} />)}</div></section>}
      </>}
    </main>
    <footer className="site-footer"><a className="brand footer-brand" href="#"><span className="brand-mark"><Clapperboard size={18} /></span><span>CYBER<span className="brand-accent">FLIX</span></span></a><div className="footer-copy"><span>Movies · series · music · live sports · learning · books</span><span>Catalog and playback availability depend on connected providers.</span></div><div className="api-status"><Activity size={15} /> {status}</div></footer>
    {selectedItem && <DetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} onPlay={openPlay} />}
    {playerItem && <PlayerModal item={playerItem} onClose={() => setPlayerItem(null)} />}
  </div>
}