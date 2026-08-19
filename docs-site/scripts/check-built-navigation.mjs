#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  {
    file: "dist/client/index.html",
    markers: ["VPSidebar", "VPDocAside", "全栈主干"],
  },
  {
    file: "dist/client/notes/model-to-hardware-mapping.html",
    markers: ["VPSidebar", "VPDocAside", "Model-to-Hardware Mapping"],
  },
  {
    file: "dist/client/en/index.html",
    markers: ["VPSidebar", "VPDocAside", "Full-Stack Backbone"],
  },
  {
    file: "dist/client/en/notes/model-to-hardware-mapping.html",
    markers: ["VPSidebar", "VPDocAside", "Model-to-Hardware Mapping"],
  },
];

const errors = [];
for (const page of pages) {
  const target = path.join(siteRoot, page.file);
  if (!existsSync(target)) {
    errors.push(`${page.file}: built page is missing`);
    continue;
  }
  const source = readFileSync(target, "utf8");
  for (const marker of page.markers) {
    if (!source.includes(marker)) errors.push(`${page.file}: missing rendered navigation marker ${marker}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Built navigation check passed for Chinese and English routes.");
