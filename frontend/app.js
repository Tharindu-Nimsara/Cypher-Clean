(() => {
  const pickFolderBtn = document.getElementById("pickFolderBtn");
  const scanBtn = document.getElementById("scanBtn");
  const selectedPathText = document.getElementById("selectedPath");
  const statusText = document.getElementById("status");
  const loadingSpinner = document.getElementById("loadingSpinner");
    const resultsTable = document.getElementById("resultsTable");
  const resultsBody = document.getElementById("results");
  const resultControls = document.getElementById("resultControls");
  const sortBySelect = document.getElementById("sortBy");
  const typeFilterCheckboxes = Array.from(
    document.querySelectorAll(".type-filter"),
  );
  const descriptionModal = document.getElementById("descriptionModal");
  const descriptionModalOverlay = document.getElementById(
    "descriptionModalOverlay",
  );
  const descriptionBody = document.getElementById("descriptionBody");
  const closeModal = document.getElementById("closeModal");
  const modalOkBtn = document.getElementById("modalOkBtn");
  const deleteConfirmModal = document.getElementById("deleteConfirmModal");
  const deleteConfirmModalOverlay = document.getElementById("deleteConfirmModalOverlay");
  const deleteConfirmBody = document.getElementById("deleteConfirmBody");
  const closeDeleteConfirmModal = document.getElementById("closeDeleteConfirmModal");
  const deleteConfirmCancelBtn = document.getElementById("deleteConfirmCancelBtn");
  const deleteConfirmOkBtn = document.getElementById("deleteConfirmOkBtn");
  const API_BASE = "http://localhost:3001";

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

  function toProjectFolder(folderPath) {
    return folderPath.replace(
      /[\\/](node_modules|venv|\.venv|\.next|target)$/i,
      "",
    );
  }

  let selectedRootPath = null;
  let currentFolders = [];
  let currentItems = [];
  let pendingDeleteFolder = null;

  function renderPathCell(pathCell, targetPath, createdAtText, modifiedAtText, modifiedAtIso) {
    const info = getPathTypeInfo(targetPath);
    pathCell.innerHTML = "";

    const badge = document.createElement("span");
    badge.className = `type-badge ${info.className}`;
    badge.textContent = info.label;

    const pathLine = document.createElement("div");
    pathLine.className = "path-line";
    pathLine.textContent = targetPath;

    const metaContainer = document.createElement("div");
    metaContainer.style.display = "flex";
    metaContainer.style.gap = "12px";
    metaContainer.style.marginTop = "4px";

    const createdLine = document.createElement("span");
    createdLine.className = "meta-line";
    createdLine.textContent = `Created: ${createdAtText}`;

    const modifiedLine = document.createElement("span");
    modifiedLine.className = "meta-line";
    modifiedLine.textContent = `Modified: ${modifiedAtText}`;

    metaContainer.appendChild(createdLine);
    metaContainer.appendChild(modifiedLine);

    const deleteSafetyScore = calculateDeleteSafetyScore(modifiedAtIso);
    const deleteSafetyLine = document.createElement("div");
    deleteSafetyLine.className = "delete-safety-line";

    const deleteSafetyLabelGroup = document.createElement("div");
    deleteSafetyLabelGroup.className = "delete-safety-label-group";

    const deleteSafetyLabel = document.createElement("span");
    deleteSafetyLabel.className = "delete-safety-label";
    deleteSafetyLabel.textContent = "Delete safety";

    const deleteSafetyHint = document.createElement("span");
    deleteSafetyHint.className = "delete-safety-hint";
    deleteSafetyHint.textContent = "Based on last modified date";

    deleteSafetyLabelGroup.appendChild(deleteSafetyLabel);
    deleteSafetyLabelGroup.appendChild(deleteSafetyHint);

    const deleteSafetyValue = document.createElement("span");
    deleteSafetyValue.className = `delete-safety-value delete-safety-${getDeleteSafetyTone(deleteSafetyScore)}`;
    deleteSafetyValue.textContent =
      deleteSafetyScore === null ? "No data found" : `${deleteSafetyScore}%`;

    deleteSafetyLine.appendChild(deleteSafetyLabelGroup);
    deleteSafetyLine.appendChild(deleteSafetyValue);

    pathCell.appendChild(badge);
    pathCell.appendChild(pathLine);
    pathCell.appendChild(metaContainer);
    pathCell.appendChild(deleteSafetyLine);
  }

  function setStatus(message) {
    statusText.textContent = message;
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function createInfoCard(label, value, className = "") {
    const card = document.createElement("div");
    card.className = `analysis-card ${className}`.trim();

    const cardLabel = document.createElement("span");
    cardLabel.className = "analysis-card-label";
    cardLabel.textContent = label;

    const cardValue = document.createElement("div");
    cardValue.className = "analysis-card-value";
    cardValue.textContent = value || "No data found";

    card.appendChild(cardLabel);
    card.appendChild(cardValue);

    return card;
  }
})();
