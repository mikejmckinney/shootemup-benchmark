interface HudProps {
  score: number;
  lives: number;
  muted: boolean;
  onMute: () => void;
}

export default function Hud({ score, lives, muted, onMute }: HudProps) {
  return (
    <div className="hud" aria-label="Game status" role="status" aria-live="polite">
      <div>
        <span className="hud-label">SCORE</span>
        <strong data-testid="score">{score}</strong>
      </div>
      <div>
        <span className="hud-label">LIVES</span>
        <strong data-testid="lives">{lives}</strong>
      </div>
      <button
        type="button"
        data-testid="mute-button"
        className="icon-button"
        onClick={onMute}
        aria-label={muted ? 'Sound off. Enable sound' : 'Sound on. Disable sound'}
        aria-pressed={muted}
      >
        {muted ? 'Sound off' : 'Sound on'}
      </button>
    </div>
  );
}
