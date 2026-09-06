import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // Next.js aliases this to its own compiled shim at build time;
      // Vitest needs an explicit target instead. See the comment in
      // lib/testing/server-only-stub.ts.
      "server-only": path.resolve(import.meta.dirname, "./lib/testing/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
})
