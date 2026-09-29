import createClient from "openapi-fetch";

import type { paths } from "./schema";

// Same origin: the backend serves the built console, and the Vite dev server
// proxies the contract paths to it (see vite.config.ts). `paths` is generated
// from the platform contract; no API type here is written by hand.
export const api = createClient<paths>();
