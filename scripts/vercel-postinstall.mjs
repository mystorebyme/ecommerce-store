// Purpose: Vercel build-only setup — Prisma client generate + serverless bundle
//
// Kyun `postinstall`: Vercel "install" step me hi ye chal jaata hai, aur jab project me
// custom build command nahi hota (framework `express` + `api/` functions) tab bhi chalta hai.
// Local `npm install` par ye script chup-chaap skip ho jaati hai — kyunki laptop par
// Prisma engine download aur kabhi-kabhi network nahi hota, aur dev ko uski zarurat bhi nahi.
//
// Kya karti hai:
//   1. `prisma generate` — Linux (rhel-openssl-3.0.x) engine ke saath client banata hai
//   2. `api:bundle` — esbuild se `api/_lib/serverless.js` (CJS) banata hai, jise
//      `api/v1/[...path].ts` require karta hai. Vercel ka TS tracing workspace imports
//      par fail hota tha, isliye pehle se bundled file ship karte hain.

import { spawnSync } from "node:child_process";

if (!process.env.VERCEL) {
  process.exit(0); // local install — kuch nahi karna
}

const steps = ["prisma:generate", "api:bundle"];

for (const step of steps) {
  const result = spawnSync("npm", ["run", step], { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error(`[vercel-postinstall] step failed: ${step}`);
    process.exit(result.status ?? 1);
  }
}
