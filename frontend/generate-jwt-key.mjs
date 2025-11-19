#!/usr/bin/env node
import { exportPKCS8, generateKeyPair } from "jose";

console.log("Generating JWT key pair using jose library...\n");

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);

// Format for Convex: replace newlines with spaces
const formattedKey = privateKey.trimEnd().replace(/\n/g, " ");

console.log("=".repeat(80));
console.log("JWT_PRIVATE_KEY for Convex Dashboard (DEV)");
console.log("=".repeat(80));
console.log("\nCopy this entire value (including BEGIN and END):\n");
console.log(formattedKey);
console.log("\n" + "=".repeat(80));
console.log("\nInstructions:");
console.log("1. Go to https://dashboard.convex.dev");
console.log("2. Select: smart-transcribe project");
console.log("3. Settings → Environment Variables → Development");
console.log("4. Edit JWT_PRIVATE_KEY");
console.log("5. Paste the key above");
console.log("6. Save");
console.log("=".repeat(80));
