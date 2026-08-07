(function () {
  'use strict';

  const config = window.NEON_BARRAGE_CONFIG || { url: '', anonKey: '' };
  const canvas = document.querySelector('[data-testid="game-canvas"]');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.querySelector('[data-testid="score"]');
  const livesEl = document.querySelector('[data-testid="lives"]');
  const waveEl = document.querySelector('#wave');
  const statusEl = document.querySelector('#game-status');
  const readyOverlay = document.querySelector('#ready-overlay');
  const gameoverOverlay = document.querySelector('#gameover-overlay');
  const startButton = document.querySelector('[data-testid="start-button"]');
  const restartButton = document.querySelector('#restart-button');
  const finalScoreEl = document.querySelector('#final-score');
  const scoreForm = document.querySelector('#score-form');
  const nameInput = document.querySelector('[data-testid="player-name"]');
  const submitButton = document.querySelector('[data-testid="submit-score"]');
  const formMessage = document.querySelector('#form-message');
  const leaderboardEl = document.querySelector('[data-testid="leaderboard"]');
  const muteButton = document.querySelector('[data-testid="mute-button"]');
  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const touch = { up: false, down: false, left: false, right: false, fire: false };
  let audioContext = null;
  let muted = false;
  let lastTime = 0;
  let spawnClock = 0;
  let enemyShotClock = 0;
  let shake = 0;
  let state = { phase: 'ready', score: 0, lives: 3, playerX: W / 2, playerY: H - 76, enemyCount: 0, projectileCount: 0 };
  let player;
  let enemies = [];
  let projectiles = [];
  let enemyProjectiles = [];
  let particles = [];
  let stars = [];

  for (let i = 0; i < 90; i += 1) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + .25, a: Math.random() * .7 + .15, speed: Math.random() * 12 + 4 });

  function formatScore(value) { return String(Math.max(0, Math.floor(value))).padStart(6, '0'); }
  function updateHud() {
    scoreEl.textContent = formatScore(state.score);
    livesEl.textContent = '◆ '.repeat(Math.max(0, state.lives)).trim() || '—';
    waveEl.textContent = String(1 + Math.floor(state.score / 300)).padStart(2, '0');
    state.playerX = player ? Math.round(player.x) : state.playerX;
    state.playerY = player ? Math.round(player.y) : state.playerY;
    state.enemyCount = enemies.length;
    state.projectileCount = projectiles.length + enemyProjectiles.length;
  }
  function setStatus(message) { statusEl.textContent = message; }
  function ensureAudio() {
    if (!audioContext) { const AudioCtor = window.AudioContext || window.webkitAudioContext; if (AudioCtor) audioContext = new AudioCtor(); }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
  }
  function tone(frequency, duration, type, volume) {
    if (muted || !audioContext) return;
    const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
    oscillator.type = type || 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(volume || .025, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  }
  function burst(x, y, color, amount) {
    for (let i = 0; i < amount; i += 1) { const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 130 + 35; particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: Math.random() * .5 + .3, max: .8, color, size: Math.random() * 3 + 1 }); }
  }
  function resetGame() {
    state.phase = 'running'; state.score = 0; state.lives = 3; spawnClock = .5; enemyShotClock = 1; shake = 0;
    player = { x: W / 2, y: H - 76, speed: 330, cooldown: 0, invulnerable: 0, flash: 0 };
    enemies = []; projectiles = []; enemyProjectiles = []; particles = [];
    readyOverlay.classList.add('is-hidden'); gameoverOverlay.classList.add('is-hidden'); startButton.textContent = 'Launch mission ↗';
    setStatus('Mission live · destroy incoming hostiles'); updateHud(); ensureAudio(); tone(260, .12, 'square', .04); tone(520, .2, 'square', .025);
  }
  function startGame() { resetGame(); }
  function endGame(scoreOverride) {
    if (state.phase === 'gameover') return;
    if (Number.isFinite(scoreOverride)) state.score = Math.max(0, Math.floor(scoreOverride));
    state.phase = 'gameover'; state.lives = 0; if (player) burst(player.x, player.y, '#ff4f9a', 26); shake = 12;
    finalScoreEl.textContent = formatScore(state.score); gameoverOverlay.classList.remove('is-hidden'); readyOverlay.classList.add('is-hidden'); setStatus('Signal lost · transmit your score or replay'); updateHud(); tone(180, .25, 'sawtooth', .045); tone(90, .45, 'sawtooth', .03);
  }
  function spawnEnemy() {
    const wave = 1 + Math.floor(state.score / 300); const elite = Math.random() < Math.min(.28, wave * .025);
    enemies.push({ x: 38 + Math.random() * (W - 76), y: -30, radius: elite ? 18 : 13, hp: elite ? 2 : 1, maxHp: elite ? 2 : 1, speed: 52 + wave * 6 + Math.random() * 32, phase: Math.random() * Math.PI * 2, drift: (Math.random() - .5) * (25 + wave * 2), elite });
  }
  function fire() {
    if (!player || player.cooldown > 0) return;
    player.cooldown = .16; projectiles.push({ x: player.x, y: player.y - 19, vx: 0, vy: -570, radius: 3, color: '#5df5ed' }); tone(680, .045, 'square', .018);
  }
  function hitPlayer() {
    if (!player || player.invulnerable > 0) return;
    state.lives -= 1; player.invulnerable = 1.35; player.flash = .25; shake = 8; burst(player.x, player.y, '#ff4f9a', 15); tone(110, .22, 'sawtooth', .05); updateHud();
    if (state.lives <= 0) endGame();
  }
  function update(dt) {
    stars.forEach((star) => { star.y += star.speed * dt; if (star.y > H) { star.y = 0; star.x = Math.random() * W; } });
    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .98; p.vy *= .98; p.life -= dt; }); particles = particles.filter((p) => p.life > 0);
    if (state.phase !== 'running') { updateHud(); return; }
    const moveX = (keys.has('ArrowRight') || keys.has('d') || touch.right ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') || touch.left ? 1 : 0);
    const moveY = (keys.has('ArrowDown') || keys.has('s') || touch.down ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') || touch.up ? 1 : 0);
    const magnitude = Math.hypot(moveX, moveY) || 1; player.x = Math.max(24, Math.min(W - 24, player.x + moveX / magnitude * player.speed * dt)); player.y = Math.max(28, Math.min(H - 28, player.y + moveY / magnitude * player.speed * dt));
    player.cooldown = Math.max(0, player.cooldown - dt); player.invulnerable = Math.max(0, player.invulnerable - dt); player.flash = Math.max(0, player.flash - dt);
    if (keys.has(' ') || touch.fire) fire();
    const wave = 1 + Math.floor(state.score / 300); spawnClock -= dt;
    if (spawnClock <= 0) { spawnEnemy(); spawnClock = Math.max(.24, .82 - wave * .045); }
    enemyShotClock -= dt; if (enemyShotClock <= 0 && enemies.length) { const shooter = enemies[Math.floor(Math.random() * enemies.length)]; enemyProjectiles.push({ x: shooter.x, y: shooter.y + 10, vx: (player.x - shooter.x) * .08, vy: 170 + wave * 11, radius: 4, color: '#ff4f9a' }); enemyShotClock = Math.max(.25, 1.6 - wave * .07); }
    enemies.forEach((enemy) => { enemy.y += enemy.speed * dt; enemy.x += (enemy.drift + Math.sin(performance.now() / 700 + enemy.phase) * 24) * dt; if (enemy.x < 20 || enemy.x > W - 20) enemy.drift *= -1; if (enemy.y > H + 25) { enemy.dead = true; hitPlayer(); } });
    projectiles.forEach((bullet) => { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; });
    enemyProjectiles.forEach((bullet) => { bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < bullet.radius + 15) { bullet.dead = true; hitPlayer(); } });
    projectiles.forEach((bullet) => { enemies.forEach((enemy) => { if (!bullet.dead && !enemy.dead && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.radius + enemy.radius) { bullet.dead = true; enemy.hp -= 1; burst(bullet.x, bullet.y, enemy.elite ? '#ffd166' : '#ff4f9a', 5); if (enemy.hp <= 0) { enemy.dead = true; state.score += enemy.elite ? 80 : 30; burst(enemy.x, enemy.y, enemy.elite ? '#ffd166' : '#ff4f9a', enemy.elite ? 18 : 11); tone(enemy.elite ? 240 : 390, .1, 'triangle', .035); } } }); });
    enemies = enemies.filter((enemy) => !enemy.dead); projectiles = projectiles.filter((bullet) => !bullet.dead && bullet.y > -20); enemyProjectiles = enemyProjectiles.filter((bullet) => !bullet.dead && bullet.y < H + 20); shake = Math.max(0, shake - dt * 24); updateHud();
  }
  function drawShip(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = player && player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 ? .3 : 1;
    ctx.shadowBlur = 20; ctx.shadowColor = '#5df5ed'; ctx.fillStyle = '#5df5ed'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(17, 17); ctx.lineTo(0, 11); ctx.lineTo(-17, 17); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(5, 8); ctx.lineTo(0, 5); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff4f9a'; ctx.fillRect(-4, 15, 8, 7 + Math.random() * 8); ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#090c20'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(112, 120, 184, .1)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    stars.forEach((star) => { ctx.fillStyle = `rgba(180, 226, 255, ${star.a})`; ctx.fillRect(star.x, star.y, star.r, star.r); });
    ctx.save(); if (shake) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    projectiles.forEach((b) => { ctx.shadowBlur = 12; ctx.shadowColor = b.color; ctx.fillStyle = b.color; ctx.fillRect(b.x - 2, b.y - 10, 4, 20); });
    enemyProjectiles.forEach((b) => { ctx.shadowBlur = 12; ctx.shadowColor = b.color; ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill(); });
    enemies.forEach((enemy) => { ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.PI / 4); ctx.shadowBlur = 18; ctx.shadowColor = enemy.elite ? '#ffd166' : '#ff4f9a'; ctx.fillStyle = enemy.elite ? '#ffd166' : '#ff4f9a'; ctx.fillRect(-enemy.radius * .65, -enemy.radius * .65, enemy.radius * 1.3, enemy.radius * 1.3); ctx.shadowBlur = 0; ctx.fillStyle = '#241535'; ctx.fillRect(-4, -4, 8, 8); ctx.restore(); if (enemy.elite) { ctx.fillStyle = 'rgba(255,209,102,.55)'; ctx.fillRect(enemy.x - 14, enemy.y - 25, 28 * (enemy.hp / enemy.maxHp), 2); } });
    particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }); ctx.globalAlpha = 1; if (player) drawShip(player.x, player.y); ctx.restore();
    if (state.phase === 'running' && player && player.invulnerable > 0) { ctx.strokeStyle = `rgba(255,79,154,${player.invulnerable / 1.35 * .6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, 29 + Math.sin(performance.now() / 80) * 3, 0, Math.PI * 2); ctx.stroke(); }
  }
  function frame(time) { const dt = Math.min(.034, (time - lastTime) / 1000 || 0); lastTime = time; update(dt); draw(); requestAnimationFrame(frame); }
  function loadLeaderboard() {
    if (!config.url || !config.anonKey) { leaderboardEl.innerHTML = '<div class="error-state">Leaderboard is offline.<br>Configure the public API key to connect.</div>'; return; }
    leaderboardEl.innerHTML = '<div class="leaderboard-loading"><span></span><span></span><span></span></div>';
    fetch(`${config.url}/rest/v1/leaderboard?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } }).then((response) => { if (!response.ok) throw new Error('leaderboard request failed'); return response.json(); }).then((entries) => {
      if (!entries.length) { leaderboardEl.innerHTML = '<div class="empty-state">No pilots on record.<br>Be the first signal.</div>'; return; }
      const list = document.createElement('ol'); list.className = 'leaderboard-list'; entries.slice(0, 10).forEach((entry, index) => { const row = document.createElement('li'); row.className = 'leaderboard-row'; const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = `0${index + 1}`.slice(-2); const pilot = document.createElement('span'); pilot.className = 'pilot'; pilot.textContent = entry.name; const score = document.createElement('span'); score.className = 'leader-score'; score.textContent = formatScore(entry.score); row.append(rank, pilot, score); list.appendChild(row); }); leaderboardEl.replaceChildren(list);
    }).catch(() => { leaderboardEl.innerHTML = '<div class="error-state">Signal interrupted.<br>Try again in a moment.</div>'; });
  }
  function validateName(name) { return name.length >= 1 && name.length <= 16 && /^[A-Za-z0-9 _.-]+$/.test(name); }
  function submitScore(event) {
    event.preventDefault(); const name = nameInput.value.trim(); formMessage.className = 'form-note';
    if (!validateName(name)) { formMessage.className = 'form-note error'; formMessage.textContent = 'Use 1–16 letters, numbers, spaces, . _ or -.'; nameInput.focus(); return; }
    if (!config.url || !config.anonKey) { formMessage.className = 'form-note error'; formMessage.textContent = 'Leaderboard connection is unavailable.'; return; }
    submitButton.disabled = true; formMessage.textContent = 'Transmitting score…';
    fetch(`${config.url}/rest/v1/leaderboard`, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name, score: Math.max(0, Math.min(999999999, Math.floor(state.score))) }) }).then((response) => { if (!response.ok) throw new Error('score rejected'); return response; }).then(() => { formMessage.className = 'form-note success'; formMessage.textContent = 'Score received. Welcome to the feed.'; submitButton.disabled = false; loadLeaderboard(); }).catch(() => { formMessage.className = 'form-note error'; formMessage.textContent = 'Transmission failed. Please retry.'; submitButton.disabled = false; });
  }
  document.addEventListener('keydown', (event) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault(); keys.add(event.key); if (state.phase === 'ready' && event.key === 'Enter') startGame(); });
  document.addEventListener('keyup', (event) => keys.delete(event.key));
  document.querySelectorAll('[data-control]').forEach((button) => { const control = button.dataset.control; const set = (value, event) => { if (event) event.preventDefault(); touch[control] = value; button.classList.toggle('is-pressed', value); if (value) ensureAudio(); }; button.addEventListener('pointerdown', (event) => { button.setPointerCapture(event.pointerId); set(true, event); }); button.addEventListener('pointerup', (event) => set(false, event)); button.addEventListener('pointercancel', (event) => set(false, event)); button.addEventListener('pointerleave', (event) => { if (event.buttons === 0) set(false, event); }); });
  startButton.addEventListener('click', startGame); restartButton.addEventListener('click', startGame); scoreForm.addEventListener('submit', submitScore);
  muteButton.addEventListener('click', () => { ensureAudio(); muted = !muted; muteButton.setAttribute('aria-pressed', String(muted)); muteButton.innerHTML = `Sound <strong>${muted ? 'OFF' : 'ON'}</strong>`; if (!muted) tone(520, .08, 'sine', .025); });
  window.__NEON_BARRAGE__ = { getState: () => ({ phase: state.phase, score: state.score, lives: state.lives, playerX: state.playerX, playerY: state.playerY, enemyCount: state.enemyCount, projectileCount: state.projectileCount }), endGameForTest: (score) => endGame(Number.isFinite(Number(score)) ? Math.max(0, Math.floor(Number(score))) : 0) };
  loadLeaderboard(); updateHud(); requestAnimationFrame(frame);
}());
