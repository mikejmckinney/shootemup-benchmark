import type { LeaderboardEntry } from '../leaderboard/types';
import StatusMessage from './StatusMessage';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  state: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';
  onRetry: () => void;
}

export default function Leaderboard({ entries, state, onRetry }: LeaderboardProps) {
  return (
    <section className="leaderboard-panel" data-testid="leaderboard" aria-labelledby="leaderboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PUBLIC SIGNAL</p>
          <h2 id="leaderboard-title">Leaderboard</h2>
        </div>
        <span className="leaderboard-count">TOP 10</span>
      </div>
      {state === 'loading' ? <StatusMessage kind="loading" message="Reading the signal..." /> : null}
      {state === 'error' ? <StatusMessage kind="error" message="Leaderboard unavailable." onRetry={onRetry} /> : null}
      {state === 'unavailable' ? <StatusMessage kind="info" message="Leaderboard uplink is not configured." /> : null}
      {state === 'empty' ? <StatusMessage kind="empty" message="No scores yet. Be the first pilot." /> : null}
      {state === 'ready' ? (
        <ol className="leaderboard-list">
          {entries.map((entry, index) => (
            <li key={entry.id}>
              <span className="rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="entry-name">{entry.name}</span>
              <strong>{entry.score}</strong>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
