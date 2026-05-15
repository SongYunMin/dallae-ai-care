import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig as defineViteConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

const tanstackStartOptions = {
  // TanStack Start의 기본 서버 엔트리 대신 SSR 오류 래퍼를 통과시킨다.
  server: { entry: "server" },
  importProtection: {
    behavior: "error",
    client: {
      files: ["**/server/**"],
      specifiers: ["server-only"],
    },
  },
};

const sharedResolve = {
  alias: {
    "@": `${process.cwd()}/src`,
  },
  dedupe: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "@tanstack/react-query",
    "@tanstack/query-core",
  ],
};

const isVercelBuild = process.env.VERCEL === "1";

export default isVercelBuild
  ? defineViteConfig({
      // Vercel은 Cloudflare Worker 산출물이 아니라 Nitro 산출물을 배포해야 루트 라우트가 404가 나지 않는다.
      server: { host: "::", port: 8080 },
      resolve: sharedResolve,
      plugins: [
        tailwindcss(),
        tsConfigPaths({ projects: ["./tsconfig.json"] }),
        tanstackStart(tanstackStartOptions),
        nitro(),
        viteReact(),
      ],
    })
  : defineLovableConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
