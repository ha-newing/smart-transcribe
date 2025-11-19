/// <reference types="vite/client" />

/**
 * Test modules setup for convex-test
 * This file exports the modules glob pattern used by convexTest
 */

// Glob pattern to include all Convex function files
// Pattern matches: ./**/!(*.*.*)*.*s
// This includes all files with single extension ending in 's' (js, ts)
// Excludes files with multiple dots (like .test.ts, .config.ts)
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
