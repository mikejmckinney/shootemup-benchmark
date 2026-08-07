interface StartPanelProps {
  onStart: () => void;
}

export default function StartPanel({ onStart }: StartPanelProps) {
  return (
    <section className="overlay-card" aria-labelledby="start-title">
      <p className="eyebrow">NEON BARRAGE</p>
      <h1 id="start-title">Hold the line.</h1>
      <p>Move with Arrow keys or WASD. Fire with Space. Survive the neon swarm.</p>
      <button type="button" data-testid="start-button" className="primary-button" onClick={onStart}>
        Start Run
      </button>
    </section>
  );
}
