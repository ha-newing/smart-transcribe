#!/usr/bin/env node
import { exportPKCS8, exportJWK, generateKeyPair } from "jose";

console.log("Generating JWT key pair using jose library...\n");

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);

// Format for Convex: replace newlines with spaces
const formattedPrivateKey = privateKey.trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

console.log("=".repeat(80));
console.log("CONVEX AUTH ENVIRONMENT VARIABLES");
console.log("=".repeat(80));
console.log("\n1. JWT_PRIVATE_KEY:");
console.log("-".repeat(80));
console.log(formattedPrivateKey);
console.log("\n" + "=".repeat(80));
console.log("\n2. JWKS:");
console.log("-".repeat(80));
console.log(jwks);
console.log("\n" + "=".repeat(80));
console.log("\nInstructions:");
console.log("1. Go to https://dashboard.convex.dev");
console.log("2. Select: smart-transcribe project");
console.log("3. Settings → Environment Variables → Development");
console.log("4. Set JWT_PRIVATE_KEY = [value from section 1]");
console.log("5. Set JWKS = [value from section 2]");
console.log("6. Save");
console.log("=".repeat(80));
