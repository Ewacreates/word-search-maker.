'use strict';
const $ = id => document.getElementById(id);
let current, showingAnswers = false;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const shuffle = items => items.map(value => ({value, key: Math.random()})).sort((a,b)=>a.key-b.key).map(x=>x.value);

// Masks use normalized cell centers, so every placement can test the same boundary.
function inside(shape, col, row, n) {
  const x = 2*(col+.5)/n-1, y = 2*(row+.5)/n-1;
  if(shape==='circle') return x*x+y*y<=1;
  if(shape==='heart') { const v=-y*1.2+.25, u=x*1.2; return (u*u+v*v-1)**3-u*u*v**3<=0; }
  if(shape==='tree') return (y<.68 && Math.abs(x)<(y+1)*.59) || (y>=.68 && Math.abs(x)<.18);
  if(shape==='star') {
    // Ray casting against a ten-vertex, five-point star.
    const points=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?.46:1;return [Math.cos(a)*r,Math.sin(a)*r];});
    let hit=false;
    for(let i=0,j=9;i<10;j=i++) {
      const [a,b]=points[i],[c,d]=points[j];
      if((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) hit=!hit;
    }
    return hit;
  }
  return true;
}
function directions(level, mode) {
  let dirs=[[1,0]];
  if(mode>=2) dirs.push([0,1]);
  if(mode>=3) dirs.push([1,1],[1,-1]);
  if(level==='hard'||(level==='medium'&&Math.random()<.5)) dirs=dirs.concat(dirs.map(([x,y])=>[-x,-y]));
  return dirs;
}
function attempt(words,n,shape,level,mode) {
  const mask=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>inside(shape,x,y,n)));
  const grid=mask.map(row=>row.map(()=>'')), placed=[];
  // Longest first; random order among equal-length words prevents repeated dead ends.
  for(const word of shuffle(words).sort((a,b)=>b.length-a.length)) {
    let best=null, score=-Infinity;
    for(const [dx,dy] of directions(level,mode)) for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
      const cells=[];let overlap=0;
      for(let k=0;k<word.length;k++) {
        const cx=x+k*dx,cy=y+k*dy;
        if(!mask[cy]?.[cx] || (grid[cy][cx] && grid[cy][cx]!==word[k])) break;
        if(grid[cy][cx]) overlap++;
        cells.push([cx,cy]);
      }
      const value=overlap*.6+Math.random();
      if(cells.length===word.length && value>score){best=cells;score=value;}
    }
    if(best){best.forEach(([x,y],k)=>grid[y][x]=word[k]);placed.push({word,cells:best});}
  }
  return {n,shape,level,mode,mask,grid,placed};
}
function generate() {
  const raw=$('words').value.split(/\r?\n/);
  const words=[...new Set(raw.map(w=>w.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'')).filter(Boolean))];
  if(!words.length){$('status').textContent='Enter at least one word containing letters A–Z.';return;}
  if(words.length>100||words.some(w=>w.length>40)){$('status').textContent='Use up to 100 unique words, each with at most 40 letters.';return;}
  const shape=$('shape').value,level=$('difficulty').value,mode=Number($('directions').value),auto=$('size').value==='auto';
  const density={easy:2.6,medium:2,hard:1.6}[level];
  let n=auto?Math.min(40,Math.max(10,Math.max(...words.map(w=>w.length))+2,Math.ceil(Math.sqrt(words.join('').length*density)))):Number($('size').value);
  let best;
  // Repeat greedy searches, then enlarge automatic grids. Retain the best partial result.
  for(;n<=40;n+=2){
    for(let retry=0;retry<12;retry++){
      const candidate=attempt(words,n,shape,level,mode);
      if(!best||candidate.placed.length>best.placed.length) best=candidate;
      if(best.placed.length===words.length) break;
    }
    if(!auto||best.placed.length===words.length) break;
  }
  best.grid.forEach((row,y)=>row.forEach((letter,x)=>{if(best.mask[y][x]&&!letter)row[x]=alphabet[Math.floor(Math.random()*26)];}));
  current=best;
  const missing=words.filter(w=>!best.placed.some(p=>p.word===w));
  $('status').textContent=missing.length?`Placed ${best.placed.length} of ${words.length}. Could not fit: ${missing.join(', ')}. Try a larger grid, more directions, or shorter words.`:`All ${words.length} words placed. Your puzzle is ready.`;
  render();
}
// A shared canvas renderer keeps previews, PNGs, and print output consistent.
function draw(canvas,answers,full=false) {
  const p=current,cell=40,pad=40,gridTop=full?150:pad;
  const columns=3,rows=Math.ceil(p.placed.length/columns);
  canvas.width=p.n*cell+pad*2;canvas.height=gridTop+p.n*cell+(full?100+rows*34:pad);
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(full){ctx.fillStyle='#243831';ctx.textAlign='center';ctx.font='36px Georgia';ctx.fillText(answers?'Word Search — Answers':'Word Search',canvas.width/2,65);ctx.font='18px Arial';ctx.fillText(`${p.n} × ${p.n} · ${p.shape} · ${p.level}`,canvas.width/2,105);}
  if(answers){
    ctx.lineCap='round';ctx.lineWidth=29;ctx.strokeStyle='rgba(92,155,116,.28)';
    for(const {cells} of p.placed){const a=cells[0],b=cells[cells.length-1];ctx.beginPath();ctx.moveTo(pad+(a[0]+.5)*cell,gridTop+(a[1]+.5)*cell);ctx.lineTo(pad+(b[0]+.5)*cell+.01,gridTop+(b[1]+.5)*cell);ctx.stroke();}
  }
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='21px monospace';ctx.fillStyle='#253a30';
  p.grid.forEach((row,y)=>row.forEach((letter,x)=>{if(p.mask[y][x])ctx.fillText(letter,pad+(x+.5)*cell,gridTop+(y+.5)*cell);}));
  if(full){ctx.textAlign='left';ctx.font='18px Arial';const top=gridTop+p.n*cell+55;ctx.fillText('WORDS TO FIND',pad,top);p.placed.map(p=>p.word).sort().forEach((word,i)=>ctx.fillText(word,pad+(i%columns)*(canvas.width-2*pad)/columns,top+40+Math.floor(i/columns)*34));}
}
function render(){
  if(!current)return;
  draw($('canvas'),showingAnswers);
  $('previewTitle').textContent=showingAnswers?'Answer Key':'Word Search';
  $('canvas').setAttribute('aria-label',showingAnswers?'Answer key with hidden words highlighted':'Word search letter grid');
  $('meta').textContent=`${current.n} × ${current.n} GRID · ${current.placed.length} WORDS · ${current.level.toUpperCase()}`;
  $('wordList').replaceChildren(...current.placed.map(p=>p.word).sort().map(word=>{const li=document.createElement('li');li.textContent=word;return li;}));
  $('puzzleTab').setAttribute('aria-pressed',String(!showingAnswers));$('answerTab').setAttribute('aria-pressed',String(showingAnswers));
}
function exportPNG(answers){if(!current)return;const c=document.createElement('canvas');draw(c,answers,true);c.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=answers?'word-search-answers.png':'word-search-puzzle.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
function printSheet(answers){
  if(!current)return;
  document.querySelector('.print-sheet')?.remove();
  const c=document.createElement('canvas');draw(c,answers,true);
  const sheet=document.createElement('div');sheet.className='print-sheet';sheet.style.display='none';
  const img=new Image();img.alt=answers?'Word search answers':'Word search puzzle';
  img.onload=()=>{window.print();};img.src=c.toDataURL();sheet.append(img);document.body.append(sheet);
}
$('form').addEventListener('submit',e=>{e.preventDefault();generate();});
$('regenerate').onclick=generate;
$('puzzleTab').onclick=()=>{showingAnswers=false;render();};
$('answerTab').onclick=()=>{showingAnswers=true;render();};
$('downloadPuzzle').onclick=()=>exportPNG(false);$('downloadAnswers').onclick=()=>exportPNG(true);
$('printPuzzle').onclick=()=>printSheet(false);$('printAnswers').onclick=()=>printSheet(true);
generate();
