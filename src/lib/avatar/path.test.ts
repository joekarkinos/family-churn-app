import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAvatarPath } from './path'

test('ścieżka ma prefiks userId i rozszerzenie .webp', () => {
  const p = buildAvatarPath('user-123')
  assert.ok(p.startsWith('user-123/'), 'prefiks = userId')
  assert.ok(p.endsWith('.webp'), 'rozszerzenie .webp')
})

test('kolejne wywołania dają różne ścieżki (losowy uuid)', () => {
  const a = buildAvatarPath('u')
  const b = buildAvatarPath('u')
  assert.notEqual(a, b)
})

test('segment po userId to niepusta nazwa pliku', () => {
  const p = buildAvatarPath('abc')
  const file = p.split('/')[1]
  assert.match(file, /^[0-9a-f-]{36}\.webp$/)
})
