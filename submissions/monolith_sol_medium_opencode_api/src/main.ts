import './style.css';
import { circlesCollide, difficultyFor, isPlausibleScore, isValidName } from './rules';

type Phase = 'ready' | 'running' | 'gameover';
type Body = { x:number; y:number; r:number; vx:number; vy:number; color:string; hp?:number; enemy?:boolean };
type Particle = { x:number; y:number; vx:number; vy:number; life:number; color:string };
type ScoreRow = { name:string; score:number };

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const ctx = canvas.getContext('2d')!;
const overlay = document.querySelector<HTMLDivElement>('#game-overlay')!;
const scoreEl = document.querySelector<HTMLElement>('#score')!;
const livesEl = document.querySelector<HTMLElement>('#lives')!;
const startButton = document.querySelector<HTMLButtonElement>('#start-button')!;
const muteButton = document.querySelector<HTMLButtonElement>('#mute-button')!;
const form = document.querySelector<HTMLFormElement>('#score-form')!;
const nameInput = document.querySelector<HTMLInputElement>('#player-name')!;
const formMessage = document.querySelector<HTMLElement>('#form-message')!;
const board = document.querySelector<HTMLElement>('#leaderboard')!;
const W = canvas.width, H = canvas.height;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let phase:Phase='ready', score=0, lives=3, elapsed=0, spawnClock=0, shotClock=0, last=performance.now();
let player={x:W/2,y:H-95,r:17}, enemies:Body[]=[], projectiles:Body[]=[], particles:Particle[]=[];
const keys=new Set<string>();
const stars=Array.from({length:95},()=>({x:Math.random()*W,y:Math.random()*H,s:Math.random()*2+.4,v:Math.random()*35+16}));
let audio:AudioContext|null=null, muted=false;

function tone(freq:number,duration=.06,type:OscillatorType='square',volume=.035){
  if(muted)return;
  audio ||= new AudioContext();
  if(audio.state==='suspended') void audio.resume();
  const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);
}
function burst(x:number,y:number,color:string,count=12){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=Math.random()*150+35;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:Math.random()*.45+.2,color});}}
function updateHud(){scoreEl.textContent=score.toString().padStart(6,'0');livesEl.textContent=Array.from({length:lives},()=> '◆').join(' ')||'DEPLETED';}
function startGame(){phase='running';score=0;lives=3;elapsed=0;spawnClock=.6;shotClock=0;player={x:W/2,y:H-95,r:17};enemies=[];projectiles=[];particles=[];form.hidden=true;formMessage.textContent='';nameInput.disabled=false;nameInput.value='';overlay.classList.add('hidden');updateHud();tone(330,.15,'sawtooth',.05);}
function endGame(finalScore=score){if(!isPlausibleScore(finalScore))return;phase='gameover';score=finalScore;updateHud();document.querySelector('#overlay-eyebrow')!.textContent='SIGNAL LOST';document.querySelector('#overlay-title')!.innerHTML=`RUN<br><em>TERMINATED</em>`;document.querySelector('#overlay-copy')!.innerHTML=`Final yield: <strong>${score.toLocaleString()}</strong><br>Transmit your callsign to the network.`;startButton.querySelector('span')!.textContent='REDEPLOY';overlay.classList.remove('hidden');form.hidden=false;tone(90,.45,'sawtooth',.07);}
function spawnEnemy(){const d=difficultyFor(score,elapsed),r=Math.random()*7+13;enemies.push({x:35+Math.random()*(W-70),y:-30,r,vx:(Math.random()-.5)*(35+d*8),vy:45+d*10+Math.random()*24,color:Math.random()>.75?'#ff347d':'#9b62ff',hp:Math.random()<d*.035+0.08?2:1});}
function shoot(){if(shotClock>0)return;projectiles.push({x:player.x,y:player.y-22,r:4,vx:0,vy:-620,color:'#36f4eb'});shotClock=.13;tone(570,.035,'square',.022);}
function damage(){lives--;updateHud();burst(player.x,player.y,'#ff347d',24);document.querySelector('#damage-flash')!.classList.remove('hit');void (document.querySelector('#damage-flash') as HTMLElement).offsetWidth;document.querySelector('#damage-flash')!.classList.add('hit');tone(120,.18,'sawtooth',.06);if(lives<=0)endGame();}
function update(dt:number){
  stars.forEach(s=>{s.y+=s.v*dt;if(s.y>H){s.y=0;s.x=Math.random()*W}});particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);
  if(phase!=='running')return;elapsed+=dt;spawnClock-=dt;shotClock-=dt;
  const speed=320,dx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),dy=(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0);player.x=Math.max(24,Math.min(W-24,player.x+dx*speed*dt));player.y=Math.max(50,Math.min(H-35,player.y+dy*speed*dt));if(keys.has(' ')||keys.has('fire'))shoot();
  if(spawnClock<=0){spawnEnemy();spawnClock=Math.max(.24,1.05-difficultyFor(score,elapsed)*.075)*(.75+Math.random()*.5)}
  for(const e of enemies){e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.x<e.r||e.x>W-e.r)e.vx*=-1;if(Math.random()<dt*(.08+difficultyFor(score,elapsed)*.025))projectiles.push({x:e.x,y:e.y+e.r,r:5,vx:0,vy:220,color:'#ff347d',enemy:true});}
  projectiles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt});
  for(const p of projectiles){if(p.enemy){if(circlesCollide(p,player)){p.y=H+100;damage()}}else for(const e of enemies){if((e.hp||0)>0&&circlesCollide(p,e)){p.y=-100;e.hp=(e.hp||1)-1;if(!e.hp){score+=e.r>17?175:100;updateHud();burst(e.x,e.y,e.color);tone(180,.05,'triangle',.025)}}}}
  for(const e of enemies){if((e.hp||0)>0&&e.y>H+e.r){e.hp=0;damage()}else if((e.hp||0)>0&&circlesCollide(e,player)){e.hp=0;burst(e.x,e.y,e.color);damage()}}
  enemies=enemies.filter(e=>(e.hp||0)>0&&e.y<H+80);projectiles=projectiles.filter(p=>p.y>-40&&p.y<H+40);
}
function drawShip(x:number,y:number){ctx.save();ctx.translate(x,y);ctx.shadowBlur=20;ctx.shadowColor='#36f4eb';ctx.fillStyle='#36f4eb';ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(18,18);ctx.lineTo(6,13);ctx.lineTo(0,21);ctx.lineTo(-6,13);ctx.lineTo(-18,18);ctx.closePath();ctx.fill();ctx.fillStyle='#ff347d';ctx.fillRect(-3,8,6,16);ctx.restore();}
function render(){
  ctx.fillStyle='#050817';ctx.fillRect(0,0,W,H);const glow=ctx.createRadialGradient(W/2,H*.45,0,W/2,H*.45,W*.7);glow.addColorStop(0,'#171346');glow.addColorStop(1,'#050817');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#53608c';for(const s of stars){ctx.globalAlpha=.3+s.s/3;ctx.fillRect(s.x,s.y,s.s,s.s*2)}ctx.globalAlpha=1;
  ctx.strokeStyle='#36f4eb12';ctx.lineWidth=1;for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  if(phase==='running')drawShip(player.x,player.y);
  for(const e of enemies){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(elapsed*.8+e.x);ctx.shadowBlur=16;ctx.shadowColor=e.color;ctx.strokeStyle=e.color;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?e.r*.55:e.r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}ctx.closePath();ctx.stroke();ctx.restore()}
  for(const p of projectiles){ctx.shadowBlur=12;ctx.shadowColor=p.color;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.r/2,p.y-p.r*2,p.r,p.r*4)}ctx.shadowBlur=0;
  for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)}ctx.globalAlpha=1;
}
function loop(now:number){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(loop)}

async function loadScores(){
  if(!SUPABASE_URL||!SUPABASE_KEY){board.innerHTML='<p class="board-state">LEADERBOARD OFFLINE</p>';return}
  board.innerHTML='<p class="board-state">CONTACTING RELAY...</p>';
  try{const r=await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=name,score&order=score.desc,created_at.asc&limit=10`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});if(!r.ok)throw new Error();renderScores(await r.json())}catch{board.innerHTML='<p class="board-state">RELAY UNREACHABLE. GAME SYSTEMS ONLINE.</p>'}
}
function renderScores(rows:ScoreRow[]){board.innerHTML=rows.length?rows.map((row,i)=>`<div class="rank-row"><span class="rank">${String(i+1).padStart(2,'0')}</span><span class="name"></span><span class="points">${row.score.toLocaleString()}</span></div>`).join(''):'<p class="board-state">NO SIGNALS YET. CLAIM FIRST CONTACT.</p>';rows.forEach((row,i)=>{const el=board.children[i]?.querySelector('.name');if(el)el.textContent=row.name})}
form.addEventListener('submit',async e=>{e.preventDefault();const name=nameInput.value.trim();if(!isValidName(name)){formMessage.textContent='USE 1-16 LETTERS, NUMBERS, SPACES, _ OR -';return}if(!isPlausibleScore(score)){formMessage.textContent='INVALID SCORE';return}const button=document.querySelector<HTMLButtonElement>('#submit-score')!;button.disabled=true;formMessage.textContent='TRANSMITTING...';try{const r=await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({name,score})});if(!r.ok)throw new Error();formMessage.textContent='SIGNAL RECEIVED';nameInput.disabled=true;await loadScores()}catch{formMessage.textContent='TRANSMISSION FAILED. RETRY AVAILABLE.'}finally{button.disabled=false}});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k===' '&&phase==='ready')startGame()});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach(b=>{const c=b.dataset.control!;const down=(e:Event)=>{e.preventDefault();keys.add(c);if(c==='fire'&&phase!=='running')startGame()};const up=(e:Event)=>{e.preventDefault();keys.delete(c)};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up)});
startButton.addEventListener('click',startGame);muteButton.addEventListener('click',()=>{muted=!muted;muteButton.textContent=`SOUND: ${muted?'OFF':'ON'}`;if(!muted)tone(440)});
declare global { interface Window { __NEON_BARRAGE__: { getState:()=>{phase:Phase;score:number;lives:number;playerX:number;playerY:number;enemyCount:number;projectileCount:number};endGameForTest:(score:number)=>void } } }
window.__NEON_BARRAGE__={getState:()=>({phase,score,lives,playerX:player.x,playerY:player.y,enemyCount:enemies.length,projectileCount:projectiles.length}),endGameForTest:endGame};
updateHud();void loadScores();requestAnimationFrame(loop);
