import assert from "node:assert/strict";
import test from "node:test";
import {
  configureTechnicalDiagrams,
  isTechnicalDiagramSource,
  toPublicAssetUrl,
} from "../.vitepress/markdown/technical-diagrams.mjs";
import {
  getReturnFocusTarget,
  restoreDiagramScrollPosition,
  setDiagramScrollLocked,
} from "../.vitepress/theme/technical-diagram-focus.mjs";

class FakeToken {
  constructor(type, tag = "", nesting = 0, attributes = {}) {
    this.attrs = Object.entries(attributes);
    this.content = "";
    this.map = null;
    this.nesting = nesting;
    this.tag = tag;
    this.type = type;
  }

  attrGet(name) {
    return this.attrs.find(([key]) => key === name)?.[1] ?? null;
  }
}

const token = (type, attributes = {}, content = "") => {
  const value = new FakeToken(type, "", 0, attributes);
  value.content = content;
  return value;
};

const transform = (children) => {
  let rule;
  const markdown = {
    core: {
      ruler: {
        after(_anchor, _name, callback) {
          rule = callback;
        },
      },
    },
  };

  configureTechnicalDiagrams(markdown);
  const state = {
    Token: FakeToken,
    tokens: [
      token("paragraph_open"),
      Object.assign(token("inline"), { children }),
      token("paragraph_close"),
    ],
  };
  rule(state);
  return state.tokens;
};

test("recognizes only repository diagram SVGs by default", () => {
  assert.equal(isTechnicalDiagramSource("../assets/diagrams/example.svg"), true);
  assert.equal(isTechnicalDiagramSource("../../assets/diagrams/nvidia/example.svg"), true);
  assert.equal(isTechnicalDiagramSource("/assets/diagrams/example.svg?v=1"), true);
  assert.equal(isTechnicalDiagramSource("https://example.com/assets/diagrams/example.svg"), false);
  assert.equal(isTechnicalDiagramSource("../assets/diagrams/../images/example.svg"), false);
  assert.equal(isTechnicalDiagramSource("../assets/images/screenshot.svg"), false);
  assert.equal(isTechnicalDiagramSource("../assets/diagrams/example.png"), false);
});

test("normalizes canonical docs assets to public URLs", () => {
  assert.equal(toPublicAssetUrl("../assets/diagrams/example.svg#detail"), "/assets/diagrams/example.svg#detail");
  assert.equal(toPublicAssetUrl("assets/images/example.svg"), "/assets/images/example.svg");
  assert.equal(toPublicAssetUrl("https://example.com/example.svg"), "https://example.com/example.svg");
});

test("replaces a standalone linked diagram with the Vue figure component", () => {
  const output = transform([
    token("link_open", { href: "https://example.com/untrusted.svg" }),
    token("image", { src: "../assets/diagrams/example.svg" }, "A claim, not a heading"),
    token("link_close"),
  ]);

  assert.equal(output.length, 1);
  assert.equal(output[0].type, "html_block");
  assert.match(output[0].content, /<TechnicalDiagram/);
  assert.match(output[0].content, /src="\/assets\/diagrams\/example\.svg"/);
  assert.match(output[0].content, /raw-href="\/assets\/diagrams\/example\.svg"/);
  assert.doesNotMatch(output[0].content, /example\.com/);
  assert.match(output[0].content, /alt="A claim, not a heading"/);
  assert.match(output[0].content, /caption="A claim, not a heading"/);
});

test("keeps descriptive alt separate from a conclusion caption", () => {
  const output = transform([
    token(
      "image",
      {
        src: "../assets/diagrams/example.svg",
        title: "Both paths converge on the shared runtime",
      },
      "Two compiler paths feed a shared runtime, which submits work to TPU hardware",
    ),
  ]);

  assert.match(
    output[0].content,
    /alt="Two compiler paths feed a shared runtime, which submits work to TPU hardware"/,
  );
  assert.match(
    output[0].content,
    /caption="Both paths converge on the shared runtime"/,
  );
});

test("does not allow title sentinels to bypass the canonical diagram directory", () => {
  const outsideDirectory = transform([
    token("image", { src: "../assets/images/model.svg", title: "technical-diagram" }, "Model claim"),
  ]);
  const external = transform([
    token(
      "image",
      { src: "https://example.com/assets/diagrams/model.svg", title: "technical-diagram" },
      "External model claim",
    ),
  ]);

  assert.equal(outsideDirectory.length, 3);
  assert.equal(outsideDirectory[1].type, "inline");
  assert.equal(external.length, 3);
  assert.equal(external[1].type, "inline");
});

test("leaves mixed prose and images untouched", () => {
  const output = transform([
    token("text", {}, "See "),
    token("image", { src: "../assets/diagrams/example.svg" }, "Example"),
  ]);

  assert.equal(output.length, 3);
  assert.equal(output[1].type, "inline");
});

test("escapes component attributes", () => {
  const output = transform([
    token(
      "image",
      {
        src: "../assets/diagrams/example.svg",
        title: 'Claim: A > B & "bounded"',
      },
      'Description: A < B & "quoted"',
    ),
  ]);

  assert.match(output[0].content, /alt="Description: A &lt; B &amp; &quot;quoted&quot;"/);
  assert.match(output[0].content, /caption="Claim: A &gt; B &amp; &quot;bounded&quot;"/);
});

test("restores dialog focus only to a meaningful HTML element", () => {
  class FakeHTMLElement {}
  const documentObject = {
    body: new FakeHTMLElement(),
    defaultView: { HTMLElement: FakeHTMLElement },
    documentElement: new FakeHTMLElement(),
  };
  const opener = new FakeHTMLElement();

  assert.equal(getReturnFocusTarget(opener, documentObject), opener);
  assert.equal(getReturnFocusTarget(documentObject.body, documentObject), null);
  assert.equal(getReturnFocusTarget(documentObject.documentElement, documentObject), null);
  assert.equal(getReturnFocusTarget({}, documentObject), null);
});

test("locks and unlocks page scrolling while the modal diagram is open", () => {
  const calls = [];
  const styleCalls = [];
  const scrollCalls = [];
  const documentObject = {
    body: {
      style: {
        removeProperty(name) {
          styleCalls.push(["remove", name]);
        },
        setProperty(name, value) {
          styleCalls.push(["set", name, value]);
        },
      },
    },
    defaultView: {
      scrollX: 12,
      scrollY: 345,
      scrollTo(...args) {
        scrollCalls.push(args);
      },
    },
    documentElement: {
      dataset: {},
      style: { scrollBehavior: "smooth" },
      classList: {
        toggle(name, force) {
          calls.push([name, force]);
        },
      },
    },
  };

  assert.equal(setDiagramScrollLocked(documentObject, true), null);
  assert.deepEqual(setDiagramScrollLocked(documentObject, false), {
    scrollX: 12,
    scrollY: 345,
  });

  assert.deepEqual(calls, [
    ["technical-diagram-dialog-open", true],
    ["technical-diagram-dialog-open", false],
  ]);
  assert.deepEqual(styleCalls, [
    ["set", "--technical-diagram-scroll-left", "-12px"],
    ["set", "--technical-diagram-scroll-top", "-345px"],
    ["remove", "--technical-diagram-scroll-left"],
    ["remove", "--technical-diagram-scroll-top"],
  ]);
  assert.deepEqual(scrollCalls, [[12, 345]]);
  assert.equal(documentObject.documentElement.style.scrollBehavior, "smooth");

  restoreDiagramScrollPosition(documentObject, { scrollX: 1, scrollY: 2 });
  assert.deepEqual(scrollCalls, [[12, 345], [1, 2]]);
  assert.equal(documentObject.documentElement.style.scrollBehavior, "smooth");
});
