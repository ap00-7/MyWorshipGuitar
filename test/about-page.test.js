import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync('src/App.tsx', 'utf8')
const pages = readFileSync('src/v5.tsx', 'utf8')

test('Settings links to the About page immediately after Theme', () => {
  const themeIndex = pages.indexOf('<h3>Theme</h3>')
  const aboutIndex = pages.indexOf('<h3>About the app</h3>')

  assert.notEqual(themeIndex, -1)
  assert.ok(aboutIndex > themeIndex)
  assert.match(pages.slice(aboutIndex, aboutIndex + 400), /to="\/about"/)
  assert.match(app, /<Route path="\/about" element={<AboutPage \/>}/)
})

test('About page is read-only and documents the shipped app features', () => {
  const start = pages.indexOf('export function AboutPage()')
  const end = pages.indexOf('export function PrivateSessionPage', start)
  const aboutPage = pages.slice(start, end)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  assert.doesNotMatch(aboutPage, /isOwner|onSettings|onSave|<button|<input|<form|danger-button/)
  for (const feature of ['Songs Library', 'Chord Library', 'Sunday Schedule', 'Worship Flow', 'Events', 'Event Flow', 'Guitar 1', 'Guitar 2', 'Supabase', 'viewer']) {
    assert.ok(aboutPage.includes(feature), `About page should document ${feature}`)
  }
  assert.match(aboutPage, /to="\/settings">[\s\S]*?Back to Settings/)
})
