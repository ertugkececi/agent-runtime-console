# agent-runtime-console

React console for
[agent-runtime-platform](https://github.com/ertugkececi/agent-runtime-platform).
Vite + React + TypeScript. The API client is generated from the platform's
[`contracts/openapi.json`](https://github.com/ertugkececi/agent-runtime-platform/blob/main/contracts/openapi.json);
no API type here is written by hand.

## Requirements

- Node.js 22, the version CI uses

## Setup

```sh
npm ci
```

## Develop

Start the platform backend on `http://127.0.0.1:8000` (see the platform
README), then run:

```sh
npm run dev
```

The backend sends no CORS headers, so the dev server proxies the contract paths
to the backend; the proxy list lives in `vite.config.ts`. `/auth/*` is proxied
too, so session, sign-in, callback and logout work in development. When the
backend runs with `AGENT_RUNTIME_AUTH_MODE=oidc`, set
`AGENT_RUNTIME_OIDC_REDIRECT_URI=http://127.0.0.1:5173/auth/callback`: the
backend only accepts state-changing requests whose `Origin` equals the redirect
URI's origin.

## Auth and CSRF

The console reads the session from `GET /auth/session`, keeps the CSRF token
from that response in memory, sends it as `X-CSRF-Token` on every state-changing
request, and returns to the sign-in screen when a request answers `401`. With
`AGENT_RUNTIME_AUTH_MODE=off` the endpoint reports `auth_enabled: false` and the
console behaves as it did before auth existed.

## Agent catalog

The catalog lists every registered agent, disabled ones included. Disabling is
a `PATCH /agents/{id}` with `enabled: false`; the console never deletes an
agent, so conversations, tasks and run snapshots keep the references they
recorded.

The capability filter calls `GET /agents?capability=...`. It trims and
lowercases the typed value exactly as the backend normalises capabilities
(`strip().casefold()`), so the match is an exact value match, not a substring
search. That filter returns enabled agents only, which the screen states next
to the input.

## Agent definition fields

The form offers only the fields the platform API enforces, and it discovers
what each provider supports from the API instead of keeping a provider list of
its own:

- `GET /agent-config/catalog` carries every configured provider's
  `supports_tool_ids`, from its manifest, and `model_catalog_url` for the
  providers the platform serves a model catalog for.
- Model and reasoning-effort choices come from that catalog. A provider
  without a catalog keeps a free-text model field and shows no effort control;
  a model's `efforts` are the only efforts offered for it. A stored model or
  effort the catalog no longer lists stays visible, so an edit cannot drop it,
  and `model_reasoning_effort` is sent only when it changes to a new value —
  the API drops explicit nulls, so once set it cannot be cleared.
- Tool grants come from `GET /mcp/tools`, and only from entries the
  administrator approved as read-only (`trusted_read_only`). A stored grant the
  catalog no longer lists is shown with an explicit "İzni kaldır" action, and
  the form refuses a tool change while such a grant remains. Switching to a
  provider that declares no tool support submits an empty `tool_ids` and says
  so before saving.

This keeps the API the only gate: the console offers no value the platform
would answer with `422`.

## Chat and run timeline

The chat screen talks to one enabled agent through the human-chat endpoints.
Sending is asynchronous: `POST /chat/conversations/{id}/messages/async` answers
`202` with the run id, and the console follows that run with
`GET /runs/{run_id}` until the platform reports `completed` or `failed`. The
status line shows `Sırada`/`Çalışıyor`/`Tamamlandı`/`Başarısız`, the queue
attempt count while a job is queued, and the `error_code` of a failed run. A
second message waits for the running one; the backend has one worker, and the
console does not pretend otherwise.

The conversation id lives in `localStorage`, so a refresh reloads the history
with `GET /conversations/{id}` and resumes the newest user message's run: a run
still in `queued`/`running` keeps being polled, and its state is visible without
reloading. `Yeni sohbet` starts a new conversation with the selected agent; a
stored conversation that no longer exists, or that belonged to an agent that
has since been disabled, is not shown as if it were the current chat.

The timeline is built from the run's `events`. It renders a label per event type
and only a fixed set of payload fields — identifiers, statuses, error codes,
counts and model names. Message content and tool arguments are never rendered:
an `mcp_tool_call` shows the server, tool, status and phase, so the call is
visible but what it was called with is not.

## Group rooms

The room screen runs a bounded group of 2–5 enabled agents over one task at a
time. The order the agents are selected in is the speaking order, and the
moderator is one of the participants. The create button is only enabled for a
named room whose selected participants number 2–5 and whose moderator is among
them — the same constraints `POST /rooms` enforces again.

A task is queued with `POST /rooms/{id}/runs`, which answers `202` with the run
id; the console follows it with `GET /runs/{run_id}` until the platform reports
`completed` or `failed`, so the `turns` and the status line update live. A
second task waits for the running one. A turn whose `phase` is
`moderator_summary` is the moderator's closing answer (also carried as
`final_answer`); every other turn is a participant contribution. A failed run
shows its `error_code`.

The API has no "list rooms" endpoint, so the browser keeps the ids it created
or opened in `localStorage` for quick selection; the room records and the task
history live in the server database, and another browser or device does not see
this list. Opening a room loads `GET /rooms/{id}` and `GET /rooms/{id}/runs`,
and a refresh resumes the newest run still in `queued`/`running` instead of
showing it as finished.

## Graph views

The graph screen renders the platform's graph nature with `@xyflow/react` and
an automatic `elkjs` layered layout. There is nothing to enter by hand: every
node and edge is derived from an API read, and dragging is off because the
layout is computed.

- **Agent–capability** (`GET /agents`): one node per registered agent and one
  per capability any agent declares, with membership edges from the agents'
  `agent_capabilities` records. A disabled agent says so on its node.
- **Handoff chain** (`GET /runs/{run_id}`): the stored conversation's runs.
  Each run is a node, the agent it targeted is a node, and every delegated task
  is an edge labelled with the capability it asked for; repeated handoffs
  between the same pair collapse into one edge carrying a count. The run detail
  prints the run's `run_events` through the same fixed safe-key list the chat
  timeline uses, so a rejection is visible with its reason.
- **Room flow** (`GET /rooms/{id}`, `GET /rooms/{id}/runs`): the selected run's
  turns in speaking order, the moderator's participant turn and summary marked,
  with the run's events on the turn detail. A room without a run shows its
  participant order instead.

The API has no "list runs" endpoint, so the handoff view reads the runs the
stored conversation records, most recent 20 at a time, and says when it
truncated. Selecting a node opens a detail panel — agent fields and the runs
the agent took part in, a capability's holders and handoff event counts, or a
run's/turn's events — and moves focus there. Nodes are focusable: Tab moves
between them, Enter or Space selects, every node carries a readable
`aria-label`, and the canvas is followed by a text summary of its nodes and
edges.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```

CI runs the same three commands on Linux and is the authority.

## Regenerate the API client

```sh
npm run generate:api
```

This fetches the contract from the platform repository's `main` branch and
rewrites `src/api/schema.d.ts`. Run it when the contract changes and commit the
result; the platform repository's contract test is the gate on the contract
side.

## Build output

`npm run build` writes `dist/`. CI uploads it as the `console-dist` artifact;
the files are meant to be embedded into the backend's
`src/agent_runtime_platform/static/` directory.
