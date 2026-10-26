import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest runs without globals:true, so register Testing Library cleanup explicitly.
afterEach(() => {
  cleanup();
});
