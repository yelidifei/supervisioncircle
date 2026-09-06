# Project maintenance

- Production is the user's Cloudflare Worker `supervisioncircle`, at `https://supervisioncircle.lidifei-ye.workers.dev`. The user chose this free address to avoid the former platform account name in URLs.
- `.openai/hosting.json` refers to the retired Sites copy. Keep that copy read-only (`CIRCLE_READ_ONLY=true`); do not deploy routine product updates there or re-enable writes during normal maintenance.
- Deploy requested production updates with `pnpm deploy:cloudflare`. It builds in Cloudflare mode before uploading. Use the existing Worker and D1; do not replace the live database with an empty database.
- Actual Cloudflare IDs are in ignored `wrangler.cloudflare.json`; use the committed example when setting up another machine. No access keys belong in tracked source.
- Run `pnpm typecheck`, `pnpm test`, and the appropriate build. For persistence, permissions, or concurrency changes, run the local integration test as documented in README.
- Preserve English UI and email text, the five-person trust model, distinct management/shared permissions, and the separation between selecting a time and marking the Outlook invitation sent.
- Keep real circle links, database exports, OAuth credentials and local database files out of this public GitHub repository. Documentation links to the app home are fine.
