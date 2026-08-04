import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // El default sigue siendo node: la mayoría de la suite prueba lógica de
    // servicios y utilidades. Los tests de componentes piden DOM con el docblock
    // `@vitest-environment jsdom` en su primera línea.
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup/cleanup.ts"],
    coverage: {
      provider: "v8",
      include: ["config/**", "utils/**", "lib/auth/**"],
    },
  },
});
