import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Avatar } from './Avatar';
import { demoAvatarUrl } from '../demoAvatars';

describe('demo avatars', () => {
  it('maps dummy-user ids to served image paths', () => {
    expect(demoAvatarUrl('alex')).toBe('/img/Alex.jpg');
    expect(demoAvatarUrl('coleen')).toBe('/img/Coleen.jpg');
    expect(demoAvatarUrl('rhea')).toBe('/img/Rhea.jpg');
    expect(demoAvatarUrl('sam')).toBe('/img/Sam.jpg');
  });

  it('returns null for unmapped users', () => {
    expect(demoAvatarUrl('liza')).toBeNull();
    expect(demoAvatarUrl('mallory')).toBeNull();
  });

  it('renders the photo for mapped users', () => {
    const { container } = render(<Avatar userId="alex" label="A" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/img/Alex.jpg');
  });

  it('falls back to the initial for unmapped users', () => {
    const { container } = render(<Avatar userId="liza" label="L" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('L');
  });

  it('falls back to the initial when the photo fails to load', () => {
    const { container } = render(<Avatar userId="alex" label="A" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img !== null) fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('A');
  });
});
