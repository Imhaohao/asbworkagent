import type { NextConfig } from "next";
import path from "node:path";

/**
 * Lockfile in a parent directory (e.g. ~/package-lock.json) can make Next infer
 * the wrong workspace root, which breaks Turbopack writes under `.next/` (ENOENT
 * on app-build-manifest / _buildManifest tmp files). Pin both tracing and
 * Turbopack to this app directory.
 */
const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
