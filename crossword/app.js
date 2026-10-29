'use strict';
const Core = window.CrosswordCore;
const $ = id => document.getElementById(id);
const AUTOSAVE_KEY = 'simple-crossword-generator.autosave.v1';
let state = {
  projectId: makeId(), title: '', mode: 'traditional', secret: '', entries: [],
  result: null, settings: { orientation: 'portrait', cellSize: 'normal' }, seed: 101
};
let answerView = false;

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newEntry(clue = '', answer = '', id = makeId()) { return { id, clue, answer }; }

function collectForm() {
  state.title = $('title').value.trim();
  state.mode = document.querySelector('input[name=mode]:checked').value;
  state.secret = $('secret').value;
  state.entries = [...document.querySelectorAll('.entry-row')].map(row => ({
    id: row.dataset.id, clue: row.querySelector('.clue').value, answer: row.querySelector('.answer').value
  }));
  state.settings = { orientation: $('orientation').value, cellSize: $('cell-size').value };
}

function addEntry(entry = newEntry()) {
  const fragment = $('entry-template').content.cloneNode(true), row = fragment.querySelector('.entry-row');
  row.dataset.id = entry.id;
  row.querySelector('.clue').value = entry.clue;
  row.querySelector('.answer').value = entry.answer;
  row.querySelector('.remove-entry').onclick = () => {
    if (document.querySelectorAll('.entry-row').length <= 2) {
      $('editor-status').textContent = 'Keep at least two question and answer rows.'; return;
    }
    row.remove(); renumberEntries(); queueAutosave();
  };
  $('entries').append(fragment); renumberEntries();
}

function renumberEntries() {
  document.querySelectorAll('.entry-row').forEach((row, index) => {
    row.querySelector('.entry-number').textContent = index + 1;
    row.querySelector('.remove-entry').setAttribute('aria-label', `Delete question ${index + 1}`);
  });
}

function renderForm() {
  $('title').value = state.title || '';
  $('secret').value = state.secret || '';
  const mode = document.querySelector(`input[name=mode][value="${state.mode}"]`);
  if (mode) mode.checked = true;
  $('orientation').value = state.settings?.orientation || 'portrait';
  $('cell-size').value = state.settings?.cellSize || 'normal';
  $('entries').replaceChildren();
  const entries = state.entries.length ? state.entries : Array.from({ length: 5 }, () => newEntry());
  entries.forEach(addEntry);
}

function completeEntries() {
  const entries = state.entries.filter(entry => entry.clue.trim() || entry.answer.trim());
  const incomplete = entries.find(entry => !entry.clue.trim() || !Core.lettersOnly(entry.answer));
  if (incomplete) throw new Error('Every used row needs both a clue and an answer containing at least two letters.');
  if (entries.some(entry => Core.lettersOnly(entry.answer).length < 2)) throw new Error('Each answer must contain at least two letters.');
  return entries;
}

function generate(regenerate = false) {
  collectForm();
  $('editor-status').textContent = '';
  let entries;
  try { entries = completeEntries(); } catch (error) { $('editor-status').textContent = error.message; return; }
  if (regenerate) state.seed += 7919;
  const result = state.mode === 'traditional'
    ? Core.generateTraditional(entries, state.secret, state.seed)
    : Core.generateSecretColumn(entries, state.secret, state.seed);
  if (!result.ok) {
    const target = regenerate ? $('preview-status') : $('editor-status');
    target.textContent = result.error;
    if (!regenerate) $('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  state.result = result;
  answerView = false;
  renderPreview();
  $('editor').hidden = true; $('preview').hidden = false;
  $('preview-status').textContent = regenerate ? 'A new valid layout was generated.' : '';
  saveAutosave();
  $('preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPreview() {
  const result = state.result;
  if (!result || !Core.validateLayout(result)) return;
  $('preview-heading').textContent = state.title || 'Crossword';
  $('sheet-label').textContent = answerView ? 'CROSSWORD ANSWER KEY' : 'CROSSWORD WORKSHEET';
  $('blank-view').setAttribute('aria-pressed', String(!answerView));
  $('answer-view').setAttribute('aria-pressed', String(answerView));
  $('worksheet').classList.toggle('large-print', state.settings.cellSize === 'large');
  $('worksheet').classList.toggle('compact-print', state.settings.cellSize === 'compact');
  $('worksheet').classList.toggle('landscape-sheet', state.settings.orientation === 'landscape');
  $('worksheet').classList.toggle('single-clue-column', result.mode === 'secret-column');
  renderGrid(result); renderSecret(result); renderClues(result); renderAdjustments(result);
}

function renderGrid(result) {
  const cells = result.placements.flatMap(placement => placement.cells);
  const maxRow = Math.max(...cells.map(cell => cell.row)), maxCol = Math.max(...cells.map(cell => cell.col));
  const occupied = new Map(), starts = new Map();
  result.placements.forEach(placement => {
    starts.set(`${placement.row},${placement.col}`, placement.number);
    placement.cells.forEach(cell => occupied.set(`${cell.row},${cell.col}`, cell.letter));
  });
  const secrets = new Map(result.selections.map(item => [`${item.row},${item.col}`, item.secretIndex + 1]));
  const grid = $('grid'); grid.replaceChildren(); grid.style.setProperty('--grid-cols', maxCol + 1);
  for (let row = 0; row <= maxRow; row++) for (let col = 0; col <= maxCol; col++) {
    const position = `${row},${col}`, cell = document.createElement('div');
    cell.className = occupied.has(position) ? 'cell' : 'cell empty';
    if (occupied.has(position)) {
      if (answerView) cell.append(occupied.get(position));
      if (starts.has(position)) cell.insertAdjacentHTML('afterbegin', `<span class="cell-number">${starts.get(position)}</span>`);
      if (secrets.has(position)) {
        cell.classList.add('secret-cell');
        cell.insertAdjacentHTML('beforeend', `<span class="secret-number">${secrets.get(position)}</span>`);
      }
      cell.setAttribute('aria-label', answerView ? `Letter ${occupied.get(position)}` : 'Empty letter square');
    } else cell.setAttribute('aria-hidden', 'true');
    grid.append(cell);
  }
}

function renderSecret(result) {
  $('secret-boxes').replaceChildren(...Array.from(result.secret, (letter, index) => {
    const box = document.createElement('span'); box.className = 'secret-box';
    box.innerHTML = `<small>${index + 1}</small>${answerView ? letter : ''}`; return box;
  }));
}

function renderClues(result) {
  const across = result.placements.filter(item => item.direction === 'across').sort((a, b) => a.number - b.number);
  const down = result.placements.filter(item => item.direction === 'down').sort((a, b) => a.number - b.number);
  const listItems = placements => placements.map(item => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${item.number}.</b> <span></span>${answerView ? ` <em>(${escapeHtml(item.answer)})</em>` : ''}`;
    li.querySelector('span').textContent = item.clue; return li;
  });
  $('across-clues').replaceChildren(...listItems(across));
  $('down-clues').replaceChildren(...listItems(down));
  $('down-group').hidden = !down.length;
}

function escapeHtml(value) {
  const node = document.createElement('span'); node.textContent = value; return node.innerHTML;
}

function selectionValue(selection) { return `${selection.entryId}|${selection.charIndex}`; }

function renderAdjustments(result) {
  const entries = Core.prepareEntries(state.entries), container = $('adjustments'); container.replaceChildren();
  Array.from(result.secret).forEach((letter, index) => {
    const row = document.createElement('div'); row.className = 'adjust-row';
    const label = document.createElement('label'); label.textContent = `${index + 1}. Letter ${letter}`;
    const select = document.createElement('select'); select.dataset.index = index; label.htmlFor = select.id = `adjust-${index}`;
    Core.occurrences(entries, letter).forEach(optionData => {
      const entry = entries.find(item => item.id === optionData.entryId), option = document.createElement('option');
      option.value = selectionValue(optionData);
      option.textContent = `${entry.answer} — letter ${optionData.charIndex + 1}`;
      option.selected = option.value === selectionValue(result.selections[index]); select.append(option);
    });
    row.append(label, select); container.append(row);
  });
}

function applyAdjustments() {
  const selections = [...$('adjustments').querySelectorAll('select')].map((select, secretIndex) => {
    const [entryId, charIndex] = select.value.split('|');
    return { entryId, charIndex: Number(charIndex), letter: state.result.secret[secretIndex], secretIndex };
  });
  $('adjust-status').textContent = '';
  if (!Core.validateSelections(state.result, selections)) {
    $('adjust-status').textContent = state.result.mode === 'secret-column'
      ? 'Each Secret Word letter must use a different answer. Choose a valid alternative.'
      : 'That selection does not spell the Secret Word correctly.';
    renderAdjustments(state.result); return;
  }
  if (state.result.mode === 'secret-column') {
    const rebuilt = Core.generateSecretColumn(state.entries, state.result.secret, state.seed, selections);
    if (!rebuilt.ok) { $('adjust-status').textContent = rebuilt.error; return; }
    state.result = rebuilt;
  } else {
    state.result.selections = Core.attachSecretCoordinates(state.result.placements, selections);
  }
  $('adjust-status').textContent = 'Secret Word selections updated.';
  renderPreview(); saveAutosave();
}

function setAnswerView(show) { answerView = show; renderPreview(); }

function applyPrintSettings() {
  collectForm();
  document.body.classList.toggle('print-landscape', state.settings.orientation === 'landscape');
  let pageStyle = $('page-orientation-style');
  if (!pageStyle) { pageStyle = document.createElement('style'); pageStyle.id = 'page-orientation-style'; document.head.append(pageStyle); }
  pageStyle.textContent = `@media print{@page{size:A4 ${state.settings.orientation};margin:12mm}}`;
  renderPreview(); saveAutosave();
}

function printCurrent() { applyPrintSettings(); window.print(); }

function saveAutosave() {
  collectForm();
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(Core.projectSnapshot(state))); } catch (_) { /* storage can be unavailable */ }
}
let autosaveTimer;
function queueAutosave() { clearTimeout(autosaveTimer); autosaveTimer = setTimeout(saveAutosave, 250); }

function downloadProject(asNew) {
  collectForm();
  if (asNew) state.projectId = makeId();
  const project = Core.projectSnapshot(state), blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'), title = Core.lettersOnly(state.title).toLowerCase() || 'crossword-project';
  link.href = URL.createObjectURL(blob); link.download = `${title}${asNew ? '-copy' : ''}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  $('project-status').textContent = asNew ? 'A new project copy was saved.' : 'Project saved.'; saveAutosave();
}

async function loadProject(file) {
  try {
    const project = JSON.parse(await file.text());
    if (!Core.validateProject(project)) throw new Error('This is not a valid Simple Crossword project file.');
    state = { ...project, seed: 101, settings: project.settings || { orientation: 'portrait', cellSize: 'normal' } };
    renderForm();
    if (state.result) { answerView = false; renderPreview(); $('editor').hidden = true; $('preview').hidden = false; }
    else { $('editor').hidden = false; $('preview').hidden = true; }
    $('project-status').textContent = 'Project loaded. Its saved layout and settings were restored.';
    saveAutosave();
  } catch (error) { $('project-status').textContent = error.message; }
  $('load-project').value = '';
}

function recoverAutosave() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY));
    if (Core.validateProject(saved)) state = { ...state, ...saved };
  } catch (_) { /* start with an empty project */ }
}

$('add-entry').onclick = () => { addEntry(); queueAutosave(); };
$('generate').onclick = () => generate(false);
$('regenerate').onclick = () => generate(true);
$('edit').onclick = () => { $('preview').hidden = true; $('editor').hidden = false; renderForm(); $('editor').scrollIntoView({ behavior: 'smooth' }); };
$('blank-view').onclick = () => setAnswerView(false);
$('answer-view').onclick = () => setAnswerView(true);
$('apply-adjustments').onclick = applyAdjustments;
$('orientation').onchange = applyPrintSettings;
$('cell-size').onchange = applyPrintSettings;
$('print').onclick = printCurrent;
$('pdf').onclick = printCurrent;
$('save-project').onclick = () => downloadProject(false);
$('save-new').onclick = () => downloadProject(true);
$('load-project').onchange = event => event.target.files[0] && loadProject(event.target.files[0]);
document.addEventListener('input', event => {
  if (event.target.closest('#editor') && !event.target.matches('#title') && state.result) state.result = null;
  queueAutosave();
});
document.addEventListener('change', queueAutosave);
window.addEventListener('beforeprint', applyPrintSettings);

recoverAutosave(); renderForm();
if (state.result && Core.validateLayout(state.result)) { renderPreview(); $('editor').hidden = true; $('preview').hidden = false; }
