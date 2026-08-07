import { useState, type FormEvent } from 'react';

interface GameOverPanelProps {
  score: number;
  onRestart: () => void;
  onSubmit?: (name: string) => Promise<void>;
  submissionState?: 'idle' | 'validating' | 'submitting' | 'success' | 'error';
  submissionMessage?: string;
}

export default function GameOverPanel({ score, onRestart, onSubmit, submissionState = 'idle', submissionMessage }: GameOverPanelProps) {
  const [name, setName] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onSubmit) await onSubmit(name);
  }

  return (
    <section className="overlay-card" aria-labelledby="game-over-title">
      <p className="eyebrow">SIGNAL LOST</p>
      <h2 id="game-over-title">Game Over</h2>
      <p className="final-score">{score}</p>
      {onSubmit ? (
        <form className="score-form" onSubmit={submit}>
          <label htmlFor="player-name">Pilot name</label>
          <div className="form-row">
            <input
              id="player-name"
              data-testid="player-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={16}
              autoComplete="nickname"
              placeholder="YOUR NAME"
              aria-describedby="submission-message"
              disabled={submissionState === 'submitting'}
            />
            <button type="submit" data-testid="submit-score" className="primary-button" disabled={submissionState === 'submitting'}>
              {submissionState === 'submitting' ? 'Sending...' : 'Submit'}
            </button>
          </div>
          <p id="submission-message" className="form-message" role={submissionState === 'error' ? 'alert' : 'status'}>
            {submissionMessage ?? (submissionState === 'success' ? 'Score submitted.' : '1-16 characters.')}
          </p>
        </form>
      ) : null}
      <button type="button" className="primary-button" onClick={onRestart}>
        Restart Run
      </button>
    </section>
  );
}
