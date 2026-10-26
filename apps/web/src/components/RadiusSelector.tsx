import { formatRadius } from '../radar';

interface RadiusSelectorProps {
  value: number;
  options: readonly number[];
  disabled?: boolean;
  onChange: (meters: number) => void;
}

export function RadiusSelector({ value, options, disabled = false, onChange }: RadiusSelectorProps) {
  return (
    <div className="radius-row" role="group" aria-label="Radar radius">
      {options.map((meters) => (
        <button
          key={meters}
          type="button"
          className={meters === value ? 'radius-btn active' : 'radius-btn'}
          aria-pressed={meters === value}
          disabled={disabled}
          onClick={() => onChange(meters)}
        >
          {formatRadius(meters)}
        </button>
      ))}
    </div>
  );
}
