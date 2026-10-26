import { buildApp } from './app.js';

const port = Number(process.env['API_PORT'] ?? 3001);
const host = '0.0.0.0';

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port, host });
  // eslint-disable-next-line no-console
  console.log(`near-circle-api listening on http://${host}:${port}`);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
