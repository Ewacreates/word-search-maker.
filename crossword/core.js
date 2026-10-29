(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CrosswordCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const lettersOnly = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

  function prepareEntries(entries) {
    return entries.map((entry, index) => ({
      id: String(entry.id || `entry-${index + 1}`),
      clue: String(entry.clue || '').trim(),
      answer: String(entry.answer || '').trim(),
      word: lettersOnly(entry.answer)
    })).filter(entry => entry.clue && entry.word.length > 1);
  }

  function seededRandom(seed) {
    let value = (Number(seed) || 1) >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  const key = (row, col) => `${row},${col}`;

  function cellsFor(word, row, col, direction) {
    return Array.from(word, (letter, index) => ({
      row: row + (direction === 'down' ? index : 0),
      col: col + (direction === 'across' ? index : 0),
      letter,
      index
    }));
  }

  function canPlace(word, row, col, direction, grid, requireCrossing) {
    const cells = cellsFor(word, row, col, direction);
    let crossings = 0;
    const before = direction === 'across' ? key(row, col - 1) : key(row - 1, col);
    const after = direction === 'across' ? key(row, col + word.length) : key(row + word.length, col);
    if (grid.has(before) || grid.has(after)) return null;

    for (const cell of cells) {
      const existing = grid.get(key(cell.row, cell.col));
      if (existing && existing.letter !== cell.letter) return null;
      if (existing) {
        if (existing.directions.has(direction)) return null;
        crossings++;
      } else {
        const neighbours = direction === 'across'
          ? [key(cell.row - 1, cell.col), key(cell.row + 1, cell.col)]
          : [key(cell.row, cell.col - 1), key(cell.row, cell.col + 1)];
        if (neighbours.some(neighbour => grid.has(neighbour))) return null;
      }
    }
    if (requireCrossing && !crossings) return null;
    return { cells, crossings };
  }

  function addPlacement(entry, row, col, direction, grid) {
    const placement = { ...entry, row, col, direction, cells: cellsFor(entry.word, row, col, direction) };
    for (const cell of placement.cells) {
      const position = key(cell.row, cell.col);
      const current = grid.get(position) || { letter: cell.letter, directions: new Set(), entryIds: [] };
      current.directions.add(direction);
      current.entryIds.push(entry.id);
      grid.set(position, current);
    }
    return placement;
  }

  function removePlacement(placement, grid) {
    for (const cell of placement.cells) {
      const position = key(cell.row, cell.col);
      const current = grid.get(position);
      current.directions.delete(placement.direction);
      current.entryIds = current.entryIds.filter(id => id !== placement.id);
      if (!current.directions.size) grid.delete(position);
    }
  }

  function candidatesFor(entry, placements, grid, random) {
    const candidates = [];
    for (const placed of placements) {
      const direction = placed.direction === 'across' ? 'down' : 'across';
      for (let i = 0; i < entry.word.length; i++) {
        for (let j = 0; j < placed.word.length; j++) {
          if (entry.word[i] !== placed.word[j]) continue;
          const row = placed.row + (placed.direction === 'down' ? j : 0) - (direction === 'down' ? i : 0);
          const col = placed.col + (placed.direction === 'across' ? j : 0) - (direction === 'across' ? i : 0);
          const valid = canPlace(entry.word, row, col, direction, grid, true);
          if (valid) candidates.push({ row, col, direction, crossings: valid.crossings, jitter: random() });
        }
      }
    }
    return candidates.sort((a, b) => b.crossings - a.crossings || a.jitter - b.jitter);
  }

  function boundsOf(placements) {
    const cells = placements.flatMap(placement => placement.cells);
    const rows = cells.map(cell => cell.row), cols = cells.map(cell => cell.col);
    return {
      minRow: Math.min(...rows), maxRow: Math.max(...rows),
      minCol: Math.min(...cols), maxCol: Math.max(...cols)
    };
  }

  function normalizePlacements(placements) {
    const bounds = boundsOf(placements);
    return placements.map(placement => ({
      ...placement,
      row: placement.row - bounds.minRow,
      col: placement.col - bounds.minCol,
      cells: placement.cells.map(cell => ({ ...cell, row: cell.row - bounds.minRow, col: cell.col - bounds.minCol }))
    }));
  }

  function scoreLayout(placements) {
    const bounds = boundsOf(placements);
    const width = bounds.maxCol - bounds.minCol + 1;
    const height = bounds.maxRow - bounds.minRow + 1;
    const unique = new Set(placements.flatMap(p => p.cells.map(c => key(c.row, c.col)))).size;
    const total = placements.reduce((sum, p) => sum + p.word.length, 0);
    return width * height * 10 + Math.abs(width - height) * 2 - (total - unique) * 8;
  }

  function buildTraditional(entries, seed) {
    const random = seededRandom(seed);
    const sorted = [...entries].sort((a, b) => b.word.length - a.word.length || random() - .5);
    const grid = new Map(), placements = [];
    const first = sorted.shift();
    placements.push(addPlacement(first, 0, 0, random() < .5 ? 'across' : 'down', grid));

    function search(remaining) {
      if (!remaining.length) return true;
      let chosenIndex = -1, chosenCandidates = null;
      for (let index = 0; index < remaining.length; index++) {
        const candidates = candidatesFor(remaining[index], placements, grid, random);
        if (candidates.length && (!chosenCandidates || candidates.length < chosenCandidates.length)) {
          chosenIndex = index;
          chosenCandidates = candidates;
        }
      }
      if (chosenIndex < 0) return false;
      const entry = remaining[chosenIndex];
      const next = remaining.filter((_, index) => index !== chosenIndex);
      for (const candidate of chosenCandidates.slice(0, 40)) {
        const placement = addPlacement(entry, candidate.row, candidate.col, candidate.direction, grid);
        placements.push(placement);
        if (search(next)) return true;
        placements.pop();
        removePlacement(placement, grid);
      }
      return false;
    }
    return search(sorted) ? normalizePlacements(placements) : null;
  }

  function occurrences(entries, letter) {
    return entries.flatMap(entry => Array.from(entry.word, (value, charIndex) =>
      value === letter ? { entryId: entry.id, charIndex, letter } : null).filter(Boolean));
  }

  function selectSecret(entries, secret, requireDistinct, seed = 1) {
    const random = seededRandom(seed);
    const choices = Array.from(secret, letter => occurrences(entries, letter));
    if (choices.some(list => !list.length)) return null;
    let best = null;
    function search(index, selected, used) {
      if (index === choices.length) {
        const repeats = selected.length - used.size;
        if (!best || repeats < best.repeats) best = { repeats, selected: selected.map(item => ({ ...item })) };
        return;
      }
      const ordered = choices[index].map(choice => ({ choice, rank: random() }))
        .sort((a, b) => Number(used.has(a.choice.entryId)) - Number(used.has(b.choice.entryId)) || a.rank - b.rank)
        .map(item => item.choice);
      for (const choice of ordered) {
        if (requireDistinct && used.has(choice.entryId)) continue;
        const nextUsed = new Set(used); nextUsed.add(choice.entryId);
        selected.push(choice); search(index + 1, selected, nextUsed); selected.pop();
        if (best && best.repeats === 0) return;
      }
    }
    search(0, [], new Set());
    return best && best.selected;
  }

  function missingSecretReason(entries, secret, requireDistinct) {
    const missing = [...new Set(Array.from(secret).filter(letter => !entries.some(entry => entry.word.includes(letter))))];
    if (missing.length) return `No answer contains: ${missing.join(', ')}.`;
    if (requireDistinct) {
      const selected = selectSecret(entries, secret, true);
      if (!selected) return 'The letters are present, but there are not enough different answers to supply each Secret Word letter.';
    }
    return 'No valid selection could be found for the Secret Word.';
  }

  function attachSecretCoordinates(placements, selected) {
    return selected.map((selection, secretIndex) => {
      const placement = placements.find(item => item.id === selection.entryId);
      const cell = placement.cells[selection.charIndex];
      return { ...selection, secretIndex, row: cell.row, col: cell.col };
    });
  }

  function numberPlacements(placements) {
    const starts = [...new Set(placements.map(p => key(p.row, p.col)))].map(value => {
      const [row, col] = value.split(',').map(Number); return { value, row, col };
    }).sort((a, b) => a.row - b.row || a.col - b.col);
    const numbers = new Map(starts.map((start, index) => [start.value, index + 1]));
    return placements.map(placement => ({ ...placement, number: numbers.get(key(placement.row, placement.col)) }));
  }

  function generateTraditional(rawEntries, rawSecret, seed) {
    const entries = prepareEntries(rawEntries), secret = lettersOnly(rawSecret);
    if (entries.length < 2) return { ok: false, error: 'Add at least two complete clue and answer pairs.' };
    if (!secret) return { ok: false, error: 'Enter a Secret Word containing letters A–Z.' };
    const selected = selectSecret(entries, secret, false, seed);
    if (!selected) return { ok: false, error: missingSecretReason(entries, secret, false) };
    let best = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const layout = buildTraditional(entries, Number(seed) + attempt * 9973);
      if (layout && (!best || scoreLayout(layout) < scoreLayout(best))) best = layout;
    }
    if (!best) return { ok: false, error: 'These answers cannot all be joined into one valid crossword without collisions. Add answers with more shared letters or edit the current answers.' };
    const placements = numberPlacements(best);
    return { ok: true, mode: 'traditional', secret, placements, selections: attachSecretCoordinates(placements, selected) };
  }

  function generateSecretColumn(rawEntries, rawSecret, seed, preferredSelections) {
    const entries = prepareEntries(rawEntries), secret = lettersOnly(rawSecret);
    if (!secret) return { ok: false, error: 'Enter a Secret Word containing letters A–Z.' };
    if (entries.length < secret.length) return { ok: false, error: `This mode needs at least ${secret.length} different answers—one for each Secret Word letter.` };
    const selected = preferredSelections || selectSecret(entries, secret, true, seed);
    if (!selected || new Set(selected.map(item => item.entryId)).size !== secret.length) {
      return { ok: false, error: missingSecretReason(entries, secret, true) };
    }
    const random = seededRandom(seed);
    const selectedIds = new Set(selected.map(item => item.entryId));
    const selectedEntries = selected.map(item => entries.find(entry => entry.id === item.entryId));
    const maxBefore = Math.max(...selected.map(item => item.charIndex));
    const extra = entries.filter(entry => !selectedIds.has(entry.id)).sort((a, b) => b.word.length - a.word.length || random() - .5);
    const placements = selectedEntries.map((entry, row) => {
      const selection = selected[row], col = maxBefore - selection.charIndex;
      return { ...entry, row, col, direction: 'across', number: row + 1, cells: cellsFor(entry.word, row, col, 'across') };
    });
    extra.forEach((entry, index) => {
      const row = secret.length + 1 + index;
      placements.push({ ...entry, row, col: 0, direction: 'across', number: placements.length + 1, cells: cellsFor(entry.word, row, 0, 'across') });
    });
    const selections = selected.map((item, secretIndex) => ({
      ...item, secretIndex, row: secretIndex, col: maxBefore
    }));
    return { ok: true, mode: 'secret-column', secret, placements, selections };
  }

  function validateSelections(result, selections) {
    if (!result || !result.secret || selections.length !== result.secret.length) return false;
    const distinct = new Set();
    for (let index = 0; index < selections.length; index++) {
      const selection = selections[index];
      const placement = result.placements.find(item => item.id === selection.entryId);
      if (!placement || placement.word[selection.charIndex] !== result.secret[index]) return false;
      distinct.add(selection.entryId);
    }
    return result.mode !== 'secret-column' || distinct.size === selections.length;
  }

  function validateLayout(result) {
    if (!result || !result.ok) return false;
    const occupied = new Map();
    for (const placement of result.placements) {
      if (placement.cells.map(cell => cell.letter).join('') !== placement.word) return false;
      for (const cell of placement.cells) {
        const position = key(cell.row, cell.col);
        if (occupied.has(position) && occupied.get(position) !== cell.letter) return false;
        occupied.set(position, cell.letter);
      }
    }
    return validateSelections(result, result.selections);
  }

  function projectSnapshot(state) {
    return JSON.parse(JSON.stringify({
      format: 'simple-crossword-project', version: 1,
      projectId: state.projectId, title: state.title, mode: state.mode,
      secret: state.secret, entries: state.entries, result: state.result,
      settings: state.settings, savedAt: new Date().toISOString()
    }));
  }

  function validateProject(project) {
    return Boolean(project && project.format === 'simple-crossword-project' && project.version === 1 &&
      Array.isArray(project.entries) && project.settings && (!project.result || validateLayout(project.result)));
  }

  return {
    lettersOnly, prepareEntries, selectSecret, missingSecretReason,
    generateTraditional, generateSecretColumn, validateSelections, validateLayout,
    projectSnapshot, validateProject, occurrences, attachSecretCoordinates
  };
});
