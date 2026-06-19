#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { assert, readJson, repoPath } from "./governance-lib.mjs";

const README_FILES = ["README.md", "README.zh-CN.md", "README.ja-JP.md", "README.ko-KR.md"];
const REQUIRED_PUBLIC_IMAGES = [
  "docs/images/contact-qr.png",
  "docs/images/wechat-pay.jpg",
  "docs/images/alipay.jpg",
];
const REQUIRED_PUBLIC_DOCS = [
  "docs/meta-kim-project-manual.md",
  "docs/meta-kim-project-manual.zh-CN.md",
];
const README_DOC_LINKS = {
  "README.md": REQUIRED_PUBLIC_DOCS,
  "README.zh-CN.md": REQUIRED_PUBLIC_DOCS,
};

const pkg = await readJson("package.json");
const gitignore = await fs.readFile(repoPath(".gitignore"), "utf8");

assert(/^docs\/\*\*$/m.test(gitignore), ".gitignore must keep docs private by default");
assert(/^!docs\/$/m.test(gitignore), ".gitignore must allow the docs directory for public image exceptions");
assert(/^!docs\/images\/$/m.test(gitignore), ".gitignore must allow docs/images/");
assert(/^!docs\/images\/\*\*$/m.test(gitignore), ".gitignore must allow docs/images/**");
assert(
  /^!docs\/meta-kim-project-manual\.md$/m.test(gitignore),
  ".gitignore must allow the English project manual",
);
assert(
  /^!docs\/meta-kim-project-manual\.zh-CN\.md$/m.test(gitignore),
  ".gitignore must allow the Chinese project manual",
);
assert(
  (pkg.files ?? []).includes("docs/images/"),
  "package.json files must include docs/images/ because README references those assets",
);
for (const doc of REQUIRED_PUBLIC_DOCS) {
  assert(
    (pkg.files ?? []).includes(doc),
    `package.json files must include ${doc} because README references it`,
  );
}

function gitTracked(relativePath) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd: repoPath("."),
    encoding: "utf8",
  });
  return result.status === 0;
}

function extractDocsImages(markdown) {
  const refs = new Set();
  for (const match of markdown.matchAll(/!\[[^\]]*\]\((docs\/images\/[^)\s]+)\)/g)) {
    refs.add(match[1]);
  }
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc=["'](docs\/images\/[^"']+)["'][^>]*>/gi)) {
    refs.add(match[1]);
  }
  return [...refs].sort();
}

const referenced = new Set();
for (const file of README_FILES) {
  const markdown = await fs.readFile(repoPath(file), "utf8");
  const refs = extractDocsImages(markdown);
  assert(refs.length > 0, `${file} must keep README image references explicit`);
  for (const ref of refs) {
    referenced.add(ref);
    await fs.access(repoPath(ref));
    assert(gitTracked(ref), `${ref} referenced by ${file} must be tracked`);
  }

  for (const ref of README_DOC_LINKS[file] ?? []) {
    assert(markdown.includes(ref), `${file} must link ${ref}`);
  }
}

for (const image of REQUIRED_PUBLIC_IMAGES) {
  assert(referenced.has(image), `${image} must remain referenced by README files`);
  await fs.access(repoPath(image));
  assert(gitTracked(image), `${image} must be tracked as a public README asset`);
}

for (const doc of REQUIRED_PUBLIC_DOCS) {
  await fs.access(repoPath(doc));
  assert(gitTracked(doc), `${doc} must be tracked as a public README document`);
}

console.log(
  `public docs image assets valid: ${referenced.size} README image assets and ${REQUIRED_PUBLIC_DOCS.length} project manual(s) checked`,
);
