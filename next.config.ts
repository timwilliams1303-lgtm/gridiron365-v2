import type {
  NextConfig,
} from "next";


const nextConfig:
  NextConfig = {
    images: {
      remotePatterns: [
        {
          protocol:
            "https",

          hostname:
            "a.espncdn.com",

          pathname:
            "/i/headshots/nfl/players/full/**",
        },

        {
          protocol:
            "https",

          hostname:
            "a.espncdn.com",

          pathname:
            "/**",
        },
      ],
    },
  };


export default nextConfig;