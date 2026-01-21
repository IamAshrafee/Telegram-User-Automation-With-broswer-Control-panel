import { api, API_BASE } from "./api.js";
import { showToast } from "./ui-components.js";
import { formatFileSize } from "./utils.js";

export function setupMedia() {
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const uploadArea = document.getElementById("uploadArea");

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
}

async function handleFiles(files) {
  if (!files.length) return;
  await uploadFiles(Array.from(files));
}

let allMedia = [];

export async function loadMedia() {
  try {
    const media = await api.get("/media/");
    allMedia = Array.isArray(media) ? media : media.items || [];
    renderMedia(allMedia);
    updateDashboardStats(allMedia.length);
  } catch (error) {
    console.error("Failed to load media:", error);
    showToast("Failed to load media library", "error");
  }
}

function updateDashboardStats(count) {
  const totalMedia = document.getElementById("totalMedia");
  const totalMediaCount = document.getElementById("totalMediaCount");
  if (totalMedia) totalMedia.textContent = count;
  if (totalMediaCount) totalMediaCount.textContent = count;
}

function renderMedia(media) {
  const gallery = document.getElementById("mediaGallery");
  if (!gallery) return;

  if (media.length === 0) {
    gallery.innerHTML =
      '<div class="empty-state" style="grid-column: 1/-1"><p>No media files uploaded yet.</p></div>';
    return;
  }

  gallery.innerHTML = media
    .map(
      (item) => `
    <div class="media-card">
        <div class="media-preview">
            <img src="${API_BASE}${item.url}" alt="${item.filename}" loading="lazy">
            <div class="media-overlay">
                <button class="btn-icon delete" onclick="deleteMedia(${item.id})" title="Delete">🗑️</button>
            </div>
        </div>
        <div class="media-info">
            <span class="media-name" title="${item.filename}">${item.filename}</span>
            <span class="media-meta">${formatFileSize(item.file_size)}</span>
        </div>
    </div>
  `,
    )
    .join("");
}

window.deleteMedia = async (id) => {
  if (!confirm("Are you sure you want to delete this media?")) return;
  try {
    await api.delete(`/media/${id}`);
    showToast("Media deleted", "success");
    await loadMedia();
  } catch (error) {
    showToast(error.message, "error");
  }
};

async function uploadFiles(files) {
  try {
    showToast(`Uploading ${files.length} files...`, "info");
    await api.uploadMultipleFiles("/media/upload", files);
    showToast("Upload complete!", "success");
    await loadMedia();
  } catch (error) {
    showToast(error.message, "error");
  }
}

/**
 * Image Selector Modal Logic
 * Used by the composer to choose images from the library
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
    renderSelectorGallery();
  });

  if (closeBtn)
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

  // Close on outside click
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

  function renderSelectorGallery() {
    if (!gallery) return;
    if (allMedia.length === 0) {
      gallery.innerHTML =
        '<p class="text-center p-8 text-muted">No media found. Upload some in the Media Library first!</p>';
      return;
    }

    gallery.innerHTML = allMedia
      .map(
        (item) => `
      <div class="selector-item" data-id="${item.id}" data-url="${item.url}">
        <img src="${API_BASE}${item.url}" alt="${item.filename}">
        <div class="selector-overlay">Select</div>
      </div>
    `,
      )
      .join("");

    gallery.querySelectorAll(".selector-item").forEach((item) => {
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
