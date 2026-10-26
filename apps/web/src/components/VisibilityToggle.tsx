interface VisibilityToggleProps {
  enabled: boolean;
  onChange: (next: boolean) => void;
}

export function VisibilityToggle({ enabled, onChange }: VisibilityToggleProps) {
  return (
    <div className="visibility-row">
      <div className="visibility-text">
        <span className="visibility-title">Near-Circle visibility</span>
        <span className="visibility-sub">
          {enabled ? 'You appear on friends’ radar' : 'You are hidden from the radar'}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Near-Circle visibility"
        className={enabled ? 'switch on' : 'switch'}
        onClick={() => onChange(!enabled)}
      >
        <span className="knob" aria-hidden="true" />
      </button>
    </div>
  );
}
