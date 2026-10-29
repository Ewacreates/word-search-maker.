'use strict';
const assert = require('node:assert/strict');

(async function main() {

const endpoint = process.env.CROSSWORD_CDP || 'http://127.0.0.1:9222';
const pages = await (await fetch(`${endpoint}/json`)).json();
const page = pages.find(item => item.type === 'page' && item.url.includes('/crossword/'));
assert.ok(page, 'Crossword page is open in Chromium');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 1;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
};
function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

await command('Page.enable');
await command('Runtime.enable');

const traditional = await evaluate(`(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const set = (node, value) => { node.value = value; node.dispatchEvent(new Event('input', {bubbles:true})); };
  const pairs = [
    ['A crisp fruit','APPLE'],['A bell-shaped fruit','PEAR'],['A small fruit that grows in bunches','GRAPE'],
    ['A purple stone fruit','PLUM'],['A large sweet fruit','MELON']
  ];
  set(document.querySelector('#title'), 'Fruit Crossword'); set(document.querySelector('#secret'), 'LEAP');
  document.querySelector('input[value=traditional]').click();
  document.querySelectorAll('.entry-row').forEach((row, index) => {
    set(row.querySelector('.clue'), pairs[index][0]); set(row.querySelector('.answer'), pairs[index][1]);
  });
  document.querySelector('#generate').click(); await wait(150);
  const directLetters = () => [...document.querySelectorAll('.cell')].flatMap(cell => [...cell.childNodes])
    .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()).length;
  const blankLetters = directLetters();
  document.querySelector('#answer-view').click(); await wait(20); const answerLetters = directLetters();
  const beforeAdjust = [...document.querySelectorAll('#adjustments select')].map(select => select.value);
  let adjusted = false;
  for (const select of document.querySelectorAll('#adjustments select')) {
    if (select.options.length > 1) {
      const old = select.value; select.selectedIndex = select.selectedIndex ? 0 : 1;
      document.querySelector('#apply-adjustments').click(); await wait(20);
      adjusted = document.querySelector('#adjust-status').textContent.includes('updated');
      if (!adjusted) select.value = old;
      else break;
    }
  }
  document.querySelector('#edit').click();
  const retained = document.querySelector('#title').value === 'Fruit Crossword' && document.querySelector('.answer').value === 'APPLE';
  document.querySelector('#generate').click(); await wait(100);
  await wait(350);
  const saved = JSON.parse(localStorage.getItem('simple-crossword-generator.autosave.v1'));
  saved.title = 'Loaded Fruit Crossword';
  const transfer = new DataTransfer(); transfer.items.add(new File([JSON.stringify(saved)], 'fruit.json', {type:'application/json'}));
  const input = document.querySelector('#load-project'); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true}));
  await wait(100);
  return {
    previewVisible: !document.querySelector('#preview').hidden,
    blankLetters, answerLetters, adjusted, retained,
    clueCount: document.querySelectorAll('#across-clues li,#down-clues li').length,
    secretCount: document.querySelectorAll('.secret-cell').length,
    loadedTitle: document.querySelector('#preview-heading').textContent,
    autosaveHasLayout: Boolean(saved.result && saved.result.placements.length === 5),
    originalSelections: beforeAdjust.length
  };
})()`);
assert.equal(traditional.previewVisible, true);
assert.equal(traditional.blankLetters, 0, 'Blank worksheet reveals no answer letters');
assert.ok(traditional.answerLetters > 0, 'Answer key reveals answer letters');
assert.equal(traditional.adjusted, true, 'A valid manual Secret Word adjustment is accepted');
assert.equal(traditional.retained, true, 'Editing preserves form data');
assert.equal(traditional.clueCount, 5);
assert.equal(traditional.secretCount, 4);
assert.equal(traditional.loadedTitle, 'Loaded Fruit Crossword');
assert.equal(traditional.autosaveHasLayout, true);
assert.equal(traditional.originalSelections, 4);

const blankPdf = await command('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69 });
assert.ok(blankPdf.data.length > 10000, 'Printable A4 PDF data was generated');
await evaluate(`document.querySelector('#answer-view').click()`);
const answerPdf = await command('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69 });
assert.ok(answerPdf.data.length > 10000, 'Printable answer-key PDF data was generated');
assert.notEqual(answerPdf.data, blankPdf.data, 'Blank worksheet and answer key produce different PDFs');
const pdfPages = data => (Buffer.from(data, 'base64').toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
assert.ok(pdfPages(blankPdf.data) >= 1 && pdfPages(blankPdf.data) <= 2, 'Worksheet PDF uses a compact page count');
assert.ok(pdfPages(answerPdf.data) >= 1 && pdfPages(answerPdf.data) <= 2, 'Answer-key PDF uses a compact page count');

const column = await evaluate(`(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const set = (node, value) => { node.value = value; node.dispatchEvent(new Event('input', {bubbles:true})); };
  document.querySelector('#edit').click(); document.querySelector('input[value="secret-column"]').click();
  set(document.querySelector('#title'), 'Everyday Words'); set(document.querySelector('#secret'), 'CARE');
  const pairs = [['A pet that purrs','CAT'],['A crisp fruit','APPLE'],['Water flowing to the sea','RIVER'],['A bell-shaped fruit','PEAR'],['Where someone lives','HOME']];
  document.querySelectorAll('.entry-row').forEach((row, index) => { set(row.querySelector('.clue'), pairs[index][0]); set(row.querySelector('.answer'), pairs[index][1]); });
  document.querySelector('#generate').click(); await wait(100);
  const generated = !document.querySelector('#preview').hidden;
  const secretCells = [...document.querySelectorAll('.secret-cell')];
  const columns = secretCells.map(cell => [...cell.parentElement.children].indexOf(cell) % Number(getComputedStyle(cell.parentElement).getPropertyValue('--grid-cols')));
  const initialLayout = secretCells.map(cell => [...cell.parentElement.children].indexOf(cell));
  document.querySelector('#regenerate').click(); await wait(100);
  const regeneratedLayout = [...document.querySelectorAll('.secret-cell')].map(cell => [...cell.parentElement.children].indexOf(cell));
  document.querySelector('#edit').click(); set(document.querySelector('#secret'), 'JAZZ'); document.querySelector('#generate').click(); await wait(50);
  const impossible = document.querySelector('#editor-status').textContent;
  return { generated, secretCount: secretCells.length, oneColumn: new Set(columns).size === 1,
    clueCount: document.querySelectorAll('#across-clues li').length, downHidden: document.querySelector('#down-group').hidden,
    impossible, regenerated: JSON.stringify(initialLayout) !== JSON.stringify(regeneratedLayout) || document.querySelectorAll('#adjustments select option').length > 4 };
})()`);
assert.equal(column.generated, true);
assert.equal(column.secretCount, 4);
assert.equal(column.oneColumn, true, 'Secret Word letters form one vertical column');
assert.equal(column.clueCount, 5);
assert.equal(column.downHidden, true);
assert.match(column.impossible, /No answer contains:|not enough different answers/);
assert.equal(column.regenerated, true, 'Regeneration has an alternate layout or selectable alternatives');

await command('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await new Promise(resolve => setTimeout(resolve, 250));
const wordSearch = await evaluate(`({
  title: document.title,
  status: document.querySelector('#status')?.textContent,
  canvasWidth: document.querySelector('#canvas')?.width,
  crosswordLink: document.querySelector('.tool-link')?.getAttribute('href')
})`);
assert.equal(wordSearch.title, 'Word Search Maker');
assert.match(wordSearch.status, /words placed/);
assert.ok(wordSearch.canvasWidth > 0, 'Existing Word Search Generator still renders its puzzle');
assert.equal(wordSearch.crosswordLink, 'crossword/index.html');

socket.close();
console.log('Crossword browser tests passed: both modes, blank/answer views, editing, adjustment, autosave/load, regeneration, impossible case, and printable PDF.');
})().catch(error => { console.error(error); process.exitCode = 1; });
