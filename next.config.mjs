/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    cpus: 1,
    workerThreads: false,
    staticGenerationRetryCount: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/**",
      },
    ],
  },
  /**
   * В development отключаем файловый кэш Webpack — иначе после перезапуска `next dev`
   * иногда остаётся старая карта чанков: HTML ссылается на CSS, которого уже нет → 400 и «голая» страница.
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
