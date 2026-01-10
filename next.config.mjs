import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverComponentsExternalPackages: ['ecash-lib', 'ecashaddrjs'],
  },

  webpack: function (config, { isServer }) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (isServer) {
      config.output.webassemblyModuleFilename = './../static/wasm/[modulehash].wasm';
    } else {
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
    }

    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./.next/server/app/swap/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./server/app/swap/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./app/swap/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./vendor-chunks/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./../static/wasm/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./.next/server/app/promote/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./server/app/promote/",
          },
          {
            from: "node_modules/ecash-lib/dist/ffi/ecash_lib_wasm_bg_nodejs.wasm",
            to: "./app/promote/",
          },
        ],
      }),
    );

    return config;
  },
};

export default nextConfig;
