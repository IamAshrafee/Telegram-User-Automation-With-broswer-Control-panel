import { api, API_BASE } from "./api.js";
import { showToast } from "./ui-components.js";
import { formatFileSize } from "./utils.js";

let allMedia = [];
let displayMedia = []; // For filtering/searching
let currentPage = 1;
let totalPages = 1;
let isPageLoading = false;
const pageSize = 20;

export function setupMedia() {
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const uploadArea = document.getElementById("uploadArea");
  const mediaSearch = document.getElementById("mediaSearch");

  if (selectFileBtn && fileInput) {
    selectFileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => handleFiles(e.target.files));
  }

  if (uploadArea) {
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      handleFiles(e.dataTransfer.files);
    });
  }

  if (mediaSearch) {
    mediaSearch.addEventListener("input", (e) => {
      handleSearch(e.target.value);
    });
  }

  // Gallery delegation
  const mediaGallery = document.getElementById("mediaGallery");
  if (mediaGallery) {
    mediaGallery.addEventListener("click", (e) => {
      const btn = e.target.closest(".delete-media-btn");
      if (btn) {
        deleteMedia(parseInt(btn.dataset.id));
      }
    });
  }

  setupDuplicateModal();
}

/**
 * Loading & Paging (Load More Pattern)
 */
export async function loadMedia(page = 1, append = false) {
  if (isPageLoading) return;
  isPageLoading = true;

  try {
    const response = await api.get(`/media/?page=${page}&limit=${pageSize}`);
    const items = response.items || [];
    currentPage = response.page;
    totalPages = response.pages;

    if (append) {
      allMedia = [...allMedia, ...items];
    } else {
      allMedia = items;
    }

    displayMedia = [...allMedia];
    const query = document.getElementById("mediaSearch")?.value || "";
    if (query) {
      displayMedia = allMedia.filter((item) =>
        item.filename.toLowerCase().includes(query.toLowerCase().trim()),
      );
    }

    renderMedia(displayMedia);
    renderLoadMore();
    updateDashboardStats(response.total);
  } catch (error) {
    console.error("Failed to load media:", error);
    showToast("Failed to load media library", "error");
  } finally {
    isPageLoading = false;
  }
}

function renderLoadMore() {
  const container = document.getElementById("mediaLoadMore");
  if (!container) return;

  if (currentPage >= totalPages || totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <button id="loadMoreBtn" class="btn btn-secondary shadow-sm">
      <span class="btn-text">Load More Media</span>
      <div class="spinner-sm hidden" style="margin-left: 8px;"></div>
    </button>
  `;

  const btn = document.getElementById("loadMoreBtn");
  const spinner = btn?.querySelector(".spinner-sm");

  btn.onclick = async () => {
    btn.disabled = true;
    spinner?.classList.remove("hidden");
    await loadMedia(currentPage + 1, true);
    // Spinner/disabled state handled by re-render
  };
}

/**
 * Search Logic
 */
function handleSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    displayMedia = [...allMedia];
  } else {
    displayMedia = allMedia.filter((item) =>
      item.filename.toLowerCase().includes(q),
    );
  }
  renderMedia(displayMedia);
}

/**
 * Rendering
 */
function renderMedia(media) {
  const gallery = document.getElementById("mediaGallery");
  if (!gallery) return;

  if (media.length === 0) {
    gallery.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; padding: 4rem; text-align: center;">
        <div style="font-size: 3.5rem; margin-bottom: 1.5rem; opacity: 0.5;">🖼️</div>
        <h3 style="font-weight: 600; color: var(--slate-700);">No results found</h3>
        <p class="text-muted">Try a different search or upload new files.</p>
      </div>
    `;
    return;
  }

  gallery.innerHTML = "";
  const fragment = document.createDocumentFragment();

  media.forEach((item) => {
    const card = document.createElement("div");
    card.className = "media-card";
    card.dataset.id = item.id;
    card.style.animationDelay = `${Math.random() * 0.2}s`;

    card.innerHTML = `
        <div class="media-card-img-wrapper">
            <img src="${API_BASE}${item.url}" alt="${item.filename}" loading="lazy">
            <div class="media-card-overlay">
                <button class="btn btn-danger btn-sm shadow-lg delete-media-btn" data-id="${item.id}">
                  🗑️ Delete
                </button>
            </div>
        </div>
        <div class="media-info">
            <div class="media-name" title="${item.filename}">${item.filename}</div>
            <div class="media-meta">${formatFileSize(item.file_size)} • ${item.mime_type.split("/")[1].toUpperCase()}</div>
        </div>
    `;
    fragment.appendChild(card);
  });

  gallery.appendChild(fragment);
}

function updateDashboardStats(count) {
  const totalMedia = document.getElementById("totalMedia");
  const totalMediaCount = document.getElementById("totalMediaCount");
  if (totalMedia) totalMedia.textContent = count;
  if (totalMediaCount) totalMediaCount.textContent = count;
}

const deleteMedia = async (id) => {
  if (!confirm("Are you sure you want to delete this media?")) return;
  try {
    await api.delete(`/media/${id}`);
    showToast("Media deleted successfully", "success");
    // Reload from start to maintain consistency
    await loadMedia(1);
  } catch (error) {
    showToast(error.message, "error");
  }
};

/**
 * Duplicate Detection
 */
let pendingFiles = [];

async function handleFiles(files) {
  if (!files.length) return;
  await uploadFiles(Array.from(files));
}

async function uploadFiles(files, action = "check") {
  try {
    const response = await api.uploadMultipleFiles(
      `/media/upload?action=${action}`,
      files,
    );

    if (response.duplicates && response.duplicates.length > 0) {
      handleDuplicates(response.duplicates, files);
    } else {
      showToast(
        `Successfully uploaded ${response.uploaded.length} files`,
        "success",
      );
      await loadMedia(1);
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

function handleDuplicates(duplicates, originalFiles) {
  const duplicateMap = new Map();
  duplicates.forEach((d) => duplicateMap.set(d.filename, d));

  pendingFiles = originalFiles
    .filter((f) => duplicateMap.has(f.name))
    .map((f) => ({ file: f, info: duplicateMap.get(f.name) }));

  if (pendingFiles.length > 0) {
    showNextDuplicate();
  }
}

function setupDuplicateModal() {
  const modal = document.getElementById("duplicateModal");
  const replaceBtn = document.getElementById("replaceDuplicateBtn");
  const keepBtn = document.getElementById("keepBothBtn");
  const cancelBtn = document.getElementById("cancelUploadBtn");

  if (!modal) return;
  modal.style.pointerEvents = "none";

  replaceBtn.onclick = async () => {
    const { file } = pendingFiles.shift();
    await uploadFiles([file], "replace");
    showNextDuplicate();
  };

  keepBtn.onclick = async () => {
    const { file } = pendingFiles.shift();
    await uploadFiles([file], "keep");
    showNextDuplicate();
  };

  cancelBtn.onclick = () => {
    pendingFiles.shift();
    showNextDuplicate();
  };
}

function showNextDuplicate() {
  const modal = document.getElementById("duplicateModal");
  if (pendingFiles.length === 0) {
    if (modal) {
      modal.classList.remove("show");
      modal.style.pointerEvents = "none";
    }
    loadMedia(1);
    return;
  }

  const { file } = pendingFiles[0];
  const nameEl = document.getElementById("duplicateFileName");
  const imgEl = document.getElementById("duplicatePreviewImg");

  if (modal) {
    nameEl.textContent = file.name;
    imgEl.src = URL.createObjectURL(file);
    modal.classList.add("show");
    modal.style.pointerEvents = "all";
  }
}

/**
 * Image Selector Logic (Composer)
 */
export function setupImageSelector() {
  const selectBtn = document.getElementById("selectMessageMedia");
  const modal = document.getElementById("imageSelectorModal");
  const closeBtn = document.getElementById("closeImageSelector");
  const gallery = document.getElementById("imageSelectorGallery");
  const mediaInput = document.getElementById("messageMedia");
  const clearBtn = document.getElementById("clearMessageMedia");
  const previewContainer = document.getElementById("messageMediaPreview");
  const previewImg = previewContainer?.querySelector("img");

  if (!selectBtn || !modal) return;

  selectBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    const searchInput = document.getElementById("selectorSearch");
    if (searchInput) searchInput.value = "";
    renderSelectorGallery(allMedia);
  });

  const searchInput = document.getElementById("selectorSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = q
        ? allMedia.filter((m) => m.filename.toLowerCase().includes(q))
        : allMedia;
      renderSelectorGallery(filtered);
    });
  }

  if (closeBtn)
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (mediaInput) mediaInput.value = "";
      if (previewContainer) previewContainer.style.display = "none";
      if (clearBtn) clearBtn.style.display = "none";
      if (selectBtn) selectBtn.textContent = "🖼️ Select Image";
    });
  }

  function renderSelectorGallery(items = allMedia) {
    if (!gallery) return;

    if (items.length === 0) {
      gallery.innerHTML =
        '<p class="text-center p-8 text-muted">No media found.</p>';
      return;
    }

    gallery.innerHTML = `
      <div class="image-selector-grid">
        ${items
          .map(
            (item) => `
          <div class="image-selector-item" data-id="${item.id}" data-url="${item.url}">
            <div class="img-wrapper">
              <img src="${API_BASE}${item.url}" alt="${item.filename}">
            </div>
            <div class="check-badge">✓</div>
            <div class="image-selector-name">${item.filename}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;

    gallery.querySelectorAll(".image-selector-item").forEach((item) => {
      item.addEventListener("click", () => {
        const id = item.dataset.id;
        const url = item.dataset.url;

        if (mediaInput) mediaInput.value = id;
        if (previewImg) previewImg.src = `${API_BASE}${url}`;
        if (previewContainer) previewContainer.style.display = "block";
        if (clearBtn) clearBtn.style.display = "block";
        if (selectBtn) selectBtn.textContent = `Image #${id} selected`;

        modal.classList.add("hidden");
        showToast("Image selected", "info");
      });
    });
  }
}
