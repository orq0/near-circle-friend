import { useState } from 'react';
import { demoAvatarUrl } from '../demoAvatars';

interface AvatarProps {
  /** Dummy-user id; unmapped ids render the initial fallback. */
  userId: string;
  /** Initial letter shown when no photo is mapped or loading fails. */
  label: string;
  /** Wrapper class for the framed (non-bare) variant. */
  className?: string;
  /** Extra class for the photo itself. */
  photoClassName?: string;
  /** When true, renders only the image or the bare initial (no wrapper). */
  bare?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Demo profile picture with a graceful initial fallback. The image is
 * decorative (aria-hidden, empty alt) exactly like the initials it
 * replaces; a failed load swaps back to the initial automatically.
 */
export function Avatar({
  userId,
  label,
  className = 'avatar',
  photoClassName = 'avatar-photo',
  bare = false,
  style,
  children,
}: AvatarProps) {
  const url = demoAvatarUrl(userId);
  const [failed, setFailed] = useState(false);
  if (url !== null && !failed) {
    const img = (
      <img
        className={photoClassName}
        src={url}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    );
    if (bare) return img;
    return (
      <span className={className} aria-hidden="true" style={style}>
        {img}
        {children}
      </span>
    );
  }
  if (bare) return <>{label}</>;
  return (
    <span className={className} aria-hidden="true" style={style}>
      {label}
      {children}
    </span>
  );
}
