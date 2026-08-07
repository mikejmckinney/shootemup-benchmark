import "./style.css";
import { AudioEngine } from "./audio";
import { NeonBarrageGame, type InputState } from "./game";
import {
  createLeaderboardClient,
  fetchTopScores,
  submitScore,
  type LeaderboardEntry,
} from "./leaderboard";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <div class="brand-row">
      <div>
        <h1 class="brand">NEON BARRAGE</h1>
        <p class="tagline">Arcade shooter · survive the swarm</p>
      </div>
      <div class="hud">
        <div class="stat">SCORE <span data-testid="score">0</span></div>
        <div class="stat">LIVES <span data-testid="lives">3</span></div>
        <button type="button" data-testid="mute-button" class="secondary" aria-pressed="false">Sound On</button>
      </div>
    </div>

    <div class="stage-wrap">
      <canvas data-testid="game-canvas" width="800" height="600" aria-label="Neon Barrage game canvas"></canvas>
      <div class="overlay" data-overlay="ready">
        <div>
          <h2>READY TO ENGAGE</h2>
          <p>Clear neon hostiles. Arrow keys / WASD to move, Space to fire.</p>
          <div class="btn-row">
            <button type="button" data-testid="start-button">Start</button>
          </div>
        </div>
      </div>
      <div class="overlay hidden" data-overlay="gameover">
        <div>
          <h2>GAME OVER</h2>
          <p data-final-score>Final score: 0</p>
          <div class="btn-row">
            <button type="button" data-restart>Play Again</button>
          </div>
        </div>
      </div>
    </div>

    <div class="touch-controls" data-testid="touch-controls">
      <div class="dpad" aria-label="Movement pad">
        <button type="button" class="pad" data-dir="up" aria-label="Up">▲</button>
        <button type="button" class="pad" data-dir="left" aria-label="Left">◀</button>
        <button type="button" class="pad" data-dir="right" aria-label="Right">▶</button>
        <button type="button" class="pad" data-dir="down" aria-label="Down">▼</button>
      </div>
      <button type="button" class="fire-btn" data-touch-fire aria-label="Fire">FIRE</button>
    </div>

    <p class="help desktop-only">Controls: Arrow keys or WASD · Space to fire · Survive escalating waves</p>

    <section class="panel">
      <h3>LEADERBOARD</h3>
      <div data-testid="leaderboard">
        <table class="leaderboard">
          <thead>
            <tr><th>#</th><th>Pilot</th><th>Score</th></tr>
          </thead>
          <tbody data-leaderboard-body>
            <tr><td colspan="3">Loading…</td></tr>
          </tbody>
        </table>
      </div>
      <div class="submit-row">
        <input data-testid="player-name" maxlength="16" placeholder="Callsign (1–16 chars)" autocomplete="username" />
        <button type="button" data-testid="submit-score" disabled>Submit Score</button>
      </div>
      <div class="status-line" data-leaderboard-status></div>
    </section>
  </div>
`;

const canvas = app.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const ctx = canvas.getContext("2d")!;
const scoreEl = app.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesEl = app.querySelector<HTMLElement>('[data-testid="lives"]')!;
const muteBtn = app.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const startBtn = app.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const restartBtn = app.querySelector<HTMLButtonElement>("[data-restart]")!;
const readyOverlay = app.querySelector<HTMLElement>('[data-overlay="ready"]')!;
const overOverlay = app.querySelector<HTMLElement>('[data-overlay="gameover"]')!;
const finalScoreEl = app.querySelector<HTMLElement>("[data-final-score]")!;
const nameInput = app.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitBtn = app.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const lbBody = app.querySelector<HTMLElement>("[data-leaderboard-body]")!;
const lbStatus = app.querySelector<HTMLElement>("[data-leaderboard-status]")!;

const game = new NeonBarrageGame();
const audio = new AudioEngine();
const client = createLeaderboardClient();
const input: InputState = { up: false, down: false, left: false, right: false, fire: false };

let lastTs = 0;
let pendingSubmitScore: number | null = null;

function setStatus(message: string, kind: "" | "error" | "ok" = ""): void {
  lbStatus.textContent = message;
  lbStatus.className = `status-line${kind ? ` ${kind}` : ""}`;
}

function renderLeaderboard(entries: LeaderboardEntry[]): void {
  if (entries.length === 0) {
    lbBody.innerHTML = `<tr><td colspan="3">No scores yet — be the first.</td></tr>`;
    return;
  }
  lbBody.innerHTML = entries
    .map(
      (e, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(e.player_name)}</td><td>${e.score}</td></tr>`,
    )
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function refreshLeaderboard(): Promise<void> {
  setStatus("Loading leaderboard…");
  try {
    const entries = await fetchTopScores(client, 10);
    renderLeaderboard(entries);
    setStatus(entries.length ? "" : "Leaderboard is empty.");
  } catch (err) {
    renderLeaderboard([]);
    setStatus(
      `Could not load leaderboard: ${err instanceof Error ? err.message : "network error"}`,
      "error",
    );
  }
}

function syncHud(): void {
  scoreEl.textContent = String(game.score);
  livesEl.textContent = String(game.lives);
  const ready = game.phase === "ready";
  const over = game.phase === "gameover";
  readyOverlay.classList.toggle("hidden", !ready);
  overOverlay.classList.toggle("hidden", !over);
  if (over) {
    finalScoreEl.textContent = `Final score: ${game.score}`;
    pendingSubmitScore = game.score;
    submitBtn.disabled = false;
  } else if (game.phase === "playing") {
    pendingSubmitScore = null;
    submitBtn.disabled = true;
  }
}

game.onScore = (s) => {
  scoreEl.textContent = String(s);
};
game.onLives = (l) => {
  livesEl.textContent = String(l);
};
game.onPhase = () => syncHud();
game.onSfx = (k) => audio.play(k);

async function beginGame(): Promise<void> {
  await audio.unlock();
  game.start();
  syncHud();
  setStatus("");
}

startBtn.addEventListener("click", () => void beginGame());
restartBtn.addEventListener("click", () => void beginGame());

muteBtn.addEventListener("click", () => {
  void audio.unlock();
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? "Muted" : "Sound On";
  muteBtn.setAttribute("aria-pressed", String(muted));
});

const keyMap: Record<string, keyof InputState> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "fire",
};

window.addEventListener("keydown", (e) => {
  const k = keyMap[e.code];
  if (!k) return;
  e.preventDefault();
  input[k] = true;
});

window.addEventListener("keyup", (e) => {
  const k = keyMap[e.code];
  if (!k) return;
  e.preventDefault();
  input[k] = false;
});

function bindHold(el: HTMLElement, on: () => void, off: () => void): void {
  const start = (ev: Event) => {
    ev.preventDefault();
    on();
  };
  const end = (ev: Event) => {
    ev.preventDefault();
    off();
  };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointerleave", end);
  el.addEventListener("pointercancel", end);
}

for (const pad of app.querySelectorAll<HTMLButtonElement>(".pad[data-dir]")) {
  const dir = pad.dataset.dir as "up" | "down" | "left" | "right";
  bindHold(
    pad,
    () => {
      input[dir] = true;
    },
    () => {
      input[dir] = false;
    },
  );
}

const firePad = app.querySelector<HTMLButtonElement>("[data-touch-fire]")!;
bindHold(
  firePad,
  () => {
    input.fire = true;
  },
  () => {
    input.fire = false;
  },
);

submitBtn.addEventListener("click", async () => {
  if (pendingSubmitScore === null) {
    setStatus("Finish a run before submitting a score.", "error");
    return;
  }
  submitBtn.disabled = true;
  setStatus("Submitting…");
  try {
    await submitScore(client, nameInput.value, pendingSubmitScore);
    setStatus("Score submitted!", "ok");
    await refreshLeaderboard();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Submit failed", "error");
    submitBtn.disabled = false;
  }
});

function frame(ts: number): void {
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  game.update(dt, input);
  game.draw(ctx);
  requestAnimationFrame(frame);
}

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => ReturnType<NeonBarrageGame["getState"]>;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => game.getState(),
  endGameForTest: (score: number) => {
    const safe = Number.isFinite(score) && score >= 0 ? Math.floor(score) : 0;
    game.endGame(safe);
    syncHud();
  },
};

syncHud();
void refreshLeaderboard();
requestAnimationFrame(frame);
