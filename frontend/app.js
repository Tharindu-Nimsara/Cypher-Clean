(() => {
  const pickFolderBtn = document.getElementById("pickFolderBtn");
  const scanBtn = document.getElementById("scanBtn");
  const selectedPathText = document.getElementById("selectedPath");
  const statusText = document.getElementById("status");
  const loadingSpinner = document.getElementById("loadingSpinner");

  async function requestJson(url, options) {
    const res = await fetch(url, options);
    let data = null;

    try {
      data = await res.json();
    } catch {}

    return { ok: res.ok, data };
  }

  async function scanFolders(rootPath) {
    return requestJson(`${API_BASE}/scan?path=${encodeURIComponent(rootPath)}`);
  }

  async function fetchFolderSize(folderPath) {
    const { ok, data } = await requestJson(
      `${API_BASE}/size?path=${encodeURIComponent(folderPath)}`,
    );
    return ok ? data?.bytes : null;
  }

  async function fetchProjectMeta(folderPath) {
    const { ok, data } = await requestJson(
      `${API_BASE}/project-meta?path=${encodeURIComponent(folderPath)}`,
    );
    return ok ? data : null;
  }

  async function deleteFolder(folder) {
    return requestJson(`${API_BASE}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
  }

  async function describeFolder(folder) {
    return requestJson(`${API_BASE}/describe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
  }

  function getPathTypeInfo(targetPath) {
    const name = targetPath.split(/[\\/]/).pop()?.toLowerCase() || "";

    if (name === "node_modules") {
      return { key: "node", label: "Node.js Folder", className: "type-node" };
    }

    if (name === "venv" || name === ".venv") {
      return { key: "python", label: "Python Folder", className: "type-python"};
    }

    if (name === ".next") {
      return { key: "next", label: "Next.js Folder", className: "type-next" };
    }

    if (name === "target") {
      return { key: "java", label: "Java Folder", className: "type-java" };
    }

    if (name.includes(".")) {
      return { key: "other", label: "File", className: "type-file" };
    }

    return { key: "other", label: "Folder", className: "type-folder" };
  }

   function formatBytes(bytes) {
    if (!bytes || bytes <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const idx = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = bytes / 1024 ** idx;
    return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
  }

  function formatDate(isoString) {
    if (!isoString) {
      return "Unknown";
    }

    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }

    return date.toLocaleDateString();
  }

  function toTimeValue(isoString) {
    if (!isoString) {
      return Number.NEGATIVE_INFINITY;
    }

    const value = new Date(isoString).getTime();
    return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
  }

  function calculateDeleteSafetyScore(modifiedAtIso) {
    const modifiedAt = new Date(modifiedAtIso);

    if (!modifiedAtIso || Number.isNaN(modifiedAt.getTime())) {
      return null;
    }

    const daysSinceModified = Math.max(
      0,
      (Date.now() - modifiedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(
      0,
      Math.min(100, Math.round((daysSinceModified / 365) * 100)),
    );
  }

  function getDeleteSafetyTone(score) {
    if (score === null) {
      return "no-data";
    }

    if (score >= 70) {
      return "high";
    }

    if (score >= 35) {
      return "medium";
    }

    return "low";
  }
})();