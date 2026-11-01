import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPlayableSources, normalizeTitle, getSubjectId } from './api.js'

test('normalizes common catalogue fields and identifiers', () => {
  const title = normalizeTitle({ contentId: 'abc123', title: 'Example Film', poster: 'https://img.test/poster.jpg', year: 2025 }, 'xcasper')
  assert.equal(title.id, 'abc123')
  assert.equal(title.title, 'Example Film')
  assert.equal(title.year, 2025)
  assert.equal(getSubjectId({ subjectId: 'subject-1' }), 'subject-1')
})

test('extracts direct MP4 and HLS URLs from nested stream responses', () => {
  const response = { data: { streams: [
    { format: 'MP4', resolution: '720p', url: 'https://cdn.example/video.mp4' },
    { format: 'HLS', quality: '1080p', playUrl: 'https://cdn.example/master.m3u8?token=abc' }
  ] } }
  const sources = extractPlayableSources(response)
  assert.equal(sources.length, 2)
  assert.ok(sources.some(s => s.url.includes('video.mp4')))
  assert.ok(sources.some(s => s.url.includes('master.m3u8')))
})

test('does not treat ordinary API metadata URLs as playable streams', () => {
  const response = { title: 'Example', poster: 'https://cdn.example/poster.jpg', detailPage: 'https://example.test/title/1' }
  assert.equal(extractPlayableSources(response).length, 0)
})
