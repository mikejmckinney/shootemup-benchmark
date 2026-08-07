interface StatusMessageProps {
  kind: 'loading' | 'empty' | 'error' | 'info';
  message: string;
  onRetry?: () => void;
}

export default function StatusMessage({ kind, message, onRetry }: StatusMessageProps) {
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="text-button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
