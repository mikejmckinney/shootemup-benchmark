export interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  created_at: string;
}

export interface ScoreSubmission {
  name: string;
  score: number;
}

export type SubmissionState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

export interface SubmissionError {
  message: string;
  retryable: boolean;
}

export interface LeaderboardClient {
  listTopEntries(): Promise<LeaderboardEntry[]>;
  createEntry(input: ScoreSubmission): Promise<LeaderboardEntry>;
}
