const ENV = import.meta.env || {}
const BASE = (ENV.VITE_XCASPER_API_BASE || 'https://movieapi.xcasper.space').replace(/\/+$/, '')
const PROXY = (ENV.VITE_API_PROXY_BASE || '').replace(/\/+$/, '')

export function apiUrl(path, params = {}) {
  const url = new URL(`${BASE}${path.startsWith('/') ? path : `/${path}`}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function request(path, params = {}, signal) {
  const target = apiUrl(path, params)
  const url = PROXY ? `${PROXY}?url=${encodeURIComponent(target)}` : target
  let response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error(`Could not reach the API. Check your connection and the API's CORS policy. (${error.message})`)
  }
  const raw = await response.text()
  let data
  try { data = raw ? JSON.parse(raw) : {} } catch {
    throw new Error(`The API returned non-JSON data (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    const message = data?.message || data?.error || `API request failed (HTTP ${response.status})`
    throw new Error(message)
  }
  if (data?.success === false || data?.status === 'error') {
    throw new Error(data?.message || data?.error || 'The API reported an error.')
  }
  return data
}

function listFrom(data) {
  if (Array.isArray(data)) return data
  const candidates = [
    data?.data, data?.results, data?.items, data?.subjects, data?.list,
    data?.movies, data?.shows, data?.trending, data?.records, data?.episodes,
    data?.tracks, data?.matches, data?.channels, data?.books, data?.novels,
    data?.sections, data?.data?.items, data?.data?.results, data?.data?.subjects,
    data?.data?.movies, data?.data?.list, data?.data?.tracks, data?.data?.matches,
    data?.data?.episodes, data?.data?.books, data?.data?.novels, data?.data?.sections,
    data?.data?.data, data?.result?.items
  ]
  return candidates.find(Array.isArray) || []
}

export function normalizeTitle(item, source = 'xcasper') {
  const id = item?.subjectId ?? item?.subject_id ?? item?.contentId ?? item?.content_id ??
    item?.id ?? item?.movieId ?? item?.movie_id ?? item?.slug ?? item?.url
  const title = item?.title ?? item?.name ?? item?.subjectName ?? item?.subject_name ?? item?.originalTitle ?? 'Untitled'
  const poster = item?.poster ?? item?.posterUrl ?? item?.poster_url ?? item?.cover ??
    item?.coverUrl ?? item?.cover_url ?? item?.image ?? item?.thumbnail ?? item?.imageUrl ??
    item?.image_url ?? item?.pic ?? item?.picUrl ?? item?.thumb ?? item?.avatar ?? item?.artwork ??
    item?.albumCover ?? item?.album_cover ?? item?.logo ?? ''
  const backdrop = item?.backdrop ?? item?.backdropUrl ?? item?.backdrop_url ?? item?.banner ??
    item?.background ?? item?.landscape ?? item?.wideImage ?? item?.wide_image ?? item?.backgroundImage ?? poster
  return {
    ...item,
    id: id == null ? `${source}-${title}` : String(id),
    title: String(title),
    poster: safeImage(poster),
    backdrop: safeImage(backdrop),
    year: item?.year ?? item?.releaseYear ?? item?.release_year ?? '',
    rating: item?.rating ?? item?.imdbRating ?? item?.score ?? '',
    description: item?.description ?? item?.overview ?? item?.plot ?? '',
    genres: Array.isArray(item?.genres) ? item.genres.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean) : [],
    type: item?.type ?? item?.subjectType ?? item?.subject_type ?? 'movie',
    source,
  }
}

function safeImage(value) {
  if (typeof value !== 'string') return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return value.startsWith('//') ? `https:${value}` : value
  return ''
}

export function extractPlayableSources(payload) {
  const found = []
  const seen = new Set()
  const visited = new Set()
  const playableKey = /(url|src|stream|play|file|download|link|hls|m3u8|mp4)/i
  const qualityKey = /(quality|resolution|resolutions|label|format|definition)/i
  const urlPattern = /^https?:\/\//i

  function walk(node, context = {}, depth = 0) {
    if (node == null || depth > 9) return
    if (typeof node === 'string') {
      if (urlPattern.test(node) && (/\.(m3u8|mp4|m4v|webm)(?:[?#]|$)/i.test(node) || /(?:stream|play|download|cdn|video|media)/i.test(context.key || ''))) {
        const url = node.trim()
        if (!seen.has(url)) {
          seen.add(url)
          found.push({ url, label: context.label || context.quality || context.format || 'Auto', quality: context.quality || context.resolution || '', format: context.format || '', headers: context.headers || null })
        }
      }
      return
    }
    if (typeof node !== 'object') return
    if (visited.has(node)) return
    visited.add(node)

    const ownUrl = node.url ?? node.src ?? node.streamUrl ?? node.stream_url ?? node.playUrl ??
      node.play_url ?? node.downloadUrl ?? node.download_url ?? node.fileUrl ?? node.file_url ??
      node.m3u8 ?? node.mp4 ?? node.videoUrl ?? node.video_url
    const label = node.label ?? node.name ?? node.quality ?? node.resolution ?? node.resolutions ?? node.definition ?? node.format
    const quality = node.quality ?? node.resolution ?? node.resolutions ?? node.definition
    const format = node.format ?? node.type
    if (typeof ownUrl === 'string' && urlPattern.test(ownUrl)) {
      walk(ownUrl, { key: 'url', label: label ? String(label) : undefined, quality: quality ? String(quality) : undefined, format: format ? String(format) : undefined, headers: node.headers }, depth + 1)
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'headers' || key === 'requestHeaders') continue
      if (typeof value === 'string' && urlPattern.test(value) && !playableKey.test(key)) continue
      const next = {
        key,
        label: qualityKey.test(key) && typeof value === 'string' ? value : (label ? String(label) : undefined),
        quality: quality ? String(quality) : undefined,
        format: format ? String(format) : undefined,
        headers: node.headers || node.requestHeaders || null,
      }
      walk(value, next, depth + 1)
    }
  }
  walk(payload)
  return found.sort((a, b) => {
    const score = x => (/1080|fhd/i.test(`${x.quality} ${x.label}`) ? 3 : /720|hd/i.test(`${x.quality} ${x.label}`) ? 2 : /480|360|sd/i.test(`${x.quality} ${x.label}`) ? 1 : 0)
    return score(b) - score(a)
  })
}

export function getSubjectId(item) {
  return item?.subjectId ?? item?.subject_id ?? item?.contentId ?? item?.content_id ?? item?.id
}

export function getShowBoxId(item) {
  return item?.showboxId ?? item?.showbox_id ?? item?.movieId ?? item?.movie_id ?? item?.id
}

export async function searchAll(keyword, signal) {
  const q = keyword.trim()
  if (!q) return []
  const tasks = [
    request('/api/search', { keyword: q, page: 1, perPage: 24 }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'xcasper'))),
    request('/api/showbox/search', { keyword: q, type: 'movie' }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'showbox'))),
    request('/api/newtoxic/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'newtoxic'))),
    request('/api/movie/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'moviebox'))),
    request('/api/tv/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'moviebox'))),
    request('/api/dramabox/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'dramabox'))),
    request('/api/chinese-dramas/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'chinese-drama'))),
    request('/api/music/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'music'))),
    request('/api/newtoxic/search', { keyword: q }, signal)
      .then(data => listFrom(data).map(item => normalizeTitle(item, 'newtoxic'))),
  ]
  const settled = await Promise.allSettled(tasks)
  const results = settled.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const deduped = new Map()
  for (const item of results) {
    const key = `${item.source}:${item.id}`
    if (!deduped.has(key)) deduped.set(key, item)
  }
  if (!deduped.size) {
    const errors = settled.filter(r => r.status === 'rejected').map(r => r.reason?.message).filter(Boolean)
    throw new Error(errors[0] || 'No titles were returned by the connected sources.')
  }
  return [...deduped.values()]
}

export async function getHomeCatalog(signal) {
  // Keep each provider/category as its own row so one unavailable endpoint does not
  // prevent the rest of the entertainment hub from loading.
  const endpoints = [
    ['/api/home-trending', 'xcasper', 'Trending now'],
    ['/api/trending', 'xcasper', 'Popular on Cyber Flix'],
    ['/api/coming-soon', 'xcasper', 'Coming soon'],
    ['/api/popular-search/current', 'xcasper', 'Popular searches'],
    ['/api/ranking', 'xcasper', 'Top ranked'],
    ['/api/tv-series', 'xcasper', 'TV series'],
    ['/api/animated-series', 'xcasper', 'Animated series'],
    ['/api/kdrama', 'xcasper', 'K-dramas'],
    ['/api/movie/homepage', 'moviebox', 'MovieBox movies'],
    ['/api/tv/homepage', 'moviebox', 'MovieBox TV series'],
    ['/api/anime/homepage', 'moviebox', 'Anime'],
    ['/api/kids/homepage', 'moviebox', 'Kids & family'],
    ['/api/fightzone/homepage', 'moviebox', 'Fight Zone'],
    ['/api/midnight/homepage', 'moviebox', 'Midnight collection'],
    ['/api/showbox/movie', 'showbox', 'ShowBox movies'],
    ['/api/showbox/tv', 'showbox', 'ShowBox series'],
    ['/api/newtoxic/latest', 'newtoxic', 'NewToxic latest'],
    ['/api/newtoxic/featured', 'newtoxic', 'NewToxic featured'],
    ['/api/dramabox/homepage', 'dramabox', 'DramaBox short dramas'],
    ['/api/nunodrama/homepage', 'nunodrama', 'NunoDrama discoveries'],
    ['/api/shorttv/homepage', 'shorttv', 'ShortTV'],
    ['/api/chinese-dramas/trending', 'chinese-drama', 'Chinese dramas'],
    ['/api/education/homepage', 'education', 'Education'],
    ['/api/music/homepage', 'music', 'Music & playlists'],
    ['/api/live/schedule', 'live-sports', 'Live matches & schedule'],
    ['/api/live', 'live-sports', 'Live sports'],
    ['/api/sportz/homepage', 'sportz', 'Sportz: fixtures & highlights'],
    ['/api/novel/homepage', 'novel', 'NovelHub books'],
  ]
  const settled = await Promise.allSettled(endpoints.map(([path]) => request(path, {}, signal)))
  const sections = settled.map((result, index) => {
    const [path, source, title] = endpoints[index]
    if (result.status !== 'fulfilled') return { title, source, path, items: [], error: result.reason?.message }
    const items = listFrom(result.value).map(item => normalizeTitle({ ...item, category: item?.category ?? title }, source))
    return { title, source, path, items, error: items.length ? '' : 'Endpoint returned no recognizable items.' }
  }).filter(section => section.items.length)
  return sections
}

export async function resolvePlayback(item, signal) {
  const attempts = []
  const candidates = [...new Set([
    item?.subjectId, item?.subject_id, item?.contentId, item?.content_id,
    item?.showboxId, item?.showbox_id, item?.movieId, item?.movie_id,
    item?.id, item?.slug,
  ].filter(value => value !== undefined && value !== null && String(value).trim() !== '').map(String))]

  const tryRequest = async (label, path, params) => {
    try {
      const data = await request(path, params, signal)
      const streams = extractPlayableSources(data)
      attempts.push({ label, ok: true, streamCount: streams.length, message: streams.length ? '' : 'Response contained no recognizable direct stream URL.' })
      if (streams.length) return { streams, raw: data, sourceLabel: label, attempts }
      return null
    } catch (error) {
      if (error.name === 'AbortError') throw error
      attempts.push({ label, ok: false, message: error.message })
      return null
    }
  }

  if (item.source === 'music') {
    for (const path of ['/api/music/play', '/api/music/stream', '/api/music/audio']) {
      const result = await tryRequest(`Music ${path}`, path, { id: item.id, trackId: item.id, title: item.title })
      if (result) return result
    }
    return { streams: [], attempts }
  }
  if (item.source === 'live-sports' || item.source === 'sportz') {
    const paths = item.source === 'sportz' ? ['/api/sportz/stream', '/api/sportz/resource'] : ['/api/live/stream', '/api/live/resource']
    for (const path of paths) {
      const result = await tryRequest(`Live/sports ${path}`, path, { id: item.id, matchId: item.id, subjectId: item.id })
      if (result) return result
    }
    return { streams: [], attempts }
  }
  if (item.source === 'showbox') {
    const type = /tv|series|show/i.test(String(item.type)) ? 'tv' : 'movie'
    const seasons = type === 'tv' ? [{ season: item.season ?? 1, episode: item.episode ?? 1 }, { season: 1, episode: 1 }] : [{}]
    for (const id of candidates) {
      for (const se of seasons) {
        const result = await tryRequest(`ShowBox stream (id ${id})`, '/api/stream', { id, type, ...se })
        if (result) return result
      }
    }
  }

  if (item.source === 'newtoxic') {
    for (const id of candidates) {
      for (const [label, path] of [
        ['NewToxic detail', '/api/newtoxic/detail'],
        ['NewToxic files', '/api/newtoxic/files'],
        ['NewToxic resolve', '/api/newtoxic/resolve'],
      ]) {
        const result = await tryRequest(`${label} (${id})`, path, { id, slug: item.slug || (String(id) === String(item.slug) ? id : undefined) })
        if (result) return result
      }
    }
  }

  // The catalogue may expose subjectId and contentId separately. Try each identifier,
  // and include both commonly documented parameter spellings for API variants.
  const xcasperRoutes = [
    ['XCASPER play', '/api/play'],
    ['XCASPER BFF stream', '/api/bff/stream'],
    ['XCASPER play links', '/api/play-links'],
    ['XCASPER CDN stream', '/api/cdn/stream'],
    ['XCASPER download links', '/api/download-links'],
  ]
  for (const id of candidates) {
    for (const [label, path] of xcasperRoutes) {
      const params = { subjectId: id, subject_id: id, contentId: id, id }
      const result = await tryRequest(`${label} (${id})`, path, params)
      if (result) return result
    }
  }
  const error = new Error('No playable stream was found. This title may not have a playback resource, its provider ID may differ from the catalogue ID, or the provider may be temporarily unavailable.')
  error.attempts = attempts
  throw error
}

export async function getDetails(item, signal) {
  if (item.source === 'newtoxic') {
    return request('/api/newtoxic/detail', { id: getSubjectId(item), slug: item.slug }, signal)
  }
  if (item.source === 'music') {
    for (const path of ['/api/music/play', '/api/music/stream', '/api/music/audio']) {
      const result = await tryRequest(`Music ${path}`, path, { id: item.id, trackId: item.id, title: item.title })
      if (result) return result
    }
    return { streams: [], attempts }
  }
  if (item.source === 'live-sports' || item.source === 'sportz') {
    const paths = item.source === 'sportz' ? ['/api/sportz/stream', '/api/sportz/resource'] : ['/api/live/stream', '/api/live/resource']
    for (const path of paths) {
      const result = await tryRequest(`Live/sports ${path}`, path, { id: item.id, matchId: item.id, subjectId: item.id })
      if (result) return result
    }
    return { streams: [], attempts }
  }
  if (item.source === 'showbox') {
    return request('/api/showbox/streams', { id: getShowBoxId(item), type: /tv|series|show/i.test(String(item.type)) ? 'tv' : 'movie' }, signal)
  }
  const id = getSubjectId(item)
  return request('/api/search', { keyword: item.title, page: 1, perPage: 10 }, signal)
}
