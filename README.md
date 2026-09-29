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
