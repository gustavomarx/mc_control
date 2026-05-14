import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'firebase-admin'],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
