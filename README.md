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
