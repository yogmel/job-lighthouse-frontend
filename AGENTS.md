<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Job Lighthouse — frontend

Next.js frontend (Vercel) for Job Lighthouse: users track companies, a runner
scrapes their openings, an LLM scores each job against the user's profile.
The backend (two FastAPI services + Postgres) lives in a separate repo; this
repo owns only the `FE-` tickets.

Package manager is **bun** (`bun install`, `bun run dev`).

## Docs

- `docs/TASKS.md` — **tickets**. Read the `FE-` ticket before implementing it;
  its acceptance criteria are the done condition, every one checked.
- `docs/VERSIONING.md` — **scope** per version. Check the version's
  `Excludes:` line before building; features from later versions stay out.
- `docs/SYSTEM_DESIGN.md` — **contracts**: API endpoints (`## API design`),
  data shapes (`## Schemas`), screen flows (`## Frontend`). Read the matching
  section before calling an endpoint or rendering a model.
- UI prototype (source of the screen flows):
  <https://claude.ai/artifact/8p1rqwg8HLSur5rfV8D1WH>

## Architecture rules

- **No BFF.** The browser calls both backend services directly through
  Nginx: Companies Service (`/auth`, `/account`, `/companies`) and Job Runner
  Service (`/jobs`, `/config`, `/runs`). Next.js route handlers are not a
  proxy layer.
- **One JWT, two services.** Attach the same token to calls to both; an
  expired or invalid token redirects to login.
- **Notion is retired.** The prototype's Notion toggle in Settings →
  Notifications is stale; build the tab without it.
- **Profile edits apply to the next run.** Show "already-scored jobs keep
  their score"; there is no rescore action.
- **Company tier is a client-side grouping key.** Changing it re-groups jobs
  in the UI only.
- Company-row "0 jobs last run" / "fetch failed" flags come from
  `RunCompanyResult` (`GET /runs/{id}/companies`).
