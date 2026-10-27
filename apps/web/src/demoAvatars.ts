// Fictional demo avatar mapping: dummy user id -> served image path.
// Source of truth is the repo-root img/ directory; apps/web/public/img/
// mirrors it so Vite serves the files identically in local dev (public/)
// and in the Docker web container (COPY public ./public). Only fictional
// demo accounts are mapped; every other user keeps the initial fallback.
const DEMO_AVATARS: Record<string, string> = {
  alex: '/img/Alex.jpg',
  coleen: '/img/Coleen.jpg',
  rhea: '/img/Rhea.jpg',
  sam: '/img/Sam.jpg',
};

/** Served profile-picture URL for a dummy user, or null for the fallback. */
export function demoAvatarUrl(userId: string): string | null {
  return DEMO_AVATARS[userId] ?? null;
}
