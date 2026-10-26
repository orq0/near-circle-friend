export function ApiStatus({ healthy }: { healthy: boolean | null }) {
  if (healthy === null) {
    return (
      <p className="api-pill checking" role="status">
        Checking API…
      </p>
    );
  }
  return (
    <p className={healthy ? 'api-pill ok' : 'api-pill down'} role="status">
      {healthy ? 'API connected' : 'API unreachable'}
    </p>
  );
}
