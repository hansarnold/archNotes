#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(root, "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const contentAssets = path.join(repositoryRoot, "docs", "assets");
const sitePublic = path.join(root, "public");

const publishableExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const copyPublishableAssets = (source, destination) => {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyPublishableAssets(sourcePath, destinationPath);
    } else if (entry.isFile() && publishableExtensions.has(path.extname(entry.name).toLowerCase())) {
      copyFileSync(sourcePath, destinationPath);
    }
  }
};

for (const file of [index, worker, hosting, contentAssets]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
copyPublishableAssets(contentAssets, path.join(dist, "client", "assets"));
copyPublishableAssets(sitePublic, path.join(dist, "client"));

console.log("Prepared Sites build: worker, hosting metadata, and published image assets");
