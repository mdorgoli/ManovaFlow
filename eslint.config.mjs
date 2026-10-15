import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  globalIgnores([
    ".next/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
    "artifacts/**",
    "outputs/**",
    "proposals/**",
    "work/**",
    ".tmp/**",
    ".npm-cache/**",
    ".pnpm-store/**",
    ".venv-loadtest/**"
  ])
]);
