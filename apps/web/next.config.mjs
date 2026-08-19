/** @type {import('next').NextConfig} */
const nextConfig = {
  // xterm.js's internal ResizeObserver throws during React Strict Mode's dev-only
  // mount→unmount→remount cycle (a known upstream incompatibility). Strict Mode's
  // extra checks only run in development, so this has no effect on production.
  reactStrictMode: false,
  transpilePackages: ["@cybersim/types"],
};

export default nextConfig;
