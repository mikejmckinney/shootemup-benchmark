import './styles.css';
import {
  GameEngine,
  type GameEvent,
  type GameRenderSnapshot,
  type GameState,
} from './game-engine';
import {
  createLeaderboardService,
  createLeaderboardRequestGuard,
  leaderboardLoadSucceeded,
  validatePlayerName,
  validateScore,
  type LeaderboardEntry,
} from './leaderboard';

type PublicState = Pick<
  GameState,
  'phase' | 'score' | 'lives' | 'playerX' | 'playerY' | 'enemyCount' | 'projectileCount'
>;

type Direction = 'left' | 'right' | 'up' | 'down';
type TouchControl = Direction | 'fire';
type ToneType = 'fire' | 'hit' | 'damage' | 'game-over';

type Star = {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
};

type HitRing = {
  x: number;
  y: number;
  ageMs: number;
  radius: number;
  color: string;
};

type ActiveTouch = {
  control: TouchControl;
  button: HTMLButtonElement;
};

type NeonBarrageAdapter = {
  getState: () => PublicState;
  endGameForTest: (score: number) => void;
};

declare global {
  interface Window {
    __NEON_BARRAGE__: NeonBarrageAdapter;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Neon Barrage could not find ${selector}.`);
  }
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>('[data-testid="game-canvas"]');
const startButton = requiredElement<HTMLButtonElement>('[data-testid="start-button"]');
const muteButton = requiredElement<HTMLButtonElement>('[data-testid="mute-button"]');
const scoreOutput = requiredElement<HTMLOutputElement>('[data-testid="score"]');
const livesOutput = requiredElement<HTMLOutputElement>('[data-testid="lives"]');
const statusRegion = requiredElement<HTMLElement>('#game-status');
const gameOverPanel = requiredElement<HTMLElement>('#game-over-panel');
const finalScore = requiredElement<HTMLElement>('#final-score');
const nameInput = requiredElement<HTMLInputElement>('[data-testid="player-name"]');
const scoreForm = requiredElement<HTMLFormElement>('#score-form');
const submitButton = requiredElement<HTMLButtonElement>('[data-testid="submit-score"]');
const formStatus = requiredElement<HTMLElement>('.form-note');
const leaderboardRegion = requiredElement<HTMLElement>('[data-testid="leaderboard"]');
const touchButtons = document.querySelectorAll<HTMLButtonElement>('[data-control]');

const renderingContext = canvas.getContext('2d');
if (!renderingContext) {
  throw new Error('Neon Barrage requires a 2D canvas context.');
}
const context: CanvasRenderingContext2D = renderingContext;

const engine = new GameEngine({ width: canvas.width, height: canvas.height });
const hitRings: HitRing[] = [];
const activeTouches = new Map<number, ActiveTouch>();
const stars: Star[] = Array.from({ length: 96 }, (_, index) => {
  const layer = index % 3;
  return {
    x: (index * 83 + 31) % canvas.width,
    y: (index * 47 + 17) % canvas.height,
    size: layer === 2 ? 2 : 1,
    speed: layer === 2 ? 24 : layer === 1 ? 14 : 7,
    alpha: layer === 2 ? 0.85 : layer === 1 ? 0.58 : 0.34,
  };
});

const keyboardBindings: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
};

const toneSettings: Record<ToneType, { frequency: number; duration: number; type: OscillatorType }> = {
  fire: { frequency: 540, duration: 0.07, type: 'square' },
  hit: { frequency: 180, duration: 0.16, type: 'sawtooth' },
  damage: { frequency: 92, duration: 0.24, type: 'triangle' },
  'game-over': { frequency: 58, duration: 0.48, type: 'sine' },
};

let muted = false;
let audioContext: AudioContext | null = null;
let previousFrameTime: number | undefined;
let lastStatus = '';
let effectCursor = 0;
let isSubmittingScore = false;

const leaderboardService = createLeaderboardService(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
const leaderboardRequestGuard = createLeaderboardRequestGuard();

function getPublicState(): PublicState {
  const state = engine.getState();
  return {
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: state.playerX,
    playerY: state.playerY,
    enemyCount: state.enemyCount,
    projectileCount: state.projectileCount,
  };
}

function setStatus(message: string, phase: GameState['phase']): void {
  if (lastStatus === message) {
    return;
  }

  statusRegion.textContent = message;
  statusRegion.dataset.phase = phase;
  lastStatus = message;
}

function renderHud(state: GameState = engine.getState()): void {
  scoreOutput.textContent = String(state.score);
  livesOutput.textContent = String(state.lives);
}

function setFormStatus(message: string): void {
  formStatus.textContent = message;
}

function renderLeaderboardMessage(message: string): void {
  leaderboardRegion.className = 'leaderboard-placeholder';
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  leaderboardRegion.replaceChildren(messageElement);
}

function renderLeaderboard(entries: LeaderboardEntry[]): void {
  if (entries.length === 0) {
    renderLeaderboardMessage('No scores have been uplinked yet.');
    return;
  }

  leaderboardRegion.className = 'leaderboard-list-region';
  const list = document.createElement('ol');
  list.className = 'leaderboard-list';

  entries.forEach((entry, index) => {
    const row = document.createElement('li');
    row.className = 'leaderboard-entry';

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = String(index + 1).padStart(2, '0');

    const playerName = document.createElement('span');
    playerName.className = 'leaderboard-name';
    playerName.textContent = entry.player_name;

    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = String(entry.score);

    row.append(rank, playerName, score);
    list.append(row);
  });

  leaderboardRegion.replaceChildren(list);
}

function renderLeaderboardIfCurrent(requestId: number, render: () => void): boolean {
  if (!leaderboardRequestGuard.isCurrent(requestId)) {
    return false;
  }

  render();
  return true;
}

async function loadLeaderboard(): Promise<boolean> {
  const requestId = leaderboardRequestGuard.begin();
  renderLeaderboardIfCurrent(requestId, () => renderLeaderboardMessage('Loading top pilots...'));

  try {
    const result = await leaderboardService.loadTop();
    const rendered = renderLeaderboardIfCurrent(requestId, () => {
      if (!result.ok) {
        renderLeaderboardMessage(result.message);
      } else {
        renderLeaderboard(result.value);
      }
    });
    if (!rendered) {
      return true;
    }

    return leaderboardLoadSucceeded(rendered, result.ok);
  } catch {
    const rendered = renderLeaderboardIfCurrent(requestId, () => {
      renderLeaderboardMessage('Leaderboard could not be loaded right now.');
    });
    return leaderboardLoadSucceeded(rendered, false);
  }
}

function updateMuteButton(): void {
  muteButton.textContent = muted ? 'Sound Off' : 'Sound On';
  muteButton.setAttribute('aria-pressed', String(muted));
}

function ensureAudioContext(): AudioContext | null {
  if (audioContext) {
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => undefined);
    }
    return audioContext;
  }

  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }

  try {
    audioContext = new AudioContextConstructor();
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => undefined);
    }
  } catch {
    audioContext = null;
  }

  return audioContext;
}

function emitTone(tone: ToneType): void {
  if (muted || !audioContext) {
    return;
  }

  const settings = toneSettings[tone];
  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startAt = audioContext.currentTime;
    const endAt = startAt + settings.duration;

    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.055, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  } catch {
    // Audio is an enhancement; a blocked device must not interrupt the game.
  }
}

function setInputFlag(control: TouchControl, pressed: boolean): void {
  switch (control) {
    case 'left':
      engine.setInput({ left: pressed });
      break;
    case 'right':
      engine.setInput({ right: pressed });
      break;
    case 'up':
      engine.setInput({ up: pressed });
      break;
    case 'down':
      engine.setInput({ down: pressed });
      break;
    case 'fire':
      engine.setInput({ firing: pressed });
      break;
  }
}

function releaseAllInput(): void {
  activeTouches.clear();
  engine.setInput({ left: false, right: false, up: false, down: false, firing: false });
}

function releaseActiveTouch(event: PointerEvent): void {
  const activeTouch = activeTouches.get(event.pointerId);
  if (!activeTouch) {
    return;
  }

  event.preventDefault();
  activeTouches.delete(event.pointerId);
  const sameControlIsStillPressed = [...activeTouches.values()].some(
    (touch) => touch.control === activeTouch.control,
  );
  if (!sameControlIsStillPressed) {
    setInputFlag(activeTouch.control, false);
  }

  if (activeTouch.button.hasPointerCapture(event.pointerId)) {
    activeTouch.button.releasePointerCapture(event.pointerId);
  }
}

function fireFromGesture(): void {
  ensureAudioContext();
  if (engine.fire()) {
    emitTone('fire');
  }
}

function beginGame(): void {
  ensureAudioContext();
  if (engine.getState().phase === 'running') {
    engine.reset();
  }

  engine.start();
  hitRings.length = 0;
  gameOverPanel.hidden = true;
  nameInput.value = '';
  nameInput.disabled = false;
  submitButton.disabled = false;
  startButton.textContent = 'Restart Mission';
  renderHud();
  setStatus('Launch confirmed. Wave 01 inbound.', 'running');
}

function renderGameOver(): void {
  const state = engine.getState();
  renderHud(state);
  finalScore.textContent = String(state.score);
  gameOverPanel.hidden = false;
  nameInput.disabled = false;
  submitButton.disabled = false;
  setFormStatus('Enter a callsign to submit your final score.');
  startButton.textContent = 'Replay Mission';
  setStatus(`Mission complete. Final score ${state.score}.`, 'game-over');
}

function addHitRing(x: number, y: number, color: string, radius: number): void {
  hitRings.push({ x, y, ageMs: 0, radius, color });
}

function nextImpactPoint(snapshot: GameRenderSnapshot): { x: number; y: number } {
  effectCursor += 1;
  return {
    x: 150 + ((effectCursor * 211) % (snapshot.width - 300)),
    y: 120 + ((effectCursor * 137) % (snapshot.height - 220)),
  };
}

function handleEvent(event: GameEvent, snapshot: GameRenderSnapshot): void {
  switch (event.type) {
    case 'fire':
      break;
    case 'hit': {
      const impact = nextImpactPoint(snapshot);
      addHitRing(impact.x, impact.y, '#ff4bd8', 44);
      emitTone('hit');
      break;
    }
    case 'damage':
      addHitRing(snapshot.player.x, snapshot.player.y, '#ffb84a', 56);
      emitTone('damage');
      break;
    case 'game-over':
      addHitRing(snapshot.player.x, snapshot.player.y, '#ff4bd8', 90);
      emitTone('game-over');
      renderGameOver();
      break;
  }
}

function processEvents(snapshot: GameRenderSnapshot): void {
  for (const event of engine.consumeEvents()) {
    handleEvent(event, snapshot);
  }
}

function drawBackground(snapshot: GameRenderSnapshot, timestamp: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, snapshot.height);
  gradient.addColorStop(0, '#07142c');
  gradient.addColorStop(0.52, '#070b20');
  gradient.addColorStop(1, '#040713');
  context.fillStyle = gradient;
  context.fillRect(0, 0, snapshot.width, snapshot.height);

  const horizonGlow = context.createRadialGradient(
    snapshot.width * 0.52,
    snapshot.height * 0.18,
    10,
    snapshot.width * 0.52,
    snapshot.height * 0.18,
    snapshot.width * 0.72,
  );
  horizonGlow.addColorStop(0, 'rgba(0, 231, 255, 0.13)');
  horizonGlow.addColorStop(0.55, 'rgba(91, 62, 255, 0.045)');
  horizonGlow.addColorStop(1, 'rgba(2, 4, 14, 0)');
  context.fillStyle = horizonGlow;
  context.fillRect(0, 0, snapshot.width, snapshot.height);

  context.save();
  context.globalAlpha = 0.28;
  context.strokeStyle = '#1a5b81';
  context.lineWidth = 1;
  for (let x = 0; x <= snapshot.width; x += 80) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, snapshot.height);
    context.stroke();
  }
  for (let y = 0; y <= snapshot.height; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(snapshot.width, y);
    context.stroke();
  }
  context.restore();

  for (const star of stars) {
    const y = (star.y + (timestamp * star.speed) / 1_000) % snapshot.height;
    context.fillStyle = `rgba(155, 239, 255, ${star.alpha})`;
    context.fillRect(star.x, y, star.size, star.size);
  }
}

function drawPlayer(snapshot: GameRenderSnapshot, timestamp: number): void {
  const { x, y, radius } = snapshot.player;
  const thrust = 8 + Math.sin(timestamp / 80) * 4;

  context.save();
  context.translate(x, y);
  context.shadowColor = '#00e7ff';
  context.shadowBlur = 24;
  context.fillStyle = '#00e7ff';
  context.beginPath();
  context.moveTo(0, -radius - 7);
  context.lineTo(radius - 2, radius - 4);
  context.lineTo(0, radius - 10);
  context.lineTo(-radius + 2, radius - 4);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = '#d9fbff';
  context.beginPath();
  context.moveTo(0, -radius - 2);
  context.lineTo(7, radius - 7);
  context.lineTo(0, radius - 13);
  context.lineTo(-7, radius - 7);
  context.closePath();
  context.fill();

  context.fillStyle = '#ff4bd8';
  context.beginPath();
  context.moveTo(-7, radius - 4);
  context.lineTo(0, radius + thrust);
  context.lineTo(7, radius - 4);
  context.closePath();
  context.fill();
  context.restore();
}

function drawEnemy(
  enemy: GameRenderSnapshot['enemies'][number],
  timestamp: number,
): void {
  const { x, y, radius, variant } = enemy;
  const rotation = timestamp / (variant === 1 ? 720 : 1_000) * (variant === 2 ? -1 : 1);

  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.shadowColor = '#ff4bd8';
  context.shadowBlur = 20;
  context.strokeStyle = '#ff4bd8';
  context.fillStyle = variant === 1 ? '#8b1f96' : '#d225a7';
  context.lineWidth = 3;

  context.beginPath();
  if (variant === 0) {
    context.moveTo(0, -radius);
    context.lineTo(radius, 0);
    context.lineTo(0, radius);
    context.lineTo(-radius, 0);
  } else if (variant === 1) {
    for (let point = 0; point < 6; point += 1) {
      const angle = (Math.PI * 2 * point) / 6;
      const pointX = Math.cos(angle) * radius;
      const pointY = Math.sin(angle) * radius;
      if (point === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    }
  } else {
    context.moveTo(0, -radius - 2);
    context.lineTo(radius + 2, radius);
    context.lineTo(-radius - 2, radius);
  }
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 0;
  context.fillStyle = '#ffc6f4';
  context.beginPath();
  context.arc(0, 0, 4 + variant, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawProjectile(projectile: GameRenderSnapshot['projectiles'][number]): void {
  context.save();
  context.strokeStyle = '#d8fdff';
  context.lineWidth = 3;
  context.shadowColor = '#00e7ff';
  context.shadowBlur = 18;
  context.beginPath();
  context.moveTo(projectile.x, projectile.y + 15);
  context.lineTo(projectile.x, projectile.y - projectile.radius);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(projectile.x, projectile.y - 2, projectile.radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHitRings(deltaMs: number): void {
  const effectDelta = Number.isFinite(deltaMs) ? Math.min(Math.max(deltaMs, 0), 100) : 0;
  for (const ring of hitRings) {
    ring.ageMs += effectDelta;
    const progress = ring.ageMs / 460;
    const alpha = Math.max(0, 1 - progress);
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = ring.color;
    context.shadowColor = ring.color;
    context.shadowBlur = 18;
    context.lineWidth = 3 - progress * 1.5;
    context.beginPath();
    context.arc(ring.x, ring.y, 8 + ring.radius * progress, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  for (let index = hitRings.length - 1; index >= 0; index -= 1) {
    if (hitRings[index].ageMs > 460) {
      hitRings.splice(index, 1);
    }
  }
}

function drawScene(snapshot: GameRenderSnapshot, timestamp: number, deltaMs: number): void {
  context.clearRect(0, 0, snapshot.width, snapshot.height);
  drawBackground(snapshot, timestamp);
  for (const projectile of snapshot.projectiles) {
    drawProjectile(projectile);
  }
  for (const enemy of snapshot.enemies) {
    drawEnemy(enemy, timestamp);
  }
  drawPlayer(snapshot, timestamp);
  drawHitRings(deltaMs);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function isNativeControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
}

function handleKeyDown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) {
    return;
  }
  if (isNativeControlTarget(event.target)) {
    return;
  }

  const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
  if (isSpace) {
    event.preventDefault();
    if (!event.repeat) {
      setInputFlag('fire', true);
      fireFromGesture();
    }
    return;
  }

  const direction = keyboardBindings[event.code] ?? keyboardBindings[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  setInputFlag(direction, true);
}

function handleKeyUp(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) {
    return;
  }
  if (isNativeControlTarget(event.target)) {
    return;
  }

  const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
  if (isSpace) {
    event.preventDefault();
    setInputFlag('fire', false);
    return;
  }

  const direction = keyboardBindings[event.code] ?? keyboardBindings[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  setInputFlag(direction, false);
}

function readTouchControl(event: Event): TouchControl | null {
  const button = event.currentTarget as HTMLButtonElement;
  const control = button.dataset.control;
  if (control === 'left' || control === 'right' || control === 'up' || control === 'down' || control === 'fire') {
    return control;
  }
  return null;
}

function handleTouchStart(event: PointerEvent): void {
  const control = readTouchControl(event);
  if (!control) {
    return;
  }

  event.preventDefault();
  ensureAudioContext();
  const button = event.currentTarget as HTMLButtonElement;
  const previousTouch = activeTouches.get(event.pointerId);
  if (previousTouch) {
    activeTouches.delete(event.pointerId);
    setInputFlag(previousTouch.control, false);
  }
  try {
    button.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is unavailable in a few embedded browsers; release still clears input.
  }
  activeTouches.set(event.pointerId, { control, button });
  setInputFlag(control, true);
  if (control === 'fire') {
    if (engine.fire()) {
      emitTone('fire');
    }
  }
}

function handleTouchEnd(event: PointerEvent): void {
  releaseActiveTouch(event);
}

function handleMute(): void {
  ensureAudioContext();
  muted = !muted;
  updateMuteButton();
}

function reportScoreStatus(message: string): void {
  setFormStatus(message);
  setStatus(message, engine.getState().phase);
}

async function handleScoreForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (isSubmittingScore) {
    return;
  }

  const nameResult = validatePlayerName(nameInput.value);
  if (!nameResult.ok) {
    reportScoreStatus(nameResult.message);
    return;
  }

  const scoreResult = validateScore(engine.getState().score);
  if (!scoreResult.ok) {
    reportScoreStatus(scoreResult.message);
    return;
  }

  isSubmittingScore = true;
  submitButton.disabled = true;
  nameInput.disabled = true;
  reportScoreStatus('Submitting score...');

  try {
    const result = await leaderboardService.submit(nameResult.value, scoreResult.value);
    if (!result.ok) {
      reportScoreStatus(result.message);
      return;
    }

    const refreshed = await loadLeaderboard();
    reportScoreStatus(
      refreshed
        ? 'Score submitted. Signal confirmed.'
        : 'Score submitted, but the leaderboard refresh failed.',
    );
  } catch {
    reportScoreStatus('Score could not be submitted right now.');
  } finally {
    isSubmittingScore = false;
    submitButton.disabled = false;
    nameInput.disabled = false;
  }
}

function endGameForTest(score: number): void {
  engine.endForTest(score);
  const snapshot = engine.getRenderSnapshot();
  processEvents(snapshot);
  renderGameOver();
  drawScene(snapshot, performance.now(), 0);
}

function animate(timestamp: number): void {
  const deltaMs = previousFrameTime === undefined ? 0 : timestamp - previousFrameTime;
  previousFrameTime = timestamp;
  engine.update(deltaMs);
  const snapshot = engine.getRenderSnapshot();
  processEvents(snapshot);
  renderHud(snapshot.state);

  if (snapshot.state.phase === 'running') {
    const wave = Math.max(1, Math.floor(snapshot.state.score / 500) + 1);
    setStatus(`Wave ${String(wave).padStart(2, '0')} active. Keep moving.`, 'running');
  } else if (snapshot.state.phase === 'idle') {
    setStatus('Systems nominal. Launch when ready.', 'idle');
  }

  drawScene(snapshot, timestamp, deltaMs);
  window.requestAnimationFrame(animate);
}

startButton.addEventListener('click', beginGame);
muteButton.addEventListener('click', handleMute);
scoreForm.addEventListener('submit', handleScoreForm);
window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp, { passive: false });
window.addEventListener('blur', releaseAllInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAllInput();
  }
});

for (const button of touchButtons) {
  button.addEventListener('pointerdown', handleTouchStart, { passive: false });
  button.addEventListener('pointerup', handleTouchEnd, { passive: false });
  button.addEventListener('pointercancel', handleTouchEnd, { passive: false });
  button.addEventListener('lostpointercapture', handleTouchEnd, { passive: false });
}
window.addEventListener('pointerup', releaseActiveTouch, { passive: false });
window.addEventListener('pointercancel', releaseActiveTouch, { passive: false });

window.__NEON_BARRAGE__ = {
  getState: getPublicState,
  endGameForTest,
};

updateMuteButton();
renderHud();
setStatus('Systems nominal. Launch when ready.', 'idle');
formStatus.setAttribute('role', 'status');
formStatus.setAttribute('aria-live', 'polite');
void loadLeaderboard();
drawScene(engine.getRenderSnapshot(), 0, 0);
window.requestAnimationFrame(animate);
