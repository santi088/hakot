const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

async function build() {
  const root = path.resolve(__dirname, "..");
  fs.mkdirSync(path.join(root, "public/assets"), { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, "frontend/app.jsx")],
    bundle: true,
    loader: { ".png": "file" },
    assetNames: "[name]-[hash]",
    publicPath: "/assets",
    minify: true,
    outfile: path.join(root, "public/assets/app.js"),
    define: { "process.env.NODE_ENV": '"production"' },
    jsx: "automatic",
    target: ["es2020"],
  });
  fs.copyFileSync(path.join(root, "frontend/index.html"), path.join(root, "public/index.html"));
}
build().catch(error => { console.error(error); process.exitCode = 1; });