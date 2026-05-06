import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'firebase-admin'],
};

export default nextConfig;
