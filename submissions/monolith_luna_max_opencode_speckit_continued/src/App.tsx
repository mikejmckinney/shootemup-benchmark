import { useEffect, useRef, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import GameOverPanel from './components/GameOverPanel';
import Hud from './components/Hud';
import Leaderboard from './components/Leaderboard';
import StartPanel from './components/StartPanel';
import TouchControls from './components/TouchControls';
import { createInitialSession, restartSession, startSession, step } from './game/engine';
import { createInputController, type InputController } from './game/input';
import type { GameSession, InputState } from './game/types';
import { hasPublicConfig } from './config/env';
import { createSupabaseLeaderboardClient } from './leaderboard/client';
import { validateScoreSubmission } from './leaderboard/validation';
import type { LeaderboardClient, LeaderboardEntry, SubmissionState } from './leaderboard/types';
import { createAudioController, type AudioController } from './game/audio';
import { installTestAdapter } from './test-adapter';

interface AppProps {
  leaderboardClient?: LeaderboardClient;
}

export default function App({ leaderboardClient }: AppProps) {
  const [session, setSession] = useState<GameSession>(() => createInitialSession());
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioController | null>(null);
  const [inputController] = useState<InputController>(() => createInputController());
  const [client] = useState<LeaderboardClient | null>(() => {
    if (leaderboardClient) return leaderboardClient;
    return hasPublicConfig() ? createSupabaseLeaderboardClient() : null;
  });
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardState, setLeaderboardState] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unavailable'>(
    client ? 'loading' : 'unavailable',
  );
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const sessionRef = useRef(session);
  sessionRef.current = session;
  if (!audioRef.current) audioRef.current = createAudioController();

  const handleStep = (input: InputState, deltaMs: number) => {
    setSession((current) => step(current, input, deltaMs));
  };

  const loadLeaderboard = async () => {
    if (!client) return;
    setLeaderboardState('loading');
    try {
      const nextEntries = await client.listTopEntries();
      setEntries(nextEntries);
      setLeaderboardState(nextEntries.length > 0 ? 'ready' : 'empty');
    } catch {
      setLeaderboardState('error');
    }
  };

  const handleSubmit = async (name: string) => {
    if (!client) return;
    setSubmissionState('validating');
    const validation = validateScoreSubmission({ name, score: sessionRef.current.score });
    if (!validation.ok) {
      setSubmissionState('error');
      setSubmissionMessage(validation.message);
      return;
    }
    setSubmissionState('submitting');
    try {
      await client.createEntry(validation.value);
      setSubmissionState('success');
      setSubmissionMessage('Score submitted to the leaderboard.');
      await loadLeaderboard();
    } catch (error) {
      setSubmissionState('error');
      setSubmissionMessage(error instanceof Error ? error.message : 'Leaderboard unavailable. Try again.');
    }
  };

  useEffect(() => {
    installTestAdapter(
      () => sessionRef.current,
      (score) => setSession((current) => ({ ...current, phase: 'game-over', score })),
    );
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [client]);

  return (
    <main className="app-shell">
      <div className="game-layout">
        <header className="page-header">
          <div>
            <p className="eyebrow">NEON BARRAGE</p>
            <h1>Hold the line.</h1>
          </div>
          <p className="tagline">A neon storm arcade run.</p>
        </header>
        <Hud
          score={session.score}
          lives={session.lives}
          muted={muted}
          onMute={() => {
            void audioRef.current?.unlock();
            setMuted(audioRef.current?.toggleMute() ?? !muted);
          }}
        />
        <section className="game-stage" aria-label="Arcade game">
          <GameCanvas session={session} onStep={handleStep} inputController={inputController} />
          {session.phase === 'ready' ? (
            <StartPanel
              onStart={() => {
                void audioRef.current?.unlock();
                setSession(startSession(session));
              }}
            />
          ) : null}
          {session.phase === 'game-over' ? (
            <GameOverPanel
              score={session.score}
              onRestart={() => {
                setSubmissionState('idle');
                setSubmissionMessage('');
                setSession(restartSession(session));
              }}
              onSubmit={client ? handleSubmit : undefined}
              submissionState={submissionState}
              submissionMessage={submissionMessage}
            />
          ) : null}
        </section>
        <Leaderboard entries={entries} state={leaderboardState} onRetry={() => void loadLeaderboard()} />
        <TouchControls controller={inputController} onInteraction={() => void audioRef.current?.unlock()} />
      </div>
    </main>
  );
}
