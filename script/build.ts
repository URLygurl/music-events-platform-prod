import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  console.log("building client...");
  await viteBuild();
  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    target: "node22",
    bundle: true,
    format: "esm",
    outfile: "dist/index.js",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    // Keep native CommonJS/ESM dependencies intact. Bundle our TS modules only.
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})],
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
