#!/usr/bin/env node
// The package ships TypeScript source; tsx runs it without a build step.
import { register } from "tsx/esm/api";

register();
const { main } = await import("../src/cli.ts");
process.exitCode = await main(process.argv.slice(2));
