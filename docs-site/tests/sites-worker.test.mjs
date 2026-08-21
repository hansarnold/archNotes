import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import worker from "../worker/index.js";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publishableExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const listFiles = async (root, directory = root) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, target));
    else if (entry.isFile()) files.push(path.relative(root, target));
  }
  return files;
};

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("expands social image metadata against the request origin", async () => {
  const response = await worker.fetch(
    new Request("https://docs.example.test/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response(
          '<meta property="og:image" content="__ARCHNOTES_ORIGIN__/og.png">',
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        ),
      },
    },
  );

  assert.match(await response.text(), /https:\/\/docs\.example\.test\/og\.png/);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/client/og.png", import.meta.url));
});

test("packages every technical diagram referenced by built pages", async () => {
  const clientRoot = path.join(siteRoot, "dist", "client");
  const sourceAssetsRoot = path.resolve(siteRoot, "..", "docs", "assets");
  const publishedAssetsRoot = path.join(clientRoot, "assets");
  const diagramRoot = path.join(publishedAssetsRoot, "diagrams");
  const sourceAssets = (await listFiles(sourceAssetsRoot))
    .filter((file) => publishableExtensions.has(path.extname(file).toLowerCase()));
  const htmlFiles = (await listFiles(clientRoot)).filter((file) => file.endsWith(".html"));
  const references = new Set();

  assert.ok(sourceAssets.length > 0, "source content should contain publishable image assets");
  for (const relativePath of sourceAssets) {
    await access(path.join(publishedAssetsRoot, relativePath));
  }

  for (const relativePath of htmlFiles) {
    const source = await readFile(path.join(clientRoot, relativePath), "utf8");
    for (const match of source.matchAll(/["'](\/assets\/diagrams\/[^"'?#]+)(?:[?#][^"']*)?["']/g)) {
      references.add(match[1]);
    }
  }

  assert.ok(references.size > 0, "built pages should reference at least one technical diagram");
  for (const reference of references) {
    const decoded = decodeURIComponent(reference);
    const relativePath = decoded.slice("/assets/diagrams/".length);
    assert.ok(
      relativePath.split("/").every((segment) => segment && segment !== "." && segment !== ".."),
      `diagram reference must stay inside the published diagram directory: ${reference}`,
    );
    const target = path.resolve(diagramRoot, relativePath);
    assert.ok(
      target.startsWith(`${diagramRoot}${path.sep}`),
      `diagram reference must resolve inside the published diagram directory: ${reference}`,
    );
    await access(target);
  }
});
