import { api, formatFileSize } from "./app.js";
import { showToast, confirmAction } from "./ui-components.js";

// State
let mediaFiles = [];
let currentPage = 1;
let totalPages = 1;
const limit = 20;
let isLoading = false;

// Initialize
export function setupMedia() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

  // Media Library Interactions
  if (selectFileBtn) {
    selectFileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (uploadArea) {
    uploadArea.addEventListener("click", () => fileInput.click());

    // Drag & Drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", async (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) await uploadFiles(files);
      else showToast("Please upload image files only.", "error");
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      if (e.target.files.length > 0) await uploadFiles(e.target.files);
      fileInput.value = "";
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        loadMedia(currentPage + 1);
      }
    });
  }

  // Global Image Selector Triggers
  setupImageSelectorTriggers();
}

export async function loadMedia(page = 1) {
  if (isLoading) return;
  isLoading = true;

  try {
    const response = await api.get(`/media/?page=${page}&limit=${limit}`);
    console.log("Media API Response:", response);

    let items = [];
    if (Array.isArray(response)) {
      // Handle legacy flat list response
      items = response;
      currentPage = 1;
      totalPages = 1;
      mediaFiles = page === 1 ? items : [...mediaFiles, ...items];
    } else if (response && Array.isArray(response.items)) {
      // Handle paginated response
      items = response.items;
      currentPage = response.page || 1;
      totalPages = response.pages || 1;

      if (page === 1) {
        mediaFiles = items;
        document.getElementById("mediaGallery").innerHTML = "";
      } else {
        mediaFiles = [...mediaFiles, ...items];
      }

      updateDashboardStats(response.total);
    } else {
      console.error("Unexpected media response format:", response);
      showToast("Error loading media: Invalid response format", "error");
      isLoading = false;
      return;
    }

    // Render
    renderMediaGallery(items);
    updateLoadMoreVisibility();

    // Update simple selector text if needed (if we are on page 1)
    if (page === 1) updateMediaSelectorsUI();
  } catch (error) {
    console.error("Error loading media:", error);
    showToast("Failed to load media library", "error");
  } finally {
    isLoading = false;
  }
}

function renderMediaGallery(items) {
  const gallery = document.getElementById("mediaGallery");

  if (
    !items ||
    !Array.isArray(items) ||
    (items.length === 0 && mediaFiles.length === 0)
  ) {
    if (!Array.isArray(items))
      console.warn("renderMediaGallery received non-array:", items);
    gallery.innerHTML = renderEmptyState();
    return;
  }

  // Append new items
  const itemsHTML = items.map((media) => renderMediaCard(media)).join("");
  gallery.insertAdjacentHTML("beforeend", itemsHTML);

  // Re-attach listeners for new items
  attachMediaListeners();
}

export function renderMediaCard(media) {
  return `
    <div class="media-card" id="media-${media.id}">
        <div class="media-card-img-wrapper">
            <img src="${media.url}" alt="${media.filename}" loading="lazy" />
            <div class="media-card-overlay">
                <button class="btn btn-sm btn-light copy-btn" data-url="${window.location.origin}${media.url}" title="Copy Link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-media-id="${media.id}" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>
        <div class="media-info">
            <div class="media-name" title="${media.filename}">${media.filename}</div>
            <div class="media-meta">${formatFileSize(media.file_size)}</div>
        </div>
    </div>
    `;
}

function renderEmptyState() {
  return `
    <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 2rem; text-align: center;">
        <div style="background: var(--bg-secondary); width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">No media yet</h3>
        <p class="text-secondary" style="max-width: 300px; margin: 0 auto;">Upload images to start building your library.</p>
    </div>`;
}

function attachMediaListeners() {
  // Clean up old listeners to avoid duplicates is hard without cloning,
  // but delegation is better. For now we just select all and overwrite properly or use delegation.
  // Let's use event delegation on the gallery itself to be cleaner.

  const gallery = document.getElementById("mediaGallery");

  // Remove old listener if exists? Hard to track.
  // Recommendation: One global listener in setupMedia but for dynamic content...
  // Let's just create a function we call once, but since renderMediaGallery is called multiple times...
  // We will use cloning to remove listeners if we were re-attaching, but here we append.
  // simpler: select elements inside and attach {once: true} or check attribute.

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    if (btn.dataset.hasListener) return;
    btn.dataset.hasListener = "true";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const mediaId = btn.dataset.mediaId;
      const confirmed = await confirmAction("Delete this image permanently?", {
        title: "Delete Media",
        confirmText: "Delete",
        type: "warning",
      });
      if (confirmed) await deleteMedia(mediaId);
    });
  });

  document.querySelectorAll(".copy-btn").forEach((btn) => {
    if (btn.dataset.hasListener) return;
    btn.dataset.hasListener = "true";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(btn.dataset.url);
      showToast("Copied to clipboard", "success");
    });
  });
}

async function deleteMedia(mediaId) {
  try {
    await api.delete(`/media/${mediaId}`);
    // Remove from UI immediately
    const card = document.getElementById(`media-${mediaId}`);
    if (card) {
      card.style.opacity = "0";
      setTimeout(() => card.remove(), 300);
    }
    // Update local state
    mediaFiles = mediaFiles.filter((m) => String(m.id) !== String(mediaId));
    updateDashboardStats(mediaFiles.length); // Approximate update
    showToast("Image deleted", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function uploadFiles(files) {
  const uploadContent = document.querySelector(".upload-content");
  const originalContent = uploadContent.innerHTML;

  try {
    uploadContent.innerHTML = `<div class="spinner"></div><p>Uploading...</p>`;

    // Step 1: Upload with check
    const response = await api.uploadMultipleFiles(
      "/media/upload?action=check",
      Array.from(files),
    );

    // Step 2: Handle results
    if (response.uploaded && response.uploaded.length > 0) {
      showToast(`Uploaded ${response.uploaded.length} files`, "success");
    }

    if (response.failed && response.failed.length > 0) {
      response.failed.forEach((f) =>
        showToast(`Failed ${f.filename}: ${f.reason}`, "error"),
      );
    }

    // Step 3: Handle duplicates
    if (response.duplicates && response.duplicates.length > 0) {
      for (const dup of response.duplicates) {
        // Find original file object
        const originalFile = Array.from(files).find(
          (f) => f.name === dup.filename,
        );
        if (originalFile) {
          await handleDuplicate(originalFile, dup);
        }
      }
    }

    // Reload from page 1 to confirm everything
    await loadMedia(1);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    uploadContent.innerHTML = originalContent;
  }
}

async function handleDuplicate(file, duplicateInfo) {
  try {
    const action = await showDuplicateModal(file, duplicateInfo);
    if (!action || action === "cancel") return;

    // Retry upload with action
    // We pass only this file
    const res = await api.uploadMultipleFiles(
      `/media/upload?action=${action}`,
      [file],
    );
    if (res.uploaded && res.uploaded.length > 0) {
      showToast(`Resolved ${file.name}`, "success");
    }
  } catch (error) {
    console.error("Duplicate resolution error:", error);
    showToast("Failed to resolve duplicate", "error");
  }
}

function showDuplicateModal(file, info) {
  return new Promise((resolve) => {
    // Check if modal container exists or create one
    const overlay = document.createElement("div");
    overlay.className = "duplicate-modal-overlay";

    const previewUrl = URL.createObjectURL(file);

    overlay.innerHTML = `
      <div class="duplicate-modal">
        <div class="duplicate-modal-header">
           <h3>Duplicate Detected</h3>
           <p class="text-secondary" style="font-size: 0.9rem">
             "${file.name}" already exists.
           </p>
        </div>
        <div class="duplicate-modal-body">
           <div class="duplicate-preview">
              <img src="${previewUrl}" alt="Preview">
           </div>
           <p class="text-secondary mb-3">What would you like to do?</p>
        </div>
        <div class="duplicate-modal-actions">
           <button class="btn btn-primary" data-action="keep">Keep Both (Rename New)</button>
           <button class="btn btn-secondary" data-action="replace">Replace Existing</button>
           <button class="btn btn-light" data-action="cancel">Cancel Upload</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Animation
    requestAnimationFrame(() => overlay.classList.add("show"));

    const cleanup = (action) => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 300);
      URL.revokeObjectURL(previewUrl);
      resolve(action);
    };

    overlay
      .querySelector('[data-action="keep"]')
      .addEventListener("click", () => cleanup("keep"));
    overlay
      .querySelector('[data-action="replace"]')
      .addEventListener("click", () => cleanup("replace"));
    overlay
      .querySelector('[data-action="cancel"]')
      .addEventListener("click", () => cleanup("cancel"));
  });
}

function updateLoadMoreVisibility() {
  const container = document.getElementById("loadMoreContainer");
  if (currentPage < totalPages) {
    container.style.display = "flex";
  } else {
    container.style.display = "none";
  }
}

function updateDashboardStats(total) {
  const el = document.getElementById("totalMedia");
  if (el) el.textContent = total;
}

// ----------------------------------------------------
// Image Selector Modal (Decoupled & Robust)
// ----------------------------------------------------

function setupImageSelectorTriggers() {
  const triggers = [
    {
      btnId: "selectMessageMedia",
      inputId: "messageMedia",
      previewId: "messageMediaPreview",
      clearId: "clearMessageMedia",
    },
    {
      btnId: "selectScheduleMedia",
      inputId: "scheduleMedia",
      previewId: "scheduleMediaPreview",
      clearId: "clearScheduleMedia",
    },
  ];

  const modal = document.getElementById("imageSelectorModal");
  const gallery = document.getElementById("imageSelectorGallery");
  const closeBtn = document.getElementById("closeImageSelector");

  // Selector State
  let selectorPage = 1;
  let selectorTotalPages = 1;
  let selectorItems = [];
  let currentTriggerConfig = null;
  let isSelectorLoading = false;
  const SELECTOR_LIMIT = 20;

  // Close logic
  const closeModal = () => modal.classList.add("hidden");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

  triggers.forEach((trigger) => {
    const btn = document.getElementById(trigger.btnId);
    const clearBtn = document.getElementById(trigger.clearId);

    if (btn) {
      btn.addEventListener("click", () => {
        openImageSelector(trigger);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const input = document.getElementById(trigger.inputId);
        const preview = document.getElementById(trigger.previewId);

        if (input) input.value = "";
        if (preview) preview.style.display = "none";
        if (btn) btn.textContent = "🖼️ Select Image";
        clearBtn.style.display = "none";
      });
    }
  });

  async function openImageSelector(triggerConfig) {
    currentTriggerConfig = triggerConfig;
    modal.classList.remove("hidden");

    // Reset state
    selectorPage = 1;
    selectorItems = [];
    selectorTotalPages = 1;

    // Setup initial DOM structure
    gallery.innerHTML = `
      <div class="image-selector-grid" id="selectorGrid"></div>
      <div id="selectorFooter" class="text-center pt-3 pb-2"></div>
    `;

    const grid = document.getElementById("selectorGrid");
    grid.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

    await loadSelectorImages(1);
  }

  async function loadSelectorImages(page) {
    if (isSelectorLoading) return;
    isSelectorLoading = true;

    const grid = document.getElementById("selectorGrid");

    // If page 1, verify spinner is there, otherwise show button loading
    if (page > 1) {
      const btn = document.getElementById("selectorLoadMoreBtn");
      if (btn)
        btn.innerHTML =
          '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;"></div>';
    }

    try {
      const response = await api.get(
        `/media/?page=${page}&limit=${SELECTOR_LIMIT}`,
      );

      let newItems = [];
      if (Array.isArray(response)) {
        newItems = response;
      } else if (response && Array.isArray(response.items)) {
        newItems = response.items;
        selectorTotalPages = response.pages || 1;
        selectorPage = response.page || 1;
      }

      // Clear spinner if page 1
      if (page === 1) grid.innerHTML = "";

      if (page === 1 && newItems.length === 0) {
        grid.innerHTML =
          '<p class="text-muted p-4 text-center" style="grid-column: 1/-1;">No images found.</p>';
      } else {
        const firstNewElement = appendSelectorItems(newItems);
        selectorItems = [...selectorItems, ...newItems];

        if (page > 1 && firstNewElement) {
          // Smooth scroll to first new item if loading more
          setTimeout(() => {
            firstNewElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }, 100);
        }
      }

      updateLoadMoreButton();
    } catch (e) {
      console.error(e);
      if (page === 1) {
        grid.innerHTML =
          '<p class="text-danger p-4 text-center" style="grid-column: 1/-1;">Failed to load images</p>';
      } else {
        showToast("Failed to load more images", "error");
        // Revert button
        updateLoadMoreButton();
      }
    } finally {
      isSelectorLoading = false;
    }
  }

  function appendSelectorItems(items) {
    const grid = document.getElementById("selectorGrid");
    const currentId = document.getElementById(
      currentTriggerConfig.inputId,
    )?.value;

    const fragment = document.createDocumentFragment();
    let firstNewElement = null;

    items.forEach((media, index) => {
      const div = document.createElement("div");
      div.className = `image-selector-item ${String(media.id) === String(currentId) ? "selected" : ""}`;
      div.dataset.id = media.id;
      div.dataset.url = `/media/${media.id}`;
      div.dataset.name = media.filename;

      div.innerHTML = `
            <div class="check-badge">✓</div>
            <div class="img-wrapper"><img src="/media/${media.id}" loading="lazy"></div>
            <div class="image-selector-name">${media.filename}</div>
        `;

      div.addEventListener("click", () => {
        selectImage(div.dataset, currentTriggerConfig);
        closeModal();
      });

      if (index === 0) firstNewElement = div;
      fragment.appendChild(div);
    });

    grid.appendChild(fragment);
    return firstNewElement;
  }

  function updateLoadMoreButton() {
    const footer = document.getElementById("selectorFooter");
    if (!footer) return;

    if (selectorPage < selectorTotalPages) {
      footer.innerHTML = `<button id="selectorLoadMoreBtn" class="btn btn-secondary btn-sm">Load More</button>`;
      footer
        .querySelector("#selectorLoadMoreBtn")
        .addEventListener("click", () => {
          loadSelectorImages(selectorPage + 1);
        });
    } else {
      footer.innerHTML = "";
    }
  }

  function selectImage(data, config) {
    const input = document.getElementById(config.inputId);
    const btn = document.getElementById(config.btnId);
    const preview = document.getElementById(config.previewId);
    const clearBtn = document.getElementById(config.clearId);

    if (input) input.value = data.id;
    if (btn) btn.textContent = `✓ ${data.name}`;

    if (preview) {
      const img = preview.querySelector("img");
      if (img) img.src = data.url;
      preview.style.display = "block";
    }

    if (clearBtn) clearBtn.style.display = "inline-flex";
  }
}

function updateMediaSelectorsUI() {
  // Helper to reset button text if needed on load
  ["messageMedia", "scheduleMedia"].forEach((type) => {
    const input = document.getElementById(type);
    const btn = document.getElementById(
      type === "messageMedia" ? "selectMessageMedia" : "selectScheduleMedia",
    );
    if (input && !input.value && btn) {
      btn.textContent =
        mediaFiles.length > 0 ? "🖼️ Select Image" : "No images available";
      btn.disabled = mediaFiles.length === 0;
    }
  });
}
