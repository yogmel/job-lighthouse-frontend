# Job Lighthouse — frontend

Next.js app (hosted on Vercel). See [AGENTS.md](./AGENTS.md) and [docs/](./docs) for scope and contracts.

## Requirements

- **Node 24** (see `.nvmrc`; `nvm use`)
- **bun**

## Setup

```bash
bun install
```

Create `.env.local`:

```bash
# Nginx host in front of Companies Service + Job Runner Service
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
# OAuth 2.0 Web client ID from Google Cloud Console; leave empty to hide the Google button
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

Both values are public — they are inlined into the browser bundle at build time. Never put secrets in `NEXT_PUBLIC_*` vars.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server on http://localhost:3000 |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run test` | Vitest (once); `bun run test:watch` for watch mode |
