// Bundles demo/app.js (+ engine + data) into a single self-contained HTML file.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const res = await build({ entryPoints: ["demo/app.js"], bundle: true, format: "iife", minify: true, write: false, target: "es2020", charset: "utf8" });
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const tpl = readFileSync("demo/template.html", "utf8");
const body = tpl.replace("/*APP_JS*/", () => js);
mkdirSync("dist", { recursive: true });
writeFileSync("dist/artifact.html", body); // body-only (Claude artifact wraps it)
writeFileSync("dist/index.html", `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log("dist/index.html", (body.length / 1024).toFixed(0) + " KB");
