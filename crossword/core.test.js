'use strict';
const assert = require('node:assert/strict');
const Core = require('./core.js');

const traditionalEntries = [
  { id: 'apple', clue: 'A crisp fruit', answer: 'APPLE' },
  { id: 'pear', clue: 'A bell-shaped fruit', answer: 'PEAR' },
  { id: 'grape', clue: 'A small fruit that grows in bunches', answer: 'GRAPE' },
  { id: 'plum', clue: 'A purple stone fruit', answer: 'PLUM' },
  { id: 'melon', clue: 'A large sweet fruit', answer: 'MELON' }
];

const columnEntries = [
  { id: 'cat', clue: 'A pet that purrs', answer: 'CAT' },
  { id: 'apple', clue: 'A crisp fruit', answer: 'APPLE' },
  { id: 'river', clue: 'Water flowing to the sea', answer: 'RIVER' },
  { id: 'pear', clue: 'A bell-shaped fruit', answer: 'PEAR' },
  { id: 'home', clue: 'Where someone lives', answer: 'HOME' }
];

function assertEveryAnswer(result, entries) {
  assert.deepEqual(new Set(result.placements.map(item => item.id)), new Set(entries.map(item => item.id)));
  for (const entry of entries) {
    const placement = result.placements.find(item => item.id === entry.id);
    assert.equal(placement.cells.map(cell => cell.letter).join(''), Core.lettersOnly(entry.answer));
    assert.equal(placement.clue, entry.clue);
  }
}

const traditional = Core.generateTraditional(traditionalEntries, 'LEAP', 1234);
assert.equal(traditional.ok, true, traditional.error);
assert.equal(Core.validateLayout(traditional), true);
assertEveryAnswer(traditional, traditionalEntries);
assert.equal(traditional.selections.map(item => item.letter).join(''), 'LEAP');
assert.ok(traditional.placements.some(item => item.direction === 'across'));
assert.ok(traditional.placements.some(item => item.direction === 'down'));

const regenerated = Core.generateTraditional(traditionalEntries, 'LEAP', 99153);
assert.equal(regenerated.ok, true, regenerated.error);
assert.equal(Core.validateLayout(regenerated), true);
assert.notDeepEqual(
  regenerated.placements.map(item => [item.id, item.row, item.col, item.direction]),
  traditional.placements.map(item => [item.id, item.row, item.col, item.direction])
);

const column = Core.generateSecretColumn(columnEntries, 'CARE', 44);
assert.equal(column.ok, true, column.error);
assert.equal(Core.validateLayout(column), true);
assertEveryAnswer(column, columnEntries);
assert.equal(new Set(column.selections.map(item => item.entryId)).size, 4);
assert.equal(new Set(column.selections.map(item => item.col)).size, 1);
assert.deepEqual(column.selections.map(item => item.row), [0, 1, 2, 3]);
assert.equal(column.selections.map(item => item.letter).join(''), 'CARE');

const alternatives = column.selections.map(item => ({ ...item }));
const alternativeForA = Core.occurrences(Core.prepareEntries(columnEntries), 'A').find(item => item.entryId === 'pear');
const pearIndex = alternatives.findIndex(item => item.entryId === 'pear');
if (alternativeForA && pearIndex !== 1) {
  const old = alternatives[1];
  alternatives[1] = { ...alternativeForA, letter: 'A' };
  const replacement = Core.occurrences(Core.prepareEntries(columnEntries), column.secret[pearIndex])
    .find(item => item.entryId === old.entryId);
  if (replacement) alternatives[pearIndex] = { ...replacement, letter: column.secret[pearIndex] };
}
if (Core.validateSelections(column, alternatives)) {
  const adjusted = Core.generateSecretColumn(columnEntries, 'CARE', 44, alternatives);
  assert.equal(adjusted.ok, true);
  assert.equal(Core.validateLayout(adjusted), true);
  assert.equal(adjusted.selections.map(item => item.letter).join(''), 'CARE');
}

const duplicateSelection = column.selections.map(item => ({ ...item }));
duplicateSelection[1] = { ...duplicateSelection[0], letter: 'A' };
assert.equal(Core.validateSelections(column, duplicateSelection), false);

const impossibleMissing = Core.generateSecretColumn(columnEntries, 'JAZZ', 2);
assert.equal(impossibleMissing.ok, false);
assert.match(impossibleMissing.error, /No answer contains:|not enough different answers/);
const insufficient = Core.generateSecretColumn(columnEntries.slice(0, 2), 'CARE', 2);
assert.equal(insufficient.ok, false);
assert.match(insufficient.error, /at least 4 different answers/);

const state = {
  projectId: 'project-test', title: 'Fruit puzzle', mode: 'traditional', secret: 'LEAP',
  entries: traditionalEntries, result: traditional, settings: { orientation: 'landscape', cellSize: 'large' }
};
const saved = Core.projectSnapshot(state);
const loaded = JSON.parse(JSON.stringify(saved));
assert.equal(Core.validateProject(loaded), true);
assert.deepEqual(loaded.result, saved.result);
assert.deepEqual(loaded.entries, traditionalEntries);
assert.deepEqual(loaded.settings, state.settings);
assert.equal(Core.validateProject({ format: 'wrong', version: 1, entries: [], settings: {} }), false);

console.log('Crossword core tests passed: traditional, secret-column, adjustment validation, impossible cases, and project round-trip.');
