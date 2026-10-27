interface VisibilityToggleProps {
  enabled: boolean;
  onChange: (next: boolean) => void;
  title?: string;
  subtitle?: string;
}

export function VisibilityToggle({ enabled, onChange, title, subtitle }: VisibilityToggleProps) {
  const label = title ?? 'Near-Circle visibility';
  const sub = subtitle ?? (enabled ? 'You appear on friends’ radar' : 'You are hidden from the radar');
  return (
    <div className="visibility-row">
      <div className="visibility-text">
        <span className="visibility-title">{label}</span>
        <span className="visibility-sub">{sub}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={enabled ? 'switch on' : 'switch'}
        onClick={() => onChange(!enabled)}
      >
        <span className="knob" aria-hidden="true" />
      </button>
    </div>
  );
}
