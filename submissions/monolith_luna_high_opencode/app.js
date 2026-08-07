(() => {
  'use strict';
  const canvas = document.querySelector('[data-testid="game-canvas"]');
  const ctx = canvas.getContext('2d');
  const W = 900, H = 525;
  let phase = 'ready', score = 0, lives = 3, wave = 1, player, enemies = [], shots = [], enemyShots = [], particles = [], stars = [], last = 0, spawnTimer = 0, fireTimer = 0, shake = 0, muted = false, audio;
  const input = {left:false,right:false,up:false,down:false,fire:false};
  const $ = id => document.getElementById(id);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const format = n => String(Math.max(0,Math.floor(n))).padStart(6,'0');
  const rand = (a,b) => a + Math.random() * (b-a);
  for(let i=0;i<90;i++) stars.push({x:Math.random()*W,y:Math.random()*H,z:Math.random()*2+.3});
  function resize(){ const r=canvas.getBoundingClientRect(); canvas.width=W; canvas.height=H; canvas.style.aspectRatio=`${W}/${H}`; }
  window.addEventListener('resize',resize); resize();
  function tone(freq,duration,type='sine',volume=.035){ if(muted)return; if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)(); const o=audio.createOscillator(),g=audio.createGain(); o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration); }
  function setHud(){ $('score').textContent=format(score); $('lives').textContent='♥ '.repeat(lives).trim() || '—'; $('wave').textContent=String(wave).padStart(2,'0'); }
  function reset(){ score=0;lives=3;wave=1;spawnTimer=0;fireTimer=0;shake=0;enemies=[];shots=[];enemyShots=[];particles=[];player={x:W/2,y:H-72,r:16,inv:0};setHud(); }
  function start(){ if(audio&&audio.state==='suspended')audio.resume(); reset();phase='playing';$('start-overlay').classList.add('hidden');$('game-over-overlay').classList.add('hidden');$('status-text').textContent='MISSION ACTIVE';tone(300,.12,'square'); }
  function endGame(finalScore=score){ score=Math.max(0,Math.floor(Number(finalScore)||0));phase='over';setHud();$('final-score').textContent=format(score);$('game-over-overlay').classList.remove('hidden');$('status-text').textContent='SIGNAL LOST';tone(90,.3,'sawtooth'); }
  function burst(x,y,color,n=10){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-100,100),vy:rand(-100,100),life:rand(.25,.7),max:.7,color});}
  function spawn(){const kind=Math.random()<.18?'tank':'drone';enemies.push({x:rand(35,W-35),y:-25,r:kind==='tank'?18:13,hp:kind==='tank'?2:1,kind,vx:rand(-25,25),vy:rand(42,65)+wave*4,phase:Math.random()*7});}
  function shoot(){shots.push({x:player.x,y:player.y-20,vy:-500});fireTimer=.18;tone(650,.045,'square',.018);}
  function damage(){if(player.inv>0)return;lives--;player.inv=1.6;shake=8;burst(player.x,player.y,'#ff4da6',20);tone(120,.2,'sawtooth');setHud();if(lives<=0)endGame(score);}
  function update(dt){
    if(phase!=='playing')return;
    const dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0); player.x=clamp(player.x+dx*285*dt,24,W-24);player.y=clamp(player.y+dy*230*dt,H*.48,H-28);player.inv=Math.max(0,player.inv-dt);
    fireTimer-=dt;if(input.fire&&fireTimer<=0)shoot();spawnTimer-=dt;if(spawnTimer<=0){spawn();spawnTimer=Math.max(.25, .85-wave*.035);}
    wave=1+Math.floor(score/1000);setHud();
    shots.forEach(s=>s.y+=s.vy*dt);shots=shots.filter(s=>s.y>-20);
    enemies.forEach(e=>{e.y+=e.vy*dt;e.x+=Math.sin(e.phase+e.y*.015)*e.vx*dt;if(e.y>H+30){e.dead=true;damage();}});
    enemyShots.forEach(s=>{s.y+=s.vy*dt;if(Math.hypot(s.x-player.x,s.y-player.y)<15){s.dead=true;damage();}});enemyShots=enemyShots.filter(s=>!s.dead&&s.y<H+20);
    enemies.forEach(e=>{if(e.dead)return;if(e.kind==='tank'&&Math.random()<dt*.35)enemyShots.push({x:e.x,y:e.y,vy:130+wave*4});shots.forEach(s=>{if(!s.dead&&Math.hypot(s.x-e.x,s.y-e.y)<e.r+5){s.dead=true;e.hp--;burst(s.x,s.y,'#47e8f4',4);if(e.hp<=0){e.dead=true;score+=e.kind==='tank'?250:100;burst(e.x,e.y,e.kind==='tank'?'#ffda70':'#ff4da6',14);tone(e.kind==='tank'?180:240,.09,'triangle');}}});if(!e.dead&&Math.hypot(e.x-player.x,e.y-player.y)<e.r+13) {e.dead=true;damage();}});shots=shots.filter(s=>!s.dead);enemies=enemies.filter(e=>!e.dead);
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt});particles=particles.filter(p=>p.life>0);shake=Math.max(0,shake-dt*20);
    stars.forEach(s=>{s.y+=(18+s.z*28+wave*2)*dt;if(s.y>H)s.y=0;});
  }
  function draw(){ctx.save();ctx.fillStyle='#070c25';ctx.fillRect(0,0,W,H);ctx.translate(rand(-shake,shake),rand(-shake,shake));
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#101943');g.addColorStop(.45,'#080e2b');g.addColorStop(1,'#09091c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.28;ctx.strokeStyle='#24345b';ctx.lineWidth=1;for(let x=0;x<W;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.globalAlpha=1;
    stars.forEach(s=>{ctx.fillStyle=s.z>1.5?'#47e8f4':'#6672a3';ctx.globalAlpha=.3+s.z*.25;ctx.fillRect(s.x,s.y,s.z*1.5,s.z*1.5)});ctx.globalAlpha=1;
    enemies.forEach(e=>{ctx.save();ctx.translate(e.x,e.y);ctx.rotate(Math.sin(e.y*.01)*.2);ctx.shadowBlur=15;ctx.shadowColor=e.kind==='tank'?'#ffda70':'#ff4da6';ctx.strokeStyle=e.kind==='tank'?'#ffda70':'#ff4da6';ctx.fillStyle=e.kind==='tank'?'#4f3040':'#371f51';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-e.r);ctx.lineTo(e.r,e.r*.7);ctx.lineTo(0,e.r*.35);ctx.lineTo(-e.r,e.r*.7);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(-3,-3,6,6);ctx.restore()});
    enemyShots.forEach(s=>{ctx.fillStyle='#ffda70';ctx.shadowBlur=10;ctx.shadowColor='#ffda70';ctx.fillRect(s.x-2,s.y-7,4,14)});ctx.shadowBlur=0;
    shots.forEach(s=>{ctx.fillStyle='#47e8f4';ctx.shadowBlur=14;ctx.shadowColor='#47e8f4';ctx.fillRect(s.x-2,s.y-12,4,15)});ctx.shadowBlur=0;
    if(player&&phase!=='over'){ctx.save();ctx.translate(player.x,player.y);if(player.inv>0&&Math.floor(player.inv*10)%2===0)ctx.globalAlpha=.35;ctx.shadowBlur=22;ctx.shadowColor='#47e8f4';ctx.fillStyle='#47e8f4';ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(17,15);ctx.lineTo(0,10);ctx.lineTo(-17,15);ctx.closePath();ctx.fill();ctx.fillStyle='#f5f7ff';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(6,8);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();ctx.fillStyle='#ff4da6';ctx.fillRect(-3,13,6,8+Math.random()*8);ctx.restore()}
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4)});ctx.globalAlpha=1;ctx.restore();
  }
  function loop(t){const dt=Math.min(.04,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
  const keyMap={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down',' ':'fire'};
  window.addEventListener('keydown',e=>{const k=keyMap[e.key];if(k){e.preventDefault();input[k]=true;if(phase==='ready'&&k==='fire')start()}});window.addEventListener('keyup',e=>{const k=keyMap[e.key];if(k){e.preventDefault();input[k]=false}});
  document.querySelectorAll('[data-control]').forEach(b=>{const k=b.dataset.control;const on=e=>{e.preventDefault();input[k]=true;b.classList.add('active');if(phase==='ready')start()};const off=e=>{e.preventDefault();input[k]=false;b.classList.remove('active')};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
  $('start-button').onclick=start;$('restart-button').onclick=start;$('mute-button').onclick=()=>{muted=!muted;$('mute-button').innerHTML=muted?'◖ <span>Sound off</span>':'◖ <span>Sound on</span>';if(!muted)tone(500,.06)};
  async function loadScores(){const cfg=window.NEON_CONFIG||{};if(!cfg.supabaseUrl){$('leaderboard-status').textContent='Leaderboard offline';return}try{const r=await fetch(`${cfg.supabaseUrl}/rest/v1/scores?select=player_name,score&order=score.desc&limit=10`,{headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`}});if(!r.ok)throw Error();const rows=await r.json();$('leaderboard-status').textContent=rows.length?'':'No scores yet';$('leaderboard').innerHTML=rows.map((x,i)=>`<li><span class="rank">${String(i+1).padStart(2,'0')}</span><span class="pilot">${escapeHtml(x.player_name)}</span><span class="points">${format(x.score)}</span></li>`).join('')}catch(e){$('leaderboard-status').textContent='Scores temporarily unavailable'}}
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;', '"':'&quot;'}[c]))}
  $('submit-score').onclick=async()=>{const name=$('player-name').value.trim();const status=$('form-status');if(!/^[A-Za-z0-9 _-]{1,16}$/.test(name)){status.textContent='Use 1-16 letters, numbers, spaces, _ or -';status.className='form-status error';return}const cfg=window.NEON_CONFIG||{};if(!cfg.supabaseUrl){status.textContent='Leaderboard is not configured';status.className='form-status error';return}const button=$('submit-score');button.disabled=true;status.textContent='Transmitting...';try{const r=await fetch(`${cfg.supabaseUrl}/rest/v1/scores`,{method:'POST',headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({player_name:name,score:Math.floor(score)})});if(!r.ok)throw Error();status.textContent='Score recorded in the hall of fame';status.className='form-status success';button.textContent='Sent';await loadScores()}catch(e){status.textContent='Transmission failed. Try again.';status.className='form-status error';button.disabled=false}};
  window.__NEON_BARRAGE__={getState:()=>({phase,score,lives,playerX:player?.x||0,playerY:player?.y||0,enemyCount:enemies.length,projectileCount:shots.length}),endGameForTest:(n)=>{if(!player)reset();endGame(Number.isInteger(n)&&n>=0?n:0)}};
  loadScores();
})();
