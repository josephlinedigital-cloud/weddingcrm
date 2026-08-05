import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return ["photography", "accommodation", "transport", "gifts"].map((section) => ({
      source: `/${section}`,
      destination: "/dashboard",
      permanent: false,
    }));
  },
};

export default nextConfig;
