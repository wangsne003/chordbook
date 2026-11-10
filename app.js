/* 級數練習本 app.js — © 瑞梅國小 Steve Wang */
(() => {
'use strict';
const APP_VERSION = '1.1.0';
const LS_KEY = 'chordbook-v1';

/* ---------- 樂理工具 ---------- */
const KEYS = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const ALIAS = {'C#':1,'D#':3,'F#':6,'G#':8,'A#':10,'Cb':11,'Fb':4,'E#':5,'B#':0};
const DEG = {i:0,ii:2,iii:4,iv:5,v:7,vi:9,vii:11};
const FIT = {same:'★ 同光輝歲月收尾', canon:'標準卡農', variant:'變體'};
const pretty = k => k ? k[0] + k.slice(1).replace('b','♭').replace('#','♯') : '';
/* 歌曲原調可以是大調（'D'）或小調（'Dm'） */
function songKey(k, mode){
  if(!k) return null;
  const minor = /m$/.test(String(k).trim());
  const i = keyIdx(String(k).trim().replace(/m$/,''));
  if(i<0) return null;
  const label = minor ? pretty(KEYS[i]) + 'm' : keyLabel(KEYS[i], mode);
  const hint = capoHint(KEYS[i], minor ? 'minor' : 'major');
  let play = i;
  if(minor && mode!=='minor') play = (i+3)%12;
  return {i, minor, label, hint, play:KEYS[play]};
}
function keyIdx(k){ if(!k) return -1; k=String(k).replace('♭','b').replace('♯','#').trim(); const i=KEYS.indexOf(k); return i>=0?i:(k in ALIAS?ALIAS[k]:-1); }
function parseNum(tok){
  const m = String(tok).trim().match(/^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(°|o|dim|maj7|m7|7|sus4|sus2|add9)?$/);
  if(!m) return null;
  const acc = (m[1]==='b'||m[1]==='♭') ? -1 : (m[1] ? 1 : 0);
  const major = m[2] === m[2].toUpperCase();
  let q = major ? 'maj' : 'min';
  const suf = m[3] || '';
  if(suf==='°'||suf==='o'||suf==='dim') q='dim';
  else if(suf==='7') q = major ? '7' : 'm7';
  else if(suf==='m7') q='m7';
  else if(suf==='maj7') q = major ? 'maj7' : 'mmaj7';
  else if(suf) q = suf;
  return {acc, deg:DEG[m[2].toLowerCase()], q};
}
const QNAME = {maj:'',min:'m',dim:'dim','7':'7',m7:'m7',maj7:'maj7',mmaj7:'m(maj7)',sus4:'sus4',sus2:'sus2',add9:'add9'};
const QINT = {maj:[0,4,7],min:[0,3,7],dim:[0,3,6],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],mmaj7:[0,3,7,11],sus4:[0,5,7],sus2:[0,2,7],add9:[0,4,7,14]};
const splitNums = s => String(s||'').split(/[\s–—\-,，、]+/).filter(Boolean);
function chordOf(tok, key){
  const p = parseNum(tok), k = keyIdx(key);
  if(!p || k<0) return null;
  const root = (k + p.deg + p.acc + 24) % 12;
  return {root, q:p.q, name: pretty(KEYS[root]) + QNAME[p.q]};
}
function capoHint(key, mode){
  const i = keyIdx(key); if(i<0) return '';
  if(mode==='minor'){
    const a=(i-9+12)%12, e=(i-4+12)%12;
    if(a===0) return 'Am 指型・不夾'; if(e===0) return 'Em 指型・不夾';
    return a<=e ? `Am 指型・夾 ${a}` : `Em 指型・夾 ${e}`;
  }
  const c=i, g=(i-7+12)%12;
  if(c===0) return 'C 指型・不夾'; if(g===0) return 'G 指型・不夾';
  return c<=g ? `C 指型・夾 ${c}` : `G 指型・夾 ${g}`;
}
const keyLabel = (k, mode) => keyIdx(k)<0 ? '' : pretty(k) + (mode==='minor' ? ' 小調' : '');

/* ---------- 日期 ---------- */
const pad = n => String(n).padStart(2,'0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());

/* ---------- 狀態 ---------- */
function blank(){
  return { v:1, updatedAt:0, progress:{}, edits:{}, deleted:[], customSongs:[], customProgs:[],
    log:{}, quiz:{total:0,right:0,wrong:[]}, settings:{gasUrl:'', goal:30, beats:4, viewKey:{}, sel:'canon', bpm:80, pattern:'strum'} };
}
let S = load();
function load(){
  try{ const raw = localStorage.getItem(LS_KEY); if(raw){ const o = JSON.parse(raw); return merge(blank(), o); } }catch(e){}
  return blank();
}
function merge(base, o){
  for(const k in o){ if(o[k] && typeof o[k]==='object' && !Array.isArray(o[k]) && base[k] && typeof base[k]==='object' && !Array.isArray(base[k])) base[k]=merge(base[k],o[k]); else base[k]=o[k]; }
  return base;
}
let pushTimer = null;
function save(touch=true){
  if(touch) S.updatedAt = Date.now();
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){ toast('這支手機的儲存空間不足，紀錄可能沒存到'); }
  if(touch && S.settings.gasUrl){ clearTimeout(pushTimer); pushTimer = setTimeout(push, 2500); }
}

/* 合併內建資料與自訂資料 */
function progs(){
  return SEED.progressions.concat(S.customProgs).slice().sort((a,b)=>(a.order||99)-(b.order||99));
}
function progById(id){ return progs().find(p=>p.id===id); }
function songs(){
  const del = new Set(S.deleted);
  const base = SEED.songs.filter(s=>!del.has(s.id)).map(s=> S.edits[s.id] ? {...s, ...S.edits[s.id]} : s);
  return base.concat(S.customSongs.filter(s=>!del.has(s.id)));
}
const prog = id => S.progress[id] || {};

/* ---------- 小工具 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){ const t=$('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true, 2400); }
function logPractice(min){ const d=today(); S.log[d]=(S.log[d]||0)+min; }
function touchDay(){ const d=today(); if(!(d in S.log)) S.log[d]=0; }

/* ---------- 聲音 ---------- */
let ctx = null, master = null;
function audio(){
  if(!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  }
  if(ctx.state==='suspended') ctx.resume();
  return ctx;
}
const mtof = m => 440 * Math.pow(2, (m-69)/12);
function pluck(midi, t, dur=1.6, vel=0.22){
  const o1=ctx.createOscillator(), o2=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  o1.type='sawtooth'; o2.type='triangle'; o1.frequency.value=mtof(midi); o2.frequency.value=mtof(midi)*1.003;
  f.type='lowpass'; f.frequency.setValueAtTime(Math.min(5200, mtof(midi)*7), t); f.frequency.exponentialRampToValueAtTime(Math.max(300, mtof(midi)*1.5), t+dur*0.6); f.Q.value=0.8;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vel,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
  o1.start(t); o2.start(t); o1.stop(t+dur+0.05); o2.stop(t+dur+0.05);
}
function click(t, accent){
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.frequency.value = accent ? 1500 : 1000; o.type='square';
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(accent?0.12:0.06,t+0.002); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+0.06);
}
/* 吉他音域的和弦配置：低音根音 + 上方三到四個音 */
function voicing(ch){
  let bass = 40 + ((ch.root - 4 + 12) % 12);          // E2..D#3
  const ints = QINT[ch.q] || QINT.maj;
  const upper = []; let base = bass + 12;
  for(const iv of ints){ let n = base + iv; while(n < 52) n += 12; while(n > 70) n -= 12; upper.push(n); }
  upper.sort((a,b)=>a-b);
  return [bass, ...Array.from(new Set(upper))];
}
function strum(ch, t, down=true, vel=0.2, dur=1.8){
  const notes = voicing(ch); const seq = down ? notes : notes.slice().reverse();
  seq.forEach((n,i)=>pluck(n, t + i*0.018, dur, vel * (i===0?1.1:0.85)));
}
function arpeggio(ch, t, beatDur, beats){
  const notes = voicing(ch); const order=[0,2,1,3,2,1,3,2].map(i=>notes[Math.min(i, notes.length-1)]);
  const step = beatDur/2;
  for(let i=0;i<beats*2;i++) pluck(order[i%order.length], t+i*step, beatDur*2.2, i===0?0.24:0.16);
}

/* 播放一整組進行 */
let playing = null;
function stopPlay(){ if(playing){ playing.stop=true; clearTimeout(playing.timer); playing.onEnd && playing.onEnd(); playing=null; } }
function playProgression(chords, opt){
  audio(); stopPlay();
  const bpm = opt.bpm || 80, beats = opt.beats || 4, beat = 60/bpm, loop = !!opt.loop;
  const st = { stop:false, onEnd:opt.onEnd };
  playing = st;
  let idx = 0, nextT = ctx.currentTime + 0.12;
  function schedule(){
    if(st.stop) return;
    while(nextT < ctx.currentTime + 0.6){
      if(idx >= chords.length){ if(loop) idx = 0; else { const endIn=(nextT-ctx.currentTime)*1000; st.timer=setTimeout(()=>{ if(playing===st){ playing=null; st.onEnd&&st.onEnd(); } }, endIn); return; } }
      const ch = chords[idx];
      if(ch){
        if(opt.pattern==='arp') arpeggio(ch, nextT, beat, beats);
        else if(opt.pattern==='once') strum(ch, nextT, true, 0.24, beat*beats);
        else for(let b=0;b<beats;b++){ const down = b%2===0; strum(ch, nextT+b*beat, down, down?0.2:0.12, beat*1.6); }
      }
      if(opt.metro) for(let b=0;b<beats;b++) click(nextT+b*beat, b===0);
      const i = idx, at = nextT;
      setTimeout(()=>{ if(!st.stop && opt.onChord) opt.onChord(i); }, Math.max(0,(at-ctx.currentTime)*1000));
      nextT += beat*beats; idx++;
    }
    st.timer = setTimeout(schedule, 120);
  }
  schedule();
}

/* ---------- 練習本 ---------- */
let filter='all', editingSong=null, confirmDel=null, metro=false, loop=true;
function curProg(){ let p = progById(S.settings.sel); if(!p){ p = progs()[0]; S.settings.sel = p.id; } return p; }
function viewKey(p){ return S.settings.viewKey[p.id] || (p.mode==='minor' ? 'A' : 'C'); }

function renderChips(){
  const all = songs(); const sel = curProg().id;
  $('progChips').innerHTML = progs().map(p=>{
    const list = all.filter(s=>s.p===p.id), done = list.filter(s=>prog(s.id).s).length;
    return `<button class="chip" role="tab" data-p="${esc(p.id)}" aria-pressed="${p.id===sel}">${esc(p.name)}<small>${done}/${list.length}</small></button>`;
  }).join('') + `<button class="chip add" id="addProgBtn">＋ 自訂進行</button>`;
  $('progChips').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ stopPlay(); S.settings.sel=b.dataset.p; save(false); renderBook(); });
  $('addProgBtn').onclick=()=>openProgForm();
  const on = $('progChips').querySelector('[aria-pressed="true"]'); if(on) on.scrollIntoView({block:'nearest',inline:'center'});
}

function renderBoard(){
  const p = curProg(), key = viewKey(p), isCustom = S.customProgs.some(x=>x.id===p.id);
  const keyOpts = KEYS.map(k=>`<option value="${k}" ${k===key?'selected':''}>${keyLabel(k,p.mode)||pretty(k)}${p.mode==='minor'?'':' 調'}</option>`).join('');
  const isPlaying = playing && playing.tag==='board';
  if(!p.nums.length){
    $('board').innerHTML = `<div class="board-head"><h2>${esc(p.name)}</h2></div>${p.desc?`<p class="desc">${esc(p.desc)}</p>`:''}`;
    return;
  }
  $('board').innerHTML = `
    <div class="board-head"><h2>${esc(p.name)}</h2>
      <div class="tools"><label for="vk">調</label><select id="vk">${keyOpts}</select>
      ${isCustom?`<button class="tool-btn" id="editProg">編輯</button>`:''}</div></div>
    <div class="frets" id="frets" style="--cols:${Math.min(4,p.nums.length)}">${p.nums.map((n,i)=>{ const c=chordOf(n,key); return `<button class="fret" data-i="${i}" aria-label="播放 ${esc(n)} ${c?esc(c.name):''}"><span class="num">${esc(n.replace(/^b/,'♭'))}</span><span class="ch">${c?esc(c.name):'?'}</span></button>`; }).join('')}</div>
    ${p.desc?`<p class="desc">${esc(p.desc)}</p>`:''}
    <div class="tools">
      <button class="play" id="playBtn">${isPlaying?'■ 停止':'▶ 播放進行'}</button>
      <input type="number" id="bpm" min="40" max="200" value="${S.settings.bpm}" aria-label="速度 BPM"><span>BPM</span>
      <select id="pattern" aria-label="彈法"><option value="strum" ${S.settings.pattern==='strum'?'selected':''}>刷弦</option><option value="arp" ${S.settings.pattern==='arp'?'selected':''}>分解</option><option value="once" ${S.settings.pattern==='once'?'selected':''}>一個和弦刷一下</option></select>
      <button class="tool-btn" id="loopBtn" aria-pressed="${loop}">循環</button>
      <button class="tool-btn" id="metroBtn" aria-pressed="${metro}">節拍器</button>
    </div>
    <span class="capo-note">點任一格可單獨聽那個和弦。${p.mode==='minor'?'這組是小調進行，調性指小調主音。':''}</span>`;
  $('vk').onchange = e => { S.settings.viewKey[p.id]=e.target.value; save(false); stopPlay(); renderBoard(); };
  $('bpm').onchange = e => { S.settings.bpm = Math.max(40, Math.min(200, +e.target.value||80)); save(false); if(playing&&playing.tag==='board') startBoard(); };
  $('pattern').onchange = e => { S.settings.pattern = e.target.value; save(false); if(playing&&playing.tag==='board') startBoard(); };
  $('loopBtn').onclick = () => { loop=!loop; renderBoard(); if(playing&&playing.tag==='board') startBoard(); };
  $('metroBtn').onclick = () => { metro=!metro; renderBoard(); if(playing&&playing.tag==='board') startBoard(); };
  $('playBtn').onclick = () => { if(playing&&playing.tag==='board'){ stopPlay(); renderBoard(); } else startBoard(); };
  $('frets').querySelectorAll('.fret').forEach(b=>b.onclick=()=>{ audio(); const c=chordOf(p.nums[+b.dataset.i], key); if(c) strum(c, ctx.currentTime+0.02, true, 0.24, 2.2); flash(+b.dataset.i); });
  const ep=$('editProg'); if(ep) ep.onclick=()=>openProgForm(p);
}
function flash(i){ document.querySelectorAll('#frets .fret').forEach((f,j)=>f.classList.toggle('on', j===i)); }
function startBoard(){
  const p = curProg(), key = viewKey(p);
  playProgression(p.nums.map(n=>chordOf(n,key)), { bpm:S.settings.bpm, beats:S.settings.beats, loop, metro, pattern:S.settings.pattern,
    onChord:i=>flash(i), onEnd:()=>{ flash(-1); renderBoard(); } });
  playing.tag='board';
  renderBoard();
}

let query='', srcFilter='all';
const BOOKS = (window.SEED && SEED.books) || {};
function srcsOf(s){ return Array.isArray(s.src) ? s.src : (s.src ? [s.src] : []); }
function srcLabel(s){ return srcsOf(s).filter(x=>BOOKS[x.b]).map(x=>`${BOOKS[x.b]} p.${x.p}`).join('、'); }
function renderSrcSelect(){
  const sel = $('srcSel'); if(!sel || sel.dataset.ready) return;
  sel.innerHTML = '<option value="all">全部譜集</option>' + Object.entries(BOOKS).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('') + '<option value="none">不在譜集裡的歌</option>';
  sel.dataset.ready='1';
  sel.value = srcFilter;
}
function renderList(){
  renderSrcSelect();
  const p = curProg();
  const q = query.trim().toLowerCase();
  let rows = q ? songs().filter(s=>(`${s.t} ${s.a}`).toLowerCase().includes(q))
               : songs().filter(s=>s.p===p.id);
  rows.sort((a,b)=>(b.anchor?1:0)-(a.anchor?1:0) || (srcsOf(a).length?1:0)-(srcsOf(b).length?1:0));
  if(srcFilter==='none') rows = rows.filter(s=>!srcsOf(s).length);
  else if(srcFilter!=='all') rows = rows.filter(s=>srcsOf(s).some(x=>x.b===srcFilter));
  if(filter==='todo') rows = rows.filter(s=>!prog(s.id).s);
  if(filter==='done') rows = rows.filter(s=>prog(s.id).s);
  const list = $('list');
  if(!rows.length){ list.innerHTML = `<div class="empty">${q?`找不到「${esc(query.trim())}」。`:(filter==='all'&&srcFilter==='all'?'這組進行還沒有歌，按「＋ 新增歌曲」加第一首。':'這個篩選下沒有歌。')}</div>`; return; }
  const head = q ? `<div class="list-head">搜尋全部進行：${rows.length} 首</div>` : (rows.length>12 ? `<div class="list-head">${rows.length} 首</div>` : '');
  list.innerHTML = head + rows.map(s=>{
    const st = prog(s.id);
    const sp = progById(s.p) || p;
    const sk = songKey(s.k, sp.mode), known = !!sk;
    const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${s.t} ${s.a}`);
    const tabUrl = s.tab && /^https?:\/\//.test(s.tab) ? s.tab : '';
    return `<article class="song${s.anchor?' anchor':''}">
      <div class="s-top"><div class="s-title">${esc(s.t)}<small>${esc(s.a)}</small></div>${st.last?`<span class="last">最近 ${esc(st.last)}</span>`:''}</div>
      <div class="meta">
        <span class="pill key${known?'':' unknown'}">${known?'原調 '+esc(sk.label):'原調 待查'}</span>
        ${known?`<span class="pill">${esc(sk.hint)}</span>`:''}
        ${q?`<span class="pill">${esc(sp.name)}</span>`:''}
        ${s.f?`<span class="pill ${esc(s.f)}">${esc(FIT[s.f]||s.f)}</span>`:''}
        ${s.s?`<span class="pill">${esc(s.s)}</span>`:''}
        ${srcLabel(s)?`<span class="pill src">譜：${esc(srcLabel(s))}</span>`:''}
        ${s.auto?`<span class="pill auto">自動辨識</span>`:''}
      </div>
      ${s.pt?`<div class="s-prog">${esc(s.pt)}</div>`:''}
      ${s.n?`<p class="s-note">${esc(s.n)}</p>`:''}
      ${st.memo?`<p class="s-note">我的筆記：${esc(st.memo)}</p>`:''}
      <div class="stages">
        <button class="stage h" data-id="${esc(s.id)}" data-k="h" aria-pressed="${!!st.h}"><span class="dot"></span>聽懂</button>
        <button class="stage c" data-id="${esc(s.id)}" data-k="c" aria-pressed="${!!st.c}"><span class="dot"></span>和弦順</button>
        <button class="stage s" data-id="${esc(s.id)}" data-k="s" aria-pressed="${!!st.s}"><span class="dot"></span>會彈唱</button>
      </div>
      <div class="row-actions">
        <a href="${yt}" target="_blank" rel="noopener">YouTube</a>
        ${tabUrl?`<a href="${esc(tabUrl)}" target="_blank" rel="noopener">吉他譜</a>`:''}
        ${known?`<button data-playkey="${esc(sk.play)}" data-prog="${esc(sp.id)}">用原調播放</button>`:''}
        <button data-edit="${esc(s.id)}">編輯</button>
        <button class="del" data-del="${esc(s.id)}">${confirmDel===s.id?'確定刪除？再按一次':'刪除'}</button>
        ${confirmDel===s.id?`<button data-cancel>取消</button>`:''}
      </div>
    </article>`;
  }).join('');
  list.querySelectorAll('.stage').forEach(b=>b.onclick=()=>toggleStage(b.dataset.id, b.dataset.k));
  list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openSongForm(songs().find(s=>s.id===b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delSong(b.dataset.del));
  list.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{ confirmDel=null; renderList(); });
  list.querySelectorAll('[data-playkey]').forEach(b=>b.onclick=()=>{ const pid=b.dataset.prog||p.id; S.settings.sel=pid; S.settings.viewKey[pid]=b.dataset.playkey; save(false); if(query){ query=''; $('q').value=''; } renderChips(); renderList(); startBoard(); window.scrollTo({top:0,behavior:'smooth'}); });
}
function toggleStage(id, k){
  const st = {...prog(id)};
  st[k] = !st[k];
  if(st[k]){ if(k==='s'){ st.c=true; st.h=true; } if(k==='c') st.h=true; }
  st.last = today();
  S.progress[id] = st; touchDay(); save();
  renderChips(); renderList(); renderHeader();
}
function delSong(id){
  if(confirmDel!==id){ confirmDel=id; renderList(); return; }
  confirmDel=null;
  if(S.customSongs.some(s=>s.id===id)) S.customSongs = S.customSongs.filter(s=>s.id!==id);
  else S.deleted.push(id);
  delete S.progress[id]; save(); renderBook(); toast('已刪除');
}

function openSongForm(s){
  editingSong = s || null;
  const p = curProg(); const v = s || {p:p.id, k:''};
  const st = s ? prog(s.id) : {};
  const f = $('songForm'); f.hidden=false;
  f.innerHTML = `<form class="panel" id="sf"><h3>${s?'編輯歌曲':'新增歌曲'}</h3>
    <div class="grid2">
      <label class="f">歌名<input id="sf-t" required value="${esc(v.t)}"></label>
      <label class="f">歌手<input id="sf-a" value="${esc(v.a)}"></label>
      <label class="f">原調<select id="sf-k"><option value="">待查</option><optgroup label="大調">${KEYS.map(k=>`<option value="${k}" ${v.k===k?'selected':''}>${pretty(k)}</option>`).join('')}</optgroup><optgroup label="小調">${KEYS.map(k=>`<option value="${k}m" ${v.k===k+'m'?'selected':''}>${pretty(k)}m</option>`).join('')}</optgroup></select></label>
      <label class="f">級數進行<select id="sf-p">${progs().map(x=>`<option value="${esc(x.id)}" ${x.id===v.p?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="f">出現段落<input id="sf-s" placeholder="例：副歌" value="${esc(v.s)}"></label>
      <label class="f">這首的級數寫法<input id="sf-pt" placeholder="例：I–V–vi–IV" value="${esc(v.pt)}"></label>
    </div>
    <label class="f">吉他譜連結<input id="sf-tab" type="url" placeholder="雲端硬碟或網站上的譜" value="${esc(v.tab)}"></label>
    <label class="f">我的筆記<textarea id="sf-memo" rows="2" placeholder="節奏型、卡關的地方…">${esc(st.memo)}</textarea></label>
    <p class="hint">小調的歌請在「小調」裡選，例如 A 小調選 Am。</p>
    <div class="actions"><button type="button" class="ghost" id="sf-x">取消</button><button class="primary">${s?'儲存':'加入歌單'}</button></div></form>`;
  $('sf-x').onclick=()=>{ f.hidden=true; f.innerHTML=''; };
  $('sf').onsubmit = e => {
    e.preventDefault();
    const data = { t:$('sf-t').value.trim(), a:$('sf-a').value.trim(), k:$('sf-k').value, p:$('sf-p').value, s:$('sf-s').value.trim(), pt:$('sf-pt').value.trim(), tab:$('sf-tab').value.trim() };
    if(!data.t) return;
    const memo = $('sf-memo').value.trim();
    let id;
    if(editingSong){
      id = editingSong.id;
      const ci = S.customSongs.findIndex(x=>x.id===id);
      if(ci>=0) S.customSongs[ci] = {...S.customSongs[ci], ...data};
      else S.edits[id] = {...(S.edits[id]||{}), ...data};
    } else {
      id = 'u' + Date.now().toString(36);
      S.customSongs.push({id, n:'', ...data});
    }
    S.progress[id] = {...prog(id), memo};
    S.settings.sel = data.p; save();
    f.hidden=true; f.innerHTML=''; renderBook(); toast(editingSong?'已儲存':'已加入歌單');
  };
  f.scrollIntoView({behavior:'smooth',block:'start'}); $('sf-t').focus({preventScroll:true});
}
$('addSongBtn').onclick = () => openSongForm();

function openProgForm(p){
  const f = $('progForm'); f.hidden=false; const v = p || {mode:'major'};
  f.innerHTML = `<form class="panel" id="pf"><h3>${p?'編輯自訂進行':'新增自訂進行'}</h3>
    <label class="f">名稱<input id="pf-n" required placeholder="例：日系 I–V–iii–IV" value="${esc(v.name)}"></label>
    <label class="f">級數<input id="pf-nums" required placeholder="I V iii IV" value="${esc((v.nums||[]).join(' '))}">
      <span class="hint">用空白分開。大寫＝大三和弦、小寫＝小三和弦；可加 b（降）、7、maj7、sus4、°。</span></label>
    <label class="f">調式<select id="pf-m"><option value="major" ${v.mode!=='minor'?'selected':''}>大調</option><option value="minor" ${v.mode==='minor'?'selected':''}>小調（i 為主和弦）</option></select></label>
    <label class="f">說明<input id="pf-d" value="${esc(v.desc)}"></label>
    <div class="err" id="pf-err" hidden></div>
    <div class="actions">${p?`<button type="button" class="danger-btn" id="pf-del">刪除這組</button>`:''}<button type="button" class="ghost" id="pf-x">取消</button><button class="primary">${p?'儲存':'建立'}</button></div></form>`;
  $('pf-x').onclick=()=>{ f.hidden=true; f.innerHTML=''; };
  const del=$('pf-del'); if(del){ let armed=false; del.onclick=()=>{ if(!armed){ armed=true; del.textContent='確定刪除？再按一次'; return; }
    S.customProgs = S.customProgs.filter(x=>x.id!==p.id); S.settings.sel='canon'; save(); f.hidden=true; f.innerHTML=''; renderBook(); toast('已刪除這組進行'); }; }
  $('pf').onsubmit = e => {
    e.preventDefault();
    const nums = splitNums($('pf-nums').value), bad = nums.filter(n=>!parseNum(n));
    if(!nums.length || bad.length){ const er=$('pf-err'); er.hidden=false; er.textContent = bad.length ? `看不懂：${bad.join('、')}。請用 I、ii、IV、vi、bVII 這類寫法。` : '請至少輸入一個級數。'; return; }
    const data = { name:$('pf-n').value.trim(), nums, mode:$('pf-m').value, desc:$('pf-d').value.trim() };
    if(p){ const i=S.customProgs.findIndex(x=>x.id===p.id); S.customProgs[i] = {...S.customProgs[i], ...data}; }
    else { const id='up'+Date.now().toString(36); S.customProgs.push({id, order:100+S.customProgs.length, ...data}); S.settings.sel=id; }
    save(); f.hidden=true; f.innerHTML=''; renderBook(); toast(p?'已儲存':'已建立');
  };
}
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{ filter=b.dataset.f; document.querySelectorAll('.seg button').forEach(x=>x.setAttribute('aria-pressed', x===b)); renderList(); });
$('q').addEventListener('input', e=>{ query=e.target.value; renderList(); });
$('srcSel').addEventListener('change', e=>{ srcFilter=e.target.value; renderList(); });
function renderBook(){ renderChips(); renderBoard(); renderList(); }

/* ---------- 聽音測驗 ---------- */
let Q = null, wrongMode = false;
function quizPool(){ return progs().filter(p=>p.nums.length>=2 && p.nums.length<=8); }
function newQuestion(){
  stopPlay();
  const pool = quizPool();
  let target, key;
  if(wrongMode && S.quiz.wrong.length){
    const w = S.quiz.wrong[Math.floor(Math.random()*S.quiz.wrong.length)];
    target = progById(w.p) || pool[0]; key = KEYS[Math.floor(Math.random()*12)];
  } else {
    if(wrongMode){ wrongMode=false; toast('錯題都練完了，回到一般題目'); }
    target = pool[Math.floor(Math.random()*pool.length)]; key = KEYS[Math.floor(Math.random()*12)];
  }
  const others = pool.filter(p=>p.id!==target.id).sort(()=>Math.random()-.5).slice(0,3);
  Q = { target, key, opts:[target,...others].sort(()=>Math.random()-.5), answered:false };
  renderQuiz();
}
function renderQuiz(){
  if(!Q) newQuestion();
  $('quizKeyLabel').textContent = $('quizShowKey').checked ? `（${keyLabel(Q.key, Q.target.mode) || pretty(Q.key)}）` : '';
  $('quizOpts').innerHTML = Q.opts.map(p=>`<button class="opt" data-id="${esc(p.id)}"><span>${esc(p.name)}</span><small>${esc(p.nums.join(' ').replace(/\bb/g,'♭'))}</small></button>`).join('');
  $('quizFb').textContent=''; $('quizFb').className='feedback';
  $('quizOpts').querySelectorAll('.opt').forEach(b=>b.onclick=()=>answer(b));
  renderWrong(); renderQuizStats();
}
function playQuestion(){
  const ch = Q.target.nums.map(n=>chordOf(n, Q.key));
  playProgression(ch, { bpm:96, beats:2, loop:false, pattern:'strum' });
  playing.tag='quiz';
}
function answer(btn){
  if(Q.answered) return;
  Q.answered = true;
  const ok = btn.dataset.id === Q.target.id;
  S.quiz.total++; if(ok) S.quiz.right++;
  $('quizOpts').querySelectorAll('.opt').forEach(b=>{ if(b.dataset.id===Q.target.id) b.classList.add('right'); else if(b===btn) b.classList.add('wrong'); });
  const fb = $('quizFb');
  const w = S.quiz.wrong.find(x=>x.p===Q.target.id);
  if(ok){
    fb.textContent = `答對了！這是 ${Q.target.name}（${keyLabel(Q.key,Q.target.mode)||pretty(Q.key)}）。`; fb.className='feedback ok';
    if(w){ w.streak=(w.streak||0)+1; if(w.streak>=2){ S.quiz.wrong=S.quiz.wrong.filter(x=>x!==w); fb.textContent+=' 這題從錯題本畢業了。'; } }
  } else {
    const picked = progById(btn.dataset.id);
    fb.textContent = `不是 ${picked?picked.name:''}，正確答案是 ${Q.target.name}（${keyLabel(Q.key,Q.target.mode)||pretty(Q.key)}）。可以再聽一次比較看看。`; fb.className='feedback no';
    if(w){ w.streak=0; w.miss=(w.miss||0)+1; } else S.quiz.wrong.push({p:Q.target.id, miss:1, streak:0});
  }
  touchDay(); save(); renderWrong(); renderQuizStats(); renderHeader();
}
function renderQuizStats(){
  $('qTotal').textContent=S.quiz.total; $('qRight').textContent=S.quiz.right;
  $('qRate').textContent = S.quiz.total ? Math.round(S.quiz.right/S.quiz.total*100)+'%' : '–';
}
function renderWrong(){
  const el = $('wrongList');
  if(!S.quiz.wrong.length){ el.innerHTML='<p class="hint" style="margin:0">目前沒有錯題。</p>'; $('wrongPractice').hidden=true; return; }
  $('wrongPractice').hidden=false;
  el.innerHTML = S.quiz.wrong.map(w=>{ const p=progById(w.p); if(!p) return ''; return `<div class="wrong-item"><span>${esc(p.name)} <small class="hint">錯 ${w.miss||1} 次・連對 ${w.streak||0}/2</small></span><button class="ghost" data-listen="${esc(p.id)}">聽 C 調</button></div>`; }).join('');
  el.querySelectorAll('[data-listen]').forEach(b=>b.onclick=()=>{ const p=progById(b.dataset.listen); playProgression(p.nums.map(n=>chordOf(n, p.mode==='minor'?'A':'C')), {bpm:96,beats:2,pattern:'strum'}); });
}
$('quizPlay').onclick = () => { audio(); playQuestion(); };
$('quizNext').onclick = () => { newQuestion(); };
$('quizShowKey').onchange = () => { $('quizKeyLabel').textContent = $('quizShowKey').checked ? `（${keyLabel(Q.key, Q.target.mode) || pretty(Q.key)}）` : ''; };
$('wrongPractice').onclick = () => { wrongMode = true; newQuestion(); toast('錯題練習模式'); };

/* ---------- 進度 ---------- */
let timerStart = null, timerAcc = 0, timerTick = null;
function fmt(sec){ return `${pad(Math.floor(sec/60))}:${pad(Math.floor(sec%60))}`; }
function streak(){
  let n=0; const d=new Date();
  const has = x => (S.log[x]||0)>0 || Object.values(S.progress).some(p=>p.last===x);
  if(!has(dstr(d))) d.setDate(d.getDate()-1);
  while(has(dstr(d))){ n++; d.setDate(d.getDate()-1); }
  return n;
}
function renderHeader(){ $('hdStreak').textContent=streak(); $('hdToday').textContent=Math.round(S.log[today()]||0); }
function renderStats(){
  const t = S.log[today()]||0, goal = S.settings.goal||30;
  $('stToday').textContent=Math.round(t); $('stGoal').textContent=goal; $('stStreak').textContent=streak();
  $('goalBar').style.width = Math.min(100, t/goal*100)+'%';
  let week=0; const d=new Date(); for(let i=0;i<7;i++){ week+=S.log[dstr(d)]||0; d.setDate(d.getDate()-1); }
  $('stWeek').textContent=Math.round(week);
  const days=[]; const d2=new Date(); d2.setDate(d2.getDate()-13);
  for(let i=0;i<14;i++){ days.push(dstr(d2)); d2.setDate(d2.getDate()+1); }
  const max = Math.max(goal, ...days.map(x=>S.log[x]||0));
  $('days').innerHTML = days.map(x=>{ const v=S.log[x]||0; return `<div class="day" title="${x} ${Math.round(v)} 分"><i class="${v?'':'zero'}" style="height:${Math.max(2, v/max*70)}px"></i><span>${+x.slice(8)}</span></div>`; }).join('');
  const all = songs();
  $('progRows').innerHTML = progs().map(p=>{
    const l = all.filter(s=>s.p===p.id), n=l.length||1;
    const s=l.filter(x=>prog(x.id).s).length, c=l.filter(x=>prog(x.id).c&&!prog(x.id).s).length, h=l.filter(x=>prog(x.id).h&&!prog(x.id).c&&!prog(x.id).s).length;
    return `<div class="prog-row"><span>${esc(p.name)}</span><span class="hint">${s}/${l.length} 首會彈唱</span>
      <div class="bars"><i style="width:${s/n*100}%;background:var(--s3)"></i><i style="width:${c/n*100}%;background:var(--s2)"></i><i style="width:${h/n*100}%;background:var(--s1)"></i></div></div>`;
  }).join('');
  $('timer').textContent = fmt(curTimer());
}
function curTimer(){ return timerAcc + (timerStart ? (Date.now()-timerStart)/1000 : 0); }
function stopTimer(){
  if(!timerStart) return;
  const sec = curTimer(); timerStart=null; clearInterval(timerTick);
  const min = sec/60; if(min>=0.5){ logPractice(Math.round(min*10)/10); save(); toast(`記下 ${Math.round(min)} 分鐘`); }
  timerAcc=0; $('timerBtn').textContent='開始計時'; renderStats(); renderHeader();
}
$('timerBtn').onclick = () => {
  if(timerStart){ stopTimer(); return; }
  timerStart = Date.now(); $('timerBtn').textContent='停止並記錄';
  timerTick = setInterval(()=>{ $('timer').textContent = fmt(curTimer()); }, 500);
};
$('timerAdd').onclick = () => { logPractice(10); save(); renderStats(); renderHeader(); toast('已加 10 分鐘'); };

/* ---------- 雲端同步 ---------- */
function setSync(state, msg){ $('syncDot').className='sync-dot '+(state||''); if(msg!==undefined) $('syncStatus').textContent=msg; }
async function gas(payload){
  const url = S.settings.gasUrl; if(!url) throw new Error('nourl');
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload), redirect:'follow' });
  if(!r.ok) throw new Error('http '+r.status);
  const j = await r.json(); if(!j.ok) throw new Error(j.error||'gas'); return j;
}
function snapshot(){ return {...S, settings:{...S.settings, gasUrl:''}}; }
function tables(){
  const all = songs();
  return {
    progs: progs().map(p=>[p.id, p.name, p.nums.join(' '), p.mode, p.desc||'']),
    songs: all.map(s=>{ const p=progById(s.p), st=prog(s.id); return [s.id, p?p.name:s.p, s.t, s.a, (songKey(s.k,p&&p.mode)||{label:'待查'}).label, s.s||'', st.h?'✔':'', st.c?'✔':'', st.s?'✔':'', st.last||'', st.memo||'', s.tab||'', srcLabel(s)]; }),
    log: Object.entries(S.log).sort().map(([d,m])=>[d, Math.round(m*10)/10])
  };
}
async function push(){
  if(!S.settings.gasUrl) return;
  setSync('busy');
  try{
    const j = await gas({action:'save', state:snapshot(), tables:tables()});
    if(j.skipped && j.state){ const url=S.settings.gasUrl; S=merge(blank(), j.state); S.settings.gasUrl=url; save(false); renderAll(); setSync('ok','雲端有較新的紀錄，已改用雲端版本'); return; }
    setSync('ok', '已同步：'+new Date().toLocaleTimeString());
  }
  catch(e){ setSync('err', '同步失敗，資料仍存在這支手機。請檢查網址或網路。'); }
}
async function pull(silent){
  if(!S.settings.gasUrl) return;
  setSync('busy');
  try{
    const j = await gas({action:'load'});
    if(j.state && (j.state.updatedAt||0) > (S.updatedAt||0)){
      const url = S.settings.gasUrl; S = merge(blank(), j.state); S.settings.gasUrl = url; save(false);
      renderAll(); setSync('ok', '已從雲端載入較新的紀錄');
      if(!silent) toast('已載入雲端紀錄');
    } else { setSync('ok', '雲端與這支手機一致'); if(!silent) toast('這支手機的紀錄已是最新'); if((S.updatedAt||0) > ((j.state&&j.state.updatedAt)||0)) push(); }
  }catch(e){ setSync('err', '無法連上雲端，先用這支手機的紀錄。'); }
}

/* ---------- 設定 ---------- */
function renderSettings(){
  $('gasUrl').value = S.settings.gasUrl||''; $('goalMin').value = S.settings.goal||30; $('beatsPer').value = String(S.settings.beats||4);
  $('ver').textContent = APP_VERSION;
}
$('syncSave').onclick = async () => {
  const u = $('gasUrl').value.trim();
  if(u && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(u)){ $('syncStatus').textContent='網址格式不對，應該是 https://script.google.com/macros/s/…/exec'; return; }
  S.settings.gasUrl = u; save(false);
  if(!u){ setSync('', '已關閉雲端同步'); return; }
  await pull(true); await push();
};
$('syncPull').onclick = () => { S.settings.gasUrl = $('gasUrl').value.trim(); save(false); pull(false); };
$('goalMin').onchange = e => { S.settings.goal = Math.max(5, +e.target.value||30); save(); };
$('beatsPer').onchange = e => { S.settings.beats = +e.target.value; save(false); };
$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(snapshot(), null, 1)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `級數練習本備份-${today()}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
};
$('importFile').onchange = async e => {
  const file = e.target.files[0]; if(!file) return;
  try{ const o = JSON.parse(await file.text()); const url=S.settings.gasUrl; S = merge(blank(), o); S.settings.gasUrl=url; save(); renderAll(); toast('已匯入備份'); }
  catch(err){ toast('這個檔案不是級數練習本的備份'); }
  e.target.value='';
};
let resetArmed=false;
$('resetBtn').onclick = () => {
  if(!resetArmed){ resetArmed=true; $('resetBtn').textContent='確定清除？再按一次（雲端資料不受影響）'; setTimeout(()=>{ resetArmed=false; $('resetBtn').textContent='清除這支手機上的紀錄'; }, 5000); return; }
  const url=S.settings.gasUrl; S=blank(); S.settings.gasUrl=url; save(false); renderAll(); toast('已清除');
};

/* ---------- 分頁 ---------- */
const VIEWS = {book:'view-book', ear:'view-ear', stats:'view-stats', set:'view-set'};
function go(tab){
  if(!VIEWS[tab]) tab='book';
  document.querySelectorAll('[data-view]').forEach(v=>v.hidden = v.id!==VIEWS[tab]);
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected', b.dataset.tab===tab));
  if(tab!=='book' && playing && playing.tag==='board'){ stopPlay(); }
  if(tab==='ear') renderQuiz(); if(tab==='stats') renderStats(); if(tab==='set') renderSettings(); if(tab==='book') renderBook();
  if(location.hash.slice(1)!==tab) history.replaceState(null,'','#'+tab);
  window.scrollTo(0,0);
}
document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
window.addEventListener('hashchange', ()=>go(location.hash.slice(1)));
function renderAll(){ renderHeader(); go(location.hash.slice(1)||'book'); }

/* ---------- 安裝與離線 ---------- */
let deferred=null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferred=e; $('installBar').hidden=false; });
$('installBtn').onclick = async () => { if(!deferred) return; deferred.prompt(); await deferred.userChoice; deferred=null; $('installBar').hidden=true; };
window.addEventListener('appinstalled', ()=>{ $('installBar').hidden=true; toast('已安裝到桌面'); });
if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ stopPlay(); if(timerStart){ /* 背景時繼續計時 */ } } else if(S.settings.gasUrl) pull(true); });

renderAll();
if(S.settings.gasUrl){ pull(true); }
})();
