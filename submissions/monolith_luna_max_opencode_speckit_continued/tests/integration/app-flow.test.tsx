import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { createMemoryLeaderboard } from '../fixtures/leaderboard';

describe('application leaderboard flow', () => {
  it('renders the start state and leaderboard boundary', async () => {
    render(<App leaderboardClient={createMemoryLeaderboard()} />);

    expect(screen.getByTestId('start-button')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
    expect(screen.getByTestId('score')).toHaveTextContent('0');
    await waitFor(() => expect(screen.getByText(/no scores yet/i)).toBeInTheDocument());
  });
});
