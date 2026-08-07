export function createNeonBarrageAdapter(game) {
  if (!game || typeof game.getPublicState !== 'function' || typeof game.endGameForTest !== 'function') {
    throw new TypeError('A game instance is required by the Neon Barrage adapter.');
  }
  return {
    getState: () => game.getPublicState(),
    endGameForTest: (score) => game.endGameForTest(score)
  };
}
