import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image; Vercel ignores it.
  output: "standalone",
  // A second dev server (for the peer node) needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
