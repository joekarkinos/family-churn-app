import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANCHOR_DATE,
  dutyIndexForDate,
  effectiveDutyChildId,
  buildDutyCalendar,
  addDaysStr,
  diffDaysStr,
} from './rotation'

const ROT = [
  { position: 0, child_id: 'sonia' },
  { position: 1, child_id: 'hania' },
  { position: 2, child_id: 'maria' },
]

test('kotwica ma indeks 0 (Sonia)', () => {
  assert.equal(dutyIndexForDate(ANCHOR_DATE), 0)
})

test('kolejne dni rotują 0,1,2,0', () => {
  assert.equal(dutyIndexForDate('2026-07-02'), 0)
  assert.equal(dutyIndexForDate('2026-07-03'), 1)
  assert.equal(dutyIndexForDate('2026-07-04'), 2)
  assert.equal(dutyIndexForDate('2026-07-05'), 0)
})

test('dzień przed kotwicą używa ujemnego modulo poprawnie', () => {
  // 2026-07-01 = dzień przed Sonią => pozycja 2 (Maria)
  assert.equal(dutyIndexForDate('2026-07-01'), 2)
})

test('effectiveDutyChildId mapuje indeks na dziecko', () => {
  assert.equal(effectiveDutyChildId('2026-07-03', ROT, []), 'hania')
  assert.equal(effectiveDutyChildId('2026-07-04', ROT, []), 'maria')
})

test('override wygrywa z rotacją', () => {
  const ov = [{ duty_date: '2026-07-03', child_id: 'maria' }]
  assert.equal(effectiveDutyChildId('2026-07-03', ROT, ov), 'maria')
})

test('buildDutyCalendar zwraca kolejne dni z uwzględnieniem override', () => {
  const ov = [{ duty_date: '2026-07-04', child_id: 'sonia' }]
  const cal = buildDutyCalendar('2026-07-03', 3, ROT, ov)
  assert.deepEqual(cal, [
    { duty_date: '2026-07-03', child_id: 'hania' },
    { duty_date: '2026-07-04', child_id: 'sonia' }, // override
    { duty_date: '2026-07-05', child_id: 'sonia' }, // rotacja
  ])
})

test('helpery dat', () => {
  assert.equal(addDaysStr('2026-07-03', 2), '2026-07-05')
  assert.equal(addDaysStr('2026-07-31', 1), '2026-08-01')
  assert.equal(diffDaysStr('2026-07-05', '2026-07-02'), 3)
})
