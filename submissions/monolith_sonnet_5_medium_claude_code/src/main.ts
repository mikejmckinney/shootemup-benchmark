import "./style.css";
import { Game } from "./game";
import { InputManager } from "./input";
import { AudioEngine } from "./audio";
import { fetchTopScores, renderLeaderboard, submitScore, validateName } from "./leaderboard";
import type { GameStateSnapshot } from "./types";

const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const ctx = canvas.getContext("2d")!;
const startOverlay = document.getElementById("start-overlay")!;
const gameoverOverlay = document.getElementById("gameover-overlay")!;
const startButton = document.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const restartButton = document.getElementById("restart-button")!;
const scoreEl = document.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesEl = document.querySelector<HTMLElement>('[data-testid="lives"]')!;
const finalScoreEl = document.getElementById("final-score")!;
const muteButton = document.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const nameInput = document.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitForm = document.getElementById("submit-form") as HTMLFormElement;
const submitButton = document.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const submitStatus = document.getElementById("submit-status")!;
const leaderboardStart = document.querySelector<HTMLElement>('[data-testid="leaderboard"]')!;
const leaderboardGameover = document.querySelector<HTMLElement>('[data-testid="leaderboard-gameover"]')!;
const touchStick = document.getElementById("touch-stick")!;
const touchStickNub = document.getElementById("touch-stick-nub")!;
const touchFire = document.getElementById("touch-fire")!;

const audio = new AudioEngine();
const input = new InputManager(touchStick, touchStickNub, touchFire);

let muted = false;
let lastScoreForSubmit = 0;

const game = new Game(ctx, input, audio, {
  onScoreChange: (score) => {
    scoreEl.textContent = String(score);
  },
  onLivesChange: (lives) => {
    livesEl.textContent = String(Math.max(0, lives));
  },
  onGameOver: (finalScore) => {
    lastScoreForSubmit = finalScore;
    finalScoreEl.textContent = String(finalScore);
    startOverlay.classList.add("hidden");
    gameoverOverlay.classList.remove("hidden");
    submitStatus.textContent = "";
    submitStatus.className = "submit-status";
    submitButton.disabled = false;
    nameInput.disabled = false;
    void refreshLeaderboards();
  },
});

async function refreshLeaderboards(): Promise<void> {
  const result = await fetchTopScores(10);
  renderLeaderboard(leaderboardStart, result);
  renderLeaderboard(leaderboardGameover, result);
}

function beginGameAudio(): void {
  audio.init();
  audio.resume();
}

startButton.addEventListener("click", () => {
  beginGameAudio();
  startOverlay.classList.add("hidden");
  gameoverOverlay.classList.add("hidden");
  game.start();
});

restartButton.addEventListener("click", () => {
  beginGameAudio();
  gameoverOverlay.classList.add("hidden");
  game.start();
});

muteButton.addEventListener("click", () => {
  muted = !muted;
  game.setMuted(muted);
  muteButton.textContent = muted ? "🔇" : "🔊";
  muteButton.setAttribute("aria-pressed", String(muted));
});

submitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value;
  const clientError = validateName(name);
  if (clientError) {
    submitStatus.textContent = clientError;
    submitStatus.className = "submit-status error";
    return;
  }
  submitButton.disabled = true;
  nameInput.disabled = true;
  submitStatus.textContent = "Submitting…";
  submitStatus.className = "submit-status";
  const result = await submitScore(name, lastScoreForSubmit);
  if (result.ok) {
    submitStatus.textContent = "Score submitted!";
    submitStatus.className = "submit-status";
    await refreshLeaderboards();
  } else {
    submitStatus.textContent = result.errorMessage ?? "Couldn't submit score.";
    submitStatus.className = "submit-status error";
    submitButton.disabled = false;
    nameInput.disabled = false;
  }
});

// Initial render loop begins immediately (idle state) so the canvas isn't blank.
game.startIdleLoop();

void refreshLeaderboards();

// Narrow black-box test adapter. Never touches Supabase directly and always
// routes through the same UI code paths as real gameplay.
declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => GameStateSnapshot;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => game.getSnapshot(),
  endGameForTest: (score: number) => {
    const safeScore = Math.max(0, Math.trunc(score));
    game.endForTest(safeScore);
  },
};
