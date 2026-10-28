#!/usr/bin/env node
// Purpose: DATABASE_URL check — DNS resolve + TCP reachability (kya Vercel se DB khulega?)
//
// Serverless (Vercel) me sabse common failure: galat pooler host ya IPv6-only host.
// Ye script candidates try karta hai aur batata hai kaunsa reachable hai.
//
//   node scripts/check-db-connectivity.mjs              # sirf DATABASE_URL check
//   node scripts/check-db-connectivity.mjs --probe      # Supabase candidates bhi try karo

import { lookup } from "node:dns/promises";
import { connect } from "node:net";

const TIMEOUT_MS = 4000;

function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function describe(host, port) {
  const out = { host, port, dns: [], tcp: false };
  try {
    const records = await lookup(host, { all: true });
    out.dns = records.map((record) => `${record.address} (IPv${record.family})`);
    out.tcp = await tcpProbe(host, port);
  } catch (error) {
    out.error = error.code ?? String(error);
  }
  return out;
}

const args = new Set(process.argv.slice(2));
const url = process.env.DATABASE_URL;

const targets = [];
if (url) {
  try {
    const parsed = new URL(url);
    targets.push([parsed.hostname, Number(parsed.port || 5432)]);
  } catch {
    console.log("DATABASE_URL parse nahi hua (format check karo)");
  }
}

if (args.has("--probe")) {
  const ref = process.env.SUPABASE_REF;
  const region = process.env.SUPABASE_REGION ?? "ap-south-1";
  if (ref) targets.push([`db.${ref}.supabase.co`, 5432]);
  for (const prefix of ["aws-0", "aws-1"]) {
    for (const port of [6543, 5432]) targets.push([`${prefix}-${region}.pooler.supabase.com`, port]);
  }
}

if (targets.length === 0) {
  console.log("DATABASE_URL set nahi hai aur --probe ke liye SUPABASE_REF bhi nahi mila.");
  process.exit(0);
}

for (const [host, port] of targets) {
  const result = await describe(host, port);
  console.log(
    JSON.stringify({
      target: `${host}:${port}`,
      dns: result.dns,
      tcp: result.tcp,
      verdict: result.tcp ? "REACHABLE" : result.error ? `FAILED ${result.error}` : "UNREACHABLE",
    }),
  );
}
