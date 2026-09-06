// Next.js aliases the bare "server-only" import to its own compiled
// shim at build time (next/dist/build/create-compiler-aliases.js) so
// app code never needs it as a real dependency. Vitest doesn't run
// through Next's webpack/turbopack config, so a module that starts with
// `import "server-only"` fails to resolve under Vitest unless something
// else satisfies that specifier - this file is that target, wired in via
// the `server-only` alias in vitest.config.mts. It intentionally does
// nothing; it exists purely so provider/service modules that guard
// themselves against client-bundle imports remain importable from tests.
export {}
