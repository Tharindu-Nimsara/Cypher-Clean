const fs = require("fs");
const path = require("path");

function readProjectFiles(folderPath) {
  const ignoredDirs = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".cache",
    "coverage",
  ]);
  const maxDepth = 4;
  const maxReadmeChars = 12000;
  const maxSnippetChars = 8000;
  const maxDeps = 30;

  const readmeCandidates = [];
  const packageCandidates = [];
  const pyprojectCandidates = [];
  const requirementsCandidates = [];
  const pipfileCandidates = [];
  const setupPyCandidates = [];
  const pomCandidates = [];
  const gradleCandidates = [];
  const settingsGradleCandidates = [];
  const appPropsCandidates = [];
  const appYmlCandidates = [];

  function walk(dir, depth = 0) {
    if (depth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name.toLowerCase())) {
          continue;
        }
        walk(fullPath, depth + 1);
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (lowerName === "package.json") {
        packageCandidates.push(fullPath);
      } else if (lowerName === "readme.md" || lowerName === "readme") {
        readmeCandidates.push(fullPath);
      } else if (lowerName === "pyproject.toml") {
        pyprojectCandidates.push(fullPath);
      } else if (lowerName === "requirements.txt") {
        requirementsCandidates.push(fullPath);
      } else if (lowerName === "pipfile") {
        pipfileCandidates.push(fullPath);
      } else if (lowerName === "setup.py") {
        setupPyCandidates.push(fullPath);
      } else if (lowerName === "pom.xml") {
        pomCandidates.push(fullPath);
      } else if (
        lowerName === "build.gradle" ||
        lowerName === "build.gradle.kts"
      ) {
        gradleCandidates.push(fullPath);
      } else if (
        lowerName === "settings.gradle" ||
        lowerName === "settings.gradle.kts"
      ) {
        settingsGradleCandidates.push(fullPath);
      } else if (lowerName === "application.properties") {
        appPropsCandidates.push(fullPath);
      } else if (
        lowerName === "application.yml" ||
        lowerName === "application.yaml"
      ) {
        appYmlCandidates.push(fullPath);
      }
    }
  }

  function sanitizeReadme(text) {
    if (!text) {
      return "";
    }

    return text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getPathScore(filePath) {
    const relative = path.relative(folderPath, filePath);
    const depth = relative.split(path.sep).length;
    return depth;
  }

  walk(folderPath, 0);

  readmeCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  packageCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  pyprojectCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  requirementsCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  pipfileCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  setupPyCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  pomCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  gradleCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  settingsGradleCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  appPropsCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));
  appYmlCandidates.sort((a, b) => getPathScore(a) - getPathScore(b));

  const sections = [];
  const tags = new Set();

  function addTextSnippet(label, filePath, maxChars = maxSnippetChars) {
    if (!filePath) {
      return;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const text = sanitizeReadme(raw).slice(0, maxChars);
      if (text) {
        sections.push(`${label} (${filePath}):\n${text}`);
      }
    } catch {}
  }

  if (readmeCandidates[0]) {
    addTextSnippet("README", readmeCandidates[0], maxReadmeChars);
  }

  if (packageCandidates.length) {
    const pkgSummaries = [];

    for (const packagePath of packageCandidates.slice(0, 3)) {
      try {
        const raw = fs.readFileSync(packagePath, "utf8");
        const pkg = JSON.parse(raw);

        const deps = Object.keys(pkg.dependencies || {}).slice(0, maxDeps);
        const devDeps = Object.keys(pkg.devDependencies || {}).slice(
          0,
          maxDeps,
        );
        const allDeps = new Set([...deps, ...devDeps]);
        tags.add("nodejs");
        if (allDeps.has("next")) {
          tags.add("nextjs");
        }

        pkgSummaries.push({
          file: packagePath,
          name: pkg.name || null,
          description: pkg.description || null,
          version: pkg.version || null,
          private: pkg.private === true,
          scripts: Object.keys(pkg.scripts || {}),
          dependencies: deps,
          devDependencies: devDeps,
        });
      } catch {}
    }

    if (pkgSummaries.length) {
      sections.push(
        `PACKAGE_JSON_SUMMARY:\n${JSON.stringify(pkgSummaries, null, 2)}`,
      );
    }
  }

  if (
    pyprojectCandidates[0] ||
    requirementsCandidates[0] ||
    pipfileCandidates[0] ||
    setupPyCandidates[0]
  ) {
    tags.add("python");
  }

  if (pomCandidates[0] || gradleCandidates[0] || settingsGradleCandidates[0]) {
    tags.add("java");
  }

  if (appPropsCandidates[0] || appYmlCandidates[0]) {
    tags.add("spring");
  }

  addTextSnippet("PYPROJECT", pyprojectCandidates[0]);
  addTextSnippet("REQUIREMENTS", requirementsCandidates[0]);
  addTextSnippet("PIPFILE", pipfileCandidates[0]);
  addTextSnippet("SETUP_PY", setupPyCandidates[0]);
  addTextSnippet("POM_XML", pomCandidates[0]);
  addTextSnippet("BUILD_GRADLE", gradleCandidates[0]);
  addTextSnippet("SETTINGS_GRADLE", settingsGradleCandidates[0]);
  addTextSnippet("APPLICATION_PROPERTIES", appPropsCandidates[0]);
  addTextSnippet("APPLICATION_YAML", appYmlCandidates[0]);

  return {
    text: sections.join("\n\n"),
    tags: Array.from(tags),
  };
}

module.exports = { readProjectFiles };
