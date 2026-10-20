import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Play, Clapperboard, Flame, Tv, Film, X, ChevronRight, LoaderCircle, AlertCircle, ArrowUpRight, Sparkles } from 'lucide-react'

const API = 'https://movieapi.xcasper.space'
const FALLBACK = 'https://placehold.co/500x750/151a25/e8edf5?text=No+Poster'

function extractList(data) {
  if (Array.isArray(data)) return data
  for (const key of ['data', 'results', 'items', 'list', 'subjects', 'movies', 'shows', 'records']) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  for (const key of ['data', 'result', 'response']) {
    if (data?.[key] && typeof data[key] === 'object') {
      const nested = extractList(data[key])
      if (nested.length) return nested
    }
  }
  return []
}
function titleOf(item) {
  return item?.title || item?.name || item?.subjectName || item?.movieName || item?.originalTitle || 'Untitled'
}
function idOf(item) {
  return item?.id ?? item?.subjectId ?? item?.movieId ?? item?.contentId ?? item?.vodId ?? item?.url ?? titleOf(item)
}
function posterOf(item) {
  return item?.cover?.url || item?.cover || item?.poster || item?.posterUrl || item?.image || item?.thumbnail || item?.img || item?.verticalImage || item?.coverUrl || FALLBACK
}
function yearOf(item) {
  const value = item?.year || item?.releaseYear || item?.releaseDate || item?.releaseTime
  return value ? String(value).slice(0, 4) : ''
}
function ratingOf(item) {
  const value = item?.imdbRating ?? item?.rating ?? item?.score ?? item?.average
  return value !== undefined && value !== null && value !== '' ? String(value) : ''
}
function typeOf(item) {
  const t = String(item?.type || item?.subjectTypeName || item?.category || '').toLowerCase()
  return t.includes('tv') || t.includes('series') ? 'TV Series' : 'Movie'
}
async function request(path) {
  const response = await fetch(`${API}${path}`)
  if (!response.ok) throw new Error(`API returned ${response.status}`)
  return response.json()
}

function MovieCard({ item, onClick }) {
  const title = titleOf(item)
  const rating = ratingOf(item)
  return <button className="movie-card" onClick={() => onClick(item)} aria-label={`View ${title}`}>
    <div className="poster-wrap">
      <img src={posterOf(item)} alt="" loading="lazy" onError={e => { e.currentTarget.src = FALLBACK }} />
      <div className="poster-overlay"><span className="play-circle"><Play size={19} fill="currentColor" /></span><span>View details</span></div>
      {rating && <span className="rating">★ {rating}</span>}
    </div>
    <div className="card-meta"><strong title={title}>{title}</strong><span>{yearOf(item) || typeOf(item)}</span></div>
  </button>
}

export default function App() {
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [category, setCategory] = useState('trending')
  const [kind, setKind] = useState('all')
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [stream, setStream] = useState(null)
  const [streamBusy, setStreamBusy] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [detail, setDetail] = useState(null)

  const load = useCallback(async (section, search, contentType, pageNum = 1) => {
    setBusy(true); setError(''); setItems([])
    try {
      let data
      if (search.trim()) {
        const subjectType = contentType === 'movie' ? 1 : contentType === 'tv' ? 2 : 0
        data = await request(`/api/search?keyword=${encodeURIComponent(search.trim())}&page=${pageNum}&perPage=24&subjectType=${subjectType}`)
      } else if (section === 'trending') {
        data = await request('/api/trending')
      } else if (section === 'popular') {
        data = await request('/api/hot')
      } else {
        data = await request(`/api/search?keyword=${encodeURIComponent(section === 'tv' ? 'popular TV series' : 'popular movies')}&page=${pageNum}&perPage=24&subjectType=${section === 'tv' ? 2 : 1}`)
      }
      const list = extractList(data)
      setItems(list)
      if (!list.length) setError('The API responded, but no results were found in its expected response fields. Try searching for a specific title.')
    } catch (e) {
      setError(`Could not load content. ${e.message}. Check the XCASPER API or try again shortly.`)
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { load(category, activeQuery, kind, page) }, [category, activeQuery, kind, page, load])

  const shown = useMemo(() => {
    if (kind === 'all' || activeQuery) return items
    return items.filter(item => kind === 'movie' ? typeOf(item) === 'Movie' : typeOf(item) === 'TV Series')
  }, [items, kind, activeQuery])

  function searchSubmit(e) {
    e.preventDefault()
    setCategory('search'); setPage(1); setActiveQuery(query.trim())
  }
  function changeCategory(value) {
    setCategory(value); setActiveQuery(''); setQuery(''); setPage(1)
  }
  async function openItem(item) {
    setSelected(item); setDetail(null); setStream(null); setStreamError('')
    const id = idOf(item)
    try {
      const data = await request(`/api/rich-detail?id=${encodeURIComponent(id)}&type=${typeOf(item) === 'TV Series' ? 'tv' : 'movie'}`)
      setDetail(data)
    } catch {
      try {
        const data = await request(`/api/detail?id=${encodeURIComponent(id)}&type=${typeOf(item) === 'TV Series' ? 'tv' : 'movie'}`)
        setDetail(data)
      } catch { setDetail(null) }
    }
  }
  async function findStream() {
    if (!selected) return
    setStreamBusy(true); setStreamError(''); setStream(null)
    try {
      const type = typeOf(selected) === 'TV Series' ? 'tv' : 'movie'
      const data = await request(`/api/stream?id=${encodeURIComponent(idOf(selected))}&type=${type}${type === 'tv' ? '&season=1&episode=1' : ''}`)
      setStream(data)
      if (!JSON.stringify(data).match(/https?:\/\/[^\\s"']+/i)) setStreamError('The API did not return an obvious direct URL. Check the response details below.')
    } catch (e) { setStreamError(`Could not retrieve playback information: ${e.message}`) }
    finally { setStreamBusy(false) }
  }
  const streamUrl = useMemo(() => {
    if (!stream) return ''
    const candidates = [stream.url, stream.streamUrl, stream.playUrl, stream.src, stream.data?.url, stream.data?.streamUrl, stream.data?.playUrl, stream.data?.url?.url, stream.result?.url, stream.result?.streamUrl]
    return candidates.find(v => typeof v === 'string' && /^https?:\/\//i.test(v)) || ''
  }, [stream])

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); changeCategory('trending') }}><span className="brand-icon"><Clapperboard size={23} /></span><span>CYBER<span className="brand-light"> FLIX</span><small>YOUR NEXT WATCH STARTS HERE</small></span></a>
      <nav className="desktop-nav">
        <button className={category === 'trending' ? 'nav-active' : ''} onClick={() => changeCategory('trending')}><Flame size={16}/> Trending</button>
        <button className={category === 'popular' ? 'nav-active' : ''} onClick={() => changeCategory('popular')}><Sparkles size={16}/> Popular</button>
        <button className={category === 'movies' ? 'nav-active' : ''} onClick={() => changeCategory('movies')}><Film size={16}/> Movies</button>
        <button className={category === 'tv' ? 'nav-active' : ''} onClick={() => changeCategory('tv')}><Tv size={16}/> TV Shows</button>
      </nav>
      <form className="searchbar" onSubmit={searchSubmit}><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search movies, shows..." aria-label="Search movies and shows"/>{query && <button type="button" className="clear-search" onClick={() => setQuery('')}><X size={15}/></button>}</form>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> DISCOVER • EXPLORE • WATCH</div><h1>Stories worth<br/><span>staying up for.</span></h1><p>Explore movies and series from around the world. Find your next favorite in just a few clicks.</p><button className="primary-btn" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>Explore library <ChevronRight size={18}/></button><div className="hero-foot"><span><Film size={15}/> Movies</span><span><Tv size={15}/> TV series</span><span><Search size={15}/> Fast discovery</span></div></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-card art-back"><div className="art-mountain"/></div><div className="art-card art-front"><div className="art-sun"/><div className="art-ridge ridge-one"/><div className="art-ridge ridge-two"/><div className="art-caption"><span>NOW SHOWING</span><b>YOUR NEXT<br/>FAVORITE</b></div></div><div className="floating-chip"><Sparkles size={15}/> Curated for discovery</div></div>
      </section>

      <section className="catalog" id="catalog">
        <div className="section-heading"><div><div className="eyebrow muted">{activeQuery ? 'SEARCH RESULTS' : 'THE COLLECTION'}</div><h2>{activeQuery ? `Results for “${activeQuery}”` : category === 'popular' ? 'Popular right now' : category === 'movies' ? 'Movies to explore' : category === 'tv' ? 'Series worth a binge' : 'Trending discoveries'}</h2><p>Find something good to watch next.</p></div><div className="filters"><button className={kind === 'all' ? 'filter-active' : ''} onClick={() => setKind('all')}>All</button><button className={kind === 'movie' ? 'filter-active' : ''} onClick={() => setKind('movie')}>Movies</button><button className={kind === 'tv' ? 'filter-active' : ''} onClick={() => setKind('tv')}>TV Series</button></div></div>
        {busy ? <div className="status"><LoaderCircle className="spin" size={28}/><span>Finding your next favorite…</span></div> : error ? <div className="error-state"><AlertCircle size={25}/><b>Unable to show titles</b><p>{error}</p><button className="secondary-btn" onClick={() => load(category, activeQuery, kind, page)}>Try again</button></div> : shown.length ? <div className="movie-grid">{shown.map((item, index) => <MovieCard key={`${idOf(item)}-${index}`} item={item} onClick={openItem}/>)}</div> : <div className="status">No titles to display.</div>}
        <div className="pagination"><button className="secondary-btn" disabled={page <= 1 || busy} onClick={() => { setPage(p => p - 1); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }}>Previous</button><span>Page {page}</span><button className="secondary-btn" disabled={busy || shown.length === 0} onClick={() => { setPage(p => p + 1); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }) }}>Next <ChevronRight size={15}/></button></div>
      </section>
    </main>
    <footer><a className="brand footer-brand" href="#" onClick={e => { e.preventDefault(); changeCategory('trending') }}><span className="brand-icon"><Clapperboard size={20}/></span><span>CYBER<span className="brand-light"> FLIX</span></span></a><p>Movie discovery powered by the XCASPER API. All content belongs to its respective rights holders.</p><a href="https://movieapi.xcasper.space/" target="_blank" rel="noreferrer">API information <ArrowUpRight size={14}/></a></footer>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)} role="presentation"><section className="detail-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${titleOf(selected)} details`}><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close details"><X size={20}/></button><img className="detail-poster" src={posterOf(selected)} alt="" onError={e => { e.currentTarget.src = FALLBACK }}/><div className="detail-content"><div className="eyebrow muted">{typeOf(selected).toUpperCase()} {yearOf(selected) ? ` • ${yearOf(selected)}` : ''}</div><h2>{titleOf(selected)}</h2>{ratingOf(selected) && <div className="detail-rating">★ {ratingOf(selected)}</div>}<p>{selected.description || selected.overview || selected.introduction || selected.summary || 'Explore this title and check available information from the movie catalog.'}</p><button className="primary-btn" onClick={findStream} disabled={streamBusy}>{streamBusy ? <LoaderCircle className="spin" size={17}/> : <Play size={17} fill="currentColor"/>} Find playback link</button>{streamError && <p className="stream-note">{streamError}</p>}{streamUrl && <a className="stream-link" href={streamUrl} target="_blank" rel="noreferrer"><Play size={16}/> Open returned video link <ArrowUpRight size={15}/></a>}{stream && <details className="api-response"><summary>View API response</summary><pre>{JSON.stringify(stream, null, 2)}</pre></details>}{detail && <details className="api-response"><summary>More catalog details</summary><pre>{JSON.stringify(detail, null, 2)}</pre></details>}<p className="legal-note">Playback availability depends on the API response and the rights associated with the media.</p></div></section></div>}
  </div>
}