// Regenerates src/api/schema.d.ts from the platform HTTP contract.
//
// contracts/openapi.json in ertugkececi/agent-runtime-platform is the single
// source of truth for the API. This repository generates its client types from
// it and keeps no second copy.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import openapiTS, { COMMENT_HEADER, astToString } from "openapi-typescript";

const CONTRACT_URL =
  "https://raw.githubusercontent.com/ertugkececi/agent-runtime-platform/main/contracts/openapi.json";

const response = await fetch(CONTRACT_URL);
if (!response.ok) {
  throw new Error(`Could not fetch the contract from ${CONTRACT_URL}: ${response.status}`);
}

const ast = await openapiTS(await response.json());
const output = fileURLToPath(new URL("../src/api/schema.d.ts", import.meta.url));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, COMMENT_HEADER + "\n" + astToString(ast));
console.log(`Generated ${output} from ${CONTRACT_URL}`);
