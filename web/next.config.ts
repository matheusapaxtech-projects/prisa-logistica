import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // O extrato OFX vai pela Server Action de importação (até 4 MB; o padrão de 1 MB cortava extratos longos).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
