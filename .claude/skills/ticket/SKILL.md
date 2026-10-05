---
name: ticket
description: Take a ticket ID (e.g. FE-018) from latest main to an open PR — branch, implement, check, push, open PR.
argument-hint: <TICKET-ID | #issue> [extra notes]
disable-model-invocation: true
---

Ticket: $ARGUMENTS

Do every step without stopping to ask, unless the ticket is unclear or
conflicts with `docs/SYSTEM_DESIGN.md` or `docs/VERSIONING.md` (ask then).

## 0. Resolve the ticket

The argument is either a ticket ID (`FE-018`) or a GitHub issue
(`#40` or `40`). Issue numbers do NOT always match ticket numbers
(FE-018 is #40).

- **Issue number:** `gh issue view <N> --json number,title,body,state`.
  The ticket ID is the start of the title (`FE-014 · Runs screen`).
  Use the issue body as extra context. If the issue is closed, stop and say so.
- **Ticket ID:** find the issue with
  `gh issue list --state open --search "<ID> in:title" --json number,title`.
  If there is none, keep going and say so in the final reply.

You now have both the ticket ID and the issue number (if any). Keep the
issue title: it becomes the PR title.

## 1. Branch from latest main

- `git status` must be clean. If not, stop and tell the user.
- `git fetch origin`
- `git switch -c <type>/<id-lowercase>-<short-slug> origin/main`
  - `<type>`: `feat`, `fix`, `docs`, `chore` or `refactor`
  - Example: `feat/fe-018-app-header`

## 2. Read the ticket

- Find the ticket in `docs/TASKS.md` and read its acceptance criteria.
- Check the version's `Excludes:` line in `docs/VERSIONING.md`. Features
  from later versions stay out.
- Read the matching parts of `docs/SYSTEM_DESIGN.md` (`## API design`,
  `## Schemas`, `## Frontend`).
- Check the matching screen in `artifacts/job-lighthouse-prototype.html`
  before building UI.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing
  Next.js code (AGENTS.md: this is not the Next.js you know).

## 3. Implement

- Use `/tdd` where possible, at clear seams.
- Run single test files often while working (`bun run test <path>`).
- Follow the architecture rules in `AGENTS.md` (no BFF, one JWT for both
  services, no Notion, no rescore).
- Use `/code-review` to review the work, and fix what it finds.

## 4. Update docs

- Strike the ticket in `docs/TASKS.md`, with every acceptance criterion
  checked.
- Update `docs/SYSTEM_DESIGN.md` if what was built differs from it.

## 5. Check

- `bun run lint`, `bunx tsc --noEmit`, `bun run test`, `bun run build`.
  Fix failures and re-run until green.

## 6. Commit, push, open PR

- Commit message: `feat: <summary> (<ID>)` (type matches the branch).
- `git push -u origin HEAD`
- `gh pr create --base main --title "<issue title>" --body ...`
  - Title is the GitHub issue title exactly, e.g. `FE-014 · Runs screen`.
  - Body follows PR #19: starts with `Closes #<issue>`, then sections
    What / Acceptance criteria (ticked checklist) / Changes / Env vars /
    Testing.
  - Testing says plainly what was not run against the real backend.
  - End the body with the attribution line from the system reminder.
- After creating, check `closingIssuesReferences` includes the issue.
  GitHub can take a few seconds to fill it in.

## 7. Report

Reply with the PR URL and one line per notable decision or open question.
