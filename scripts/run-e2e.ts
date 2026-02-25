#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    const valueRaw = line.slice(equalsIndex + 1).trim();

    if (!key) continue;
    if (process.env[key] !== undefined) continue;

    let value = valueRaw;
    const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
    const isSingleQuoted = value.startsWith("'") && value.endsWith("'");

    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const workspaceRoot = process.cwd();
const envPath = resolve(workspaceRoot, ".env.local");
loadEnvFile(envPath);

if (!process.env.BASE_URL) {
  process.env.BASE_URL = "http://localhost:3000";
}

const args = process.argv.slice(2);
const result = spawnSync("bunx", ["playwright", "test", ...args], {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
