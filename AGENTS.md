# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## cinephile

Local watch tracker: one GitHub commit per watched movie/episode; repo `watched.jsonl` is the source of truth. Stack: Express + TypeScript API in `server/` (credentials stay server-side in gitignored `config.json`), React + Vite frontend in `src/`, three.js cupboard in `src/pages/Cupboard.tsx`.

- Commands: `npm run dev` (API :8787 + Vite :5173), `npm test`, `npm run typecheck`, `npm run build && npm start`. Demo mode: `CINEPHILE_DEMO=1 npm run dev` (fixtures, no credentials, no real commits).
- Core invariant: exactly one commit per watch; season fan-out is N commits in episode order, never squashed. The mocked-GitHub tests in `tests/fanout.test.ts` are the correctness gate — keep them passing when touching `server/watchedService.ts`.
- `server/types.ts` `GitHubApi` is the seam for mocking; `server/watched.ts` owns `watched.jsonl` entry building/parsing; commit message shapes live in `server/commitMessages.ts`.
- Browser checks need `CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9222 chrome-devtools-axi …` against Brave headless (no Chrome installed); see the cupboard canvas a11y wrapper for driving hover/click.
- Launch dev servers with `tsx watch` (plain `tsx` never reloads — a stale server silently serves old code and wastes a debugging session). Demo server: `CINEPHILE_DEMO=1 npm run dev:server`; a second non-demo instance on another port is handy for settings-flow repros.
- react-three-fiber: with nested groups, damp only the INNER group's local offsets (pull-out, rotation delta) — damping a child toward world coordinates doubles transforms and flings meshes out of the scene while raycasts still "work".
- Settings save semantics: blank GitHub token / TMDB key mean "keep current" — `mergeConfigForSave` in `server/config.ts` merges with the stored config before validation; the client (`src/api.ts`) returns 400/502 structured bodies instead of throwing so field errors reach the UI. Regression-tested in `tests/config.test.ts` + `tests/api-client.test.ts`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
