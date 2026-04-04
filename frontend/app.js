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

  function parseAnalysisSections(text) {
    const sections = [];
    const lines = String(text || "").split(/\r?\n/);
    let currentSection = null;

    function pushCurrentSection() {
      if (!currentSection) {
        return;
      }

      sections.push({
        title: currentSection.title,
        body: currentSection.bodyLines.join("\n").trim(),
      });
      currentSection = null;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        if (currentSection) {
          currentSection.bodyLines.push("");
        }
        continue;
      }

      const match = line.match(/^\s*(\d+)[).]\s*(.+?)(?::\s*(.*))?$/);
      const headingText = match ? match[2].trim() : "";
      const bodyText = match ? (match[3] || "").trim() : "";

      if (
        match &&
        [
          "What this project is for",
          "How it works at a high level",
          "Main technologies/frameworks",
        ].includes(headingText)
      ) {
        pushCurrentSection();
        currentSection = {
          title: headingText,
          bodyLines: bodyText ? [bodyText] : [],
        };
        continue;
      }

      if (currentSection) {
        currentSection.bodyLines.push(rawLine.trim());
      }
    }

    pushCurrentSection();

    return sections.filter((section) => section.body);
  }

  function renderAnalysisModal(data) {
    clearElement(descriptionBody);

    const wrapper = document.createElement("div");
    wrapper.className = "analysis-wrap";

    const metaSection = document.createElement("section");
    metaSection.className = "analysis-section analysis-meta-section";

    const metaTitle = document.createElement("h3");
    metaTitle.className = "analysis-section-title";
    metaTitle.textContent = "Project metadata";

    const metaGrid = document.createElement("div");
    metaGrid.className = "analysis-grid";

    const projectMeta = data?.projectMeta || {};
    const tagValue =
      Array.isArray(projectMeta.tags) && projectMeta.tags.length
        ? projectMeta.tags.join(", ")
        : null;

    metaGrid.appendChild(
      createInfoCard("Project name", projectMeta.projectName || null),
    );
    metaGrid.appendChild(
      createInfoCard("Created", formatDate(projectMeta.createdAt)),
    );
    metaGrid.appendChild(
      createInfoCard("Last modified", formatDate(projectMeta.lastModifiedAt)),
    );
    metaGrid.appendChild(
      createInfoCard("Project size", projectMeta.projectSizeReadable || null),
    );
    metaGrid.appendChild(createInfoCard("Tags", tagValue));

    if (data?.modelUsed) {
      metaGrid.appendChild(
        createInfoCard("Model", data.modelUsed, "analysis-card-accent"),
      );
    }

    metaSection.appendChild(metaTitle);
    metaSection.appendChild(metaGrid);

    const analysisSection = document.createElement("section");
    analysisSection.className = "analysis-section";

    const analysisTitle = document.createElement("h3");
    analysisTitle.className = "analysis-section-title";
    analysisTitle.textContent = "Analysis";

    analysisSection.appendChild(analysisTitle);

    const parsedSections = parseAnalysisSections(data?.description);

    if (parsedSections.length) {
      for (const section of parsedSections) {
        const sectionCard = document.createElement("article");
        sectionCard.className = "analysis-section-card";

        const sectionHeader = document.createElement("h4");
        sectionHeader.className = "analysis-section-card-title";
        sectionHeader.textContent = section.title;

        const sectionBody = document.createElement("div");
        sectionBody.className = "analysis-section-card-body";
        sectionBody.textContent = section.body || "No summary available.";

        sectionCard.appendChild(sectionHeader);
        sectionCard.appendChild(sectionBody);
        analysisSection.appendChild(sectionCard);
      }
    } else {
      const fallback = document.createElement("div");
      fallback.className = "analysis-fallback";
      fallback.textContent = "No data found.";
      analysisSection.appendChild(fallback);
    }

    wrapper.appendChild(metaSection);
    wrapper.appendChild(analysisSection);

    descriptionBody.appendChild(wrapper);
  }

  function showLoading(visible = true) {
    if (visible) {
      loadingSpinner.classList.remove("hidden");
    } else {
      loadingSpinner.classList.add("hidden");
    }
  }

  function showAnalysisLoadingModal() {
    clearElement(descriptionBody);

    const loadingState = document.createElement("div");
    loadingState.className = "analysis-loading-state";

    const loadingIcon = document.createElement("div");
    loadingIcon.className = "spinner analysis-modal-spinner";

    const loadingText = document.createElement("div");
    loadingText.className = "analysis-loading-text";
    loadingText.textContent = "Analyzing Project";

    loadingState.appendChild(loadingIcon);
    loadingState.appendChild(loadingText);
    descriptionBody.appendChild(loadingState);

    descriptionModal.classList.remove("hidden");
  }

  function showDescriptionModal(content) {
    if (content && typeof content === "object") {
      renderAnalysisModal(content);
    } else {
      clearElement(descriptionBody);

      const fallback = document.createElement("div");
      fallback.className = "analysis-fallback";
      fallback.textContent = content || "No data found.";
      descriptionBody.appendChild(fallback);
    }

    descriptionModal.classList.remove("hidden");
    showLoading(false);
  }

  function hideDescriptionModal() {
    descriptionModal.classList.add("hidden");
    descriptionBody.textContent = "";
  }

  function renderDeleteConfirmModal(folder) {
    clearElement(deleteConfirmBody);

    const warningTitle = document.createElement("p");
    warningTitle.className = "delete-confirm-title";
    warningTitle.textContent = "Permanently delete this folder?";

    const warningText = document.createElement("p");
    warningText.className = "delete-confirm-text";
    warningText.textContent =
      "This action cannot be undone. All files within this folder will be permanently removed. Are you sure you wish to proceed?";

    const pathText = document.createElement("div");
    pathText.className = "delete-confirm-path";
    pathText.textContent = folder;

    deleteConfirmBody.appendChild(warningTitle);
    deleteConfirmBody.appendChild(warningText);
    deleteConfirmBody.appendChild(pathText);
  }

  function showDeleteConfirmModal(folder) {
    pendingDeleteFolder = folder;
    renderDeleteConfirmModal(folder);
    deleteConfirmModal.classList.remove("hidden");
  }

  function hideDeleteConfirmModal() {
    pendingDeleteFolder = null;
    deleteConfirmModal.classList.add("hidden");
    deleteConfirmBody.textContent = "";
  }

  function selectFolderFallback() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
      input.style.display = "none";

      input.onchange = () => {
        const firstFile = input.files && input.files[0];
        document.body.removeChild(input);

        if (!firstFile?.path) {
          resolve(null);
          return;
        }

        resolve(firstFile.path.replace(/[\\/][^\\/]+$/, ""));
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  function getSelectedTypeKeys() {
    return new Set(
      typeFilterCheckboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value),
    );
  }

  function sortItems(items) {
    const sortBy = sortBySelect.value;

    if (!sortBy) {
      return items;
    }

    const sorted = [...items];

    sorted.sort((left, right) => {
      if (sortBy === "size_desc") {
        return right.bytes - left.bytes;
      }

      if (sortBy === "created_asc") {
        return toTimeValue(left.createdAtIso) - toTimeValue(right.createdAtIso);
      }

      if (sortBy === "modified_asc") {
        return (
          toTimeValue(left.modifiedAtIso) - toTimeValue(right.modifiedAtIso)
        );
      }

      return 0;
    });

    return sorted;
  }

  function applyFiltersAndSort() {
    const selectedTypes = getSelectedTypeKeys();
    const filtered = currentItems.filter((item) =>
      selectedTypes.has(item.typeKey),
    );
    const sorted = sortItems(filtered);
    renderResults(sorted);
    updateItemsCount();
  }

  function createItemRow(item) {
    const folder = item.path;
    const row = document.createElement("tr");

    const pathCell = document.createElement("td");
    renderPathCell(pathCell, folder, item.createdAtText, item.modifiedAtText, item.modifiedAtIso);

    const sizeCell = document.createElement("td");
    sizeCell.textContent = item.bytesAvailable
      ? formatBytes(item.bytes)
      : "Unavailable";
    sizeCell.style.whiteSpace = "nowrap";

    const actionCell = document.createElement("td");
    actionCell.className = "action-buttons";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = () => showDeleteConfirmModal(folder);

    const describeBtn = document.createElement("button");
    describeBtn.className = "btn-describe";
    describeBtn.textContent = "✨ Analyze";
    describeBtn.onclick = () => describeProject(folder);

    const openBtn = document.createElement("button");
    openBtn.className = "btn-open";
    openBtn.textContent = "📁 Open";
    openBtn.onclick = () => openProjectFolder(folder);

    actionCell.appendChild(deleteBtn);
    actionCell.appendChild(openBtn);
    actionCell.appendChild(describeBtn);

    row.appendChild(pathCell);
    row.appendChild(sizeCell);
    row.appendChild(actionCell);

    return row;
  }

  function renderSingleItem(item) {
    if (resultsTable.classList.contains("hidden")) {
      resultsTable.classList.remove("hidden");
      resultControls.classList.remove("hidden");
    }

    const row = createItemRow(item);
    resultsBody.appendChild(row);
    updateItemsCount();
  }

  function updateItemsCount() {
    const visibleCount = resultsBody.children.length;
    if (visibleCount === 0) {
      resultsTable.classList.add("hidden");
      setStatus("No matching items for selected filters.");
    } 
    else {
      setStatus(`Showing ${visibleCount} item(s).`);
    }
  }

  function renderResults(items) {
    resultsBody.innerHTML = "";

    if (!items.length) {
      resultsTable.classList.add("hidden");
      setStatus("No matching items for selected filters.");
      return;
    }

    resultsTable.classList.remove("hidden");
    resultControls.classList.remove("hidden");
    setStatus(`Showing ${items.length} item(s).`);

    for (const item of items) {
      const row = createItemRow(item);
      resultsBody.appendChild(row);
    }
  }

  async function buildItemStreaming(folders) {
    const promises = folders.map(async (folder) => {
      const info = getPathTypeInfo(folder);

      try {
        const [bytesRaw, projectMeta] = await Promise.all([
          fetchFolderSize(folder),
          fetchProjectMeta(folder),
        ]);

        const bytes = typeof bytesRaw === "number" ? bytesRaw : 0;
        const item = {
          path: folder,
          typeKey: info.key,
          bytes,
          bytesAvailable: typeof bytesRaw === "number",
          createdAtIso: projectMeta?.createdAt || null,
          modifiedAtIso: projectMeta?.lastModifiedAt || null,
          createdAtText: formatDate(projectMeta?.createdAt),
          modifiedAtText: formatDate(projectMeta?.lastModifiedAt),
        };

        currentItems.push(item);
        const selectedTypes = getSelectedTypeKeys();
        if (selectedTypes.has(item.typeKey)) {
          renderSingleItem(item);
        }
        return item;
      } catch (err) {
        const item = {
          path: folder,
          typeKey: info.key,
          bytes: 0,
          bytesAvailable: false,
          createdAtIso: null,
          modifiedAtIso: null,
          createdAtText: "Unknown",
          modifiedAtText: "Unknown",
        };

        currentItems.push(item);
        const selectedTypes = getSelectedTypeKeys();
        if (selectedTypes.has(item.typeKey)) {
          renderSingleItem(item);
        }
        return item;
      }
    });

    await Promise.all(promises);
  }

  async function runScan() {
    if (!selectedRootPath) {
      setStatus("Please choose a folder first.");
      return;
    }

    setStatus("Scanning...");
    showLoading(true);
    resultControls.classList.add("hidden");
    resultsBody.innerHTML = "";
    resultsTable.classList.add("hidden");
    currentItems = [];

    try {
      const { ok, data } = await scanFolders(selectedRootPath);

      if (!ok) {
        setStatus("Scan failed.");
        showLoading(false);
        return;
      }

      currentFolders = Array.isArray(data.folders) ? data.folders : [];

      if (!currentFolders.length) {
        setStatus("No cleanup folders found.");
        showLoading(false);
        return;
      }

      setStatus("Processing folders...");
      resultControls.classList.remove("hidden");
      await buildItemStreaming(currentFolders);
      updateItemsCount();
      showLoading(false);
    } catch {
      setStatus("Cannot connect to backend. Make sure app is running.");
      showLoading(false);
    }
  }

  async function handleDelete(folder) {
    setStatus("Deleting folder...");

    try {
      const { ok, data } = await deleteFolder(folder);

      if (!ok || !data?.success) {
        setStatus(data.error || "Delete failed.");
        return;
      }

      setStatus("Deleted successfully.");
      currentFolders = currentFolders.filter((item) => item !== folder);
      currentItems = currentItems.filter((item) => item.path !== folder);
      applyFiltersAndSort();
    } catch {
      setStatus("Delete failed.");
    }
  }

  async function describeProject(folder) {
    setStatus("Analyzing project with AI...");
    showAnalysisLoadingModal();
    showLoading(false);

    try {
      const { ok, data } = await describeFolder(folder);

      if (!ok) {
        setStatus(data.error || "Error analyzing project.");
        showDescriptionModal(data.error || "Error analyzing project.");
        return;
      }

      showDescriptionModal(data);

      setStatus("Analysis complete.");
    } catch {
      setStatus("AI analysis failed. Check backend/Ollama connection.");
      showDescriptionModal(
        "AI analysis failed. Check backend/Ollama connection.",
      );
    }
  }

  async function openProjectFolder(folder) {
    const projectFolder = toProjectFolder(folder);

    try {
      const result = await window.electronAPI.openFolder(projectFolder);
      if (!result?.success) {
        setStatus(result?.error || "Failed to open folder.");
      }
    } catch {
      setStatus("Failed to open folder.");
    }
  }

  pickFolderBtn.onclick = async () => {
    let folder = null;

    if (window.electronAPI?.selectFolder) {
      try {
        folder = await window.electronAPI.selectFolder();
      } catch {}
    }

    if (!folder) {
      folder = await selectFolderFallback();
    }

    if (!folder) {
      setStatus("Folder selection cancelled.");
      return;
    }

    selectedRootPath = folder;
    selectedPathText.textContent = `Selected: ${folder}`;
    scanBtn.disabled = false;
    setStatus("Ready to scan.");
  };

  scanBtn.onclick = runScan;
  sortBySelect.onchange = applyFiltersAndSort;
  for (const checkbox of typeFilterCheckboxes) {
    checkbox.onchange = applyFiltersAndSort;
  }

  closeModal.onclick = hideDescriptionModal;
  modalOkBtn.onclick = hideDescriptionModal;
  closeDeleteConfirmModal.onclick = hideDeleteConfirmModal;
  deleteConfirmCancelBtn.onclick = hideDeleteConfirmModal;
  deleteConfirmOkBtn.onclick = async () => {
    const folder = pendingDeleteFolder;

    if (!folder) {
      hideDeleteConfirmModal();
      return;
    }

    hideDeleteConfirmModal();
    await handleDelete(folder);
  };
  descriptionModalOverlay.onclick = hideDescriptionModal;
  deleteConfirmModalOverlay.onclick = hideDeleteConfirmModal;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !descriptionModal.classList.contains("hidden")) {
      hideDescriptionModal();
      return;
    }

    if (
      e.key === "Escape" &&
      !deleteConfirmModal.classList.contains("hidden")
    ) {
      hideDeleteConfirmModal();
    }
  });
})();
