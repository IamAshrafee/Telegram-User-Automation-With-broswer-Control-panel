import { api, formatFileSize } from "./app.js";
import { showToast, confirmAction } from "./ui-components.js";

let mediaFiles = [];

export async function loadMedia() {
  try {
    mediaFiles = await api.get("/media/");
    renderMediaGallery();
    updateMediaSelectors();
    updateDashboardStats();
  } catch (error) {
    console.error("Error loading media:", error);
  }
}

function renderMediaGallery() {
  const gallery = document.getElementById("mediaGallery");

  // Loading State
  if (!mediaFiles) {
    gallery.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; height: 300px; display: flex; align-items: center; justify-content: center;">
            <div class="spinner"></div>
        </div>
     `;
    return;
  }

  if (mediaFiles.length === 0) {
    gallery.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 2rem;">
        <div class="empty-state-icon" style="background: var(--bg-secondary); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-main);">No media yet</h3>
        <p class="empty-state-subtext" style="max-width: 300px; margin: 0 auto;">Upload images to start building your library. You can use them in your message campaigns.</p>
      </div>`;
    return;
  }

  gallery.innerHTML = mediaFiles
    .map(
      (media) => `
        <div class="media-card fade-in-up">
            <div style="position: relative; overflow: hidden; border-radius: var(--radius-md) var(--radius-md) 0 0;">
                <img src="/media/${media.id}" alt="${media.filename}" loading="lazy" style="display: block; width: 100%; height: auto; transition: transform 0.3s ease;" />
                <div class="media-card-overlay">
                    <button class="btn btn-sm btn-light copy-btn" data-url="${window.location.origin}/media/${media.id}" title="Copy Link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    </button>
                    <button class="btn btn-sm btn-danger delete-btn" data-media-id="${media.id}" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <div class="media-info">
                <div class="media-name" title="${media.filename}">${media.filename}</div>
                <div class="media-size">${formatFileSize(media.file_size)}</div>
            </div>
        </div>
    `,
    )
    .join("");

  // Add event listeners
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Prevent card clicks if we duplicate interactions
      const mediaId = e.target.closest(".delete-btn").dataset.mediaId;
      const confirmed = await confirmAction(
        "Are you sure you want to delete this media file?",
        { title: "Delete Media", confirmText: "Delete", type: "warning" },
      );
      if (confirmed) {
        await deleteMedia(mediaId);
      }
    });
  });

  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = e.target.closest(".copy-btn").dataset.url;
      navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard", "success");
    });
  });
}

async function deleteMedia(mediaId) {
  try {
    await api.delete(`/media/${mediaId}`);
    await loadMedia();
    showToast("Media deleted successfully", "success");
  } catch (error) {
    console.error("Error deleting media:", error);
    showToast("Failed to delete media: " + error.message, "error");
  }
}

function updateMediaSelectors() {
  // Update button text based on available media
  const messageMediaBtn = document.getElementById("selectMessageMedia");
  const scheduleMediaBtn = document.getElementById("selectScheduleMedia");

  if (mediaFiles.length === 0) {
    if (messageMediaBtn) messageMediaBtn.textContent = "No images available";
    if (scheduleMediaBtn) scheduleMediaBtn.textContent = "No images available";
    return;
  }

  // Reset buttons if they were showing a selected image
  const messageMediaInput = document.getElementById("messageMedia");
  const scheduleMediaInput = document.getElementById("scheduleMedia");

  if (messageMediaInput && !messageMediaInput.value && messageMediaBtn) {
    messageMediaBtn.textContent = "Select Image";
  }
  if (scheduleMediaInput && !scheduleMediaInput.value && scheduleMediaBtn) {
    scheduleMediaBtn.textContent = "Select Image";
  }
}

function showImageSelectorModal(targetInputId) {
  const modal = document.getElementById("imageSelectorModal");
  const gallery = document.getElementById("imageSelectorGallery");

  // Get currently selected media ID (if any)
  const currentMediaId = document.getElementById(targetInputId)?.value;

  // Sort by upload date (newest first)
  const sortedMedia = [...mediaFiles].sort(
    (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at),
  );

  gallery.innerHTML = sortedMedia
    .map((media) => {
      const isSelected = String(media.id) === String(currentMediaId);
      return `
        <div class="image-selector-item ${isSelected ? "selected" : ""}" data-media-id="${media.id}" data-filename="${media.filename}">
            <div class="check-badge">✓</div>
            <div class="img-wrapper">
                <img src="/media/${media.id}" alt="${media.filename}" loading="lazy" />
            </div>
            <div class="image-selector-name">
                <span title="${media.filename}">${media.filename}</span>
            </div>
        </div>
    `;
    })
    .join("");

  // Add click handlers
  document.querySelectorAll(".image-selector-item").forEach((item) => {
    item.addEventListener("click", () => {
      const mediaId = item.dataset.mediaId;
      const filename = item.dataset.filename;

      // Set the hidden input and update button text
      const targetInput = document.getElementById(targetInputId);
      if (targetInput) {
        targetInput.value = mediaId;
        // Trigger change event manually so observers pick it up
        targetInput.setAttribute("value", mediaId);
      }

      const btnId =
        targetInputId === "messageMedia"
          ? "selectMessageMedia"
          : "selectScheduleMedia";

      const btn = document.getElementById(btnId);
      if (btn) btn.textContent = `✓ ${filename}`;

      // Update Preview
      const previewId = targetInputId + "Preview";
      const previewContainer = document.getElementById(previewId);
      if (previewContainer) {
        const img = previewContainer.querySelector("img");
        if (img) img.src = `/media/${mediaId}`;
        previewContainer.style.display = "block";
      }

      // Show Clear Button
      const clearBtnId =
        targetInputId === "messageMedia"
          ? "clearMessageMedia"
          : "clearScheduleMedia";
      const clearBtn = document.getElementById(clearBtnId);
      if (clearBtn) clearBtn.style.display = "inline-flex";

      // Close modal
      modal.classList.add("hidden");
    });
  });

  modal.classList.remove("hidden");
}

export function setupMedia() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const imageSelectorModal = document.getElementById("imageSelectorModal");
  const closeModalBtn = document.getElementById("closeImageSelector");
  const clearMessageMediaBtn = document.getElementById("clearMessageMedia");
  const clearScheduleMediaBtn = document.getElementById("clearScheduleMedia");

  // Click to select file
  selectFileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea.addEventListener("click", () => {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await uploadFiles(files);
    }
    fileInput.value = ""; // Reset input
  });

  // Drag and drop
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

    const files = e.dataTransfer.files;
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length > 0) {
      await uploadFiles(imageFiles);
    } else {
      showToast("Please upload image files only.", "error");
    }
  });

  // Image selector modal
  document
    .getElementById("selectMessageMedia")
    .addEventListener("click", () => {
      if (mediaFiles.length > 0) {
        showImageSelectorModal("messageMedia");
      }
    });

  document
    .getElementById("selectScheduleMedia")
    .addEventListener("click", () => {
      if (mediaFiles.length > 0) {
        showImageSelectorModal("scheduleMedia");
      }
    });

  closeModalBtn.addEventListener("click", () => {
    imageSelectorModal.classList.add("hidden");
  });

  // Clear selection buttons
  clearMessageMediaBtn.addEventListener("click", () => {
    document.getElementById("messageMedia").value = "";
    document.getElementById("selectMessageMedia").textContent =
      "🖼️ Select Image";
    document.getElementById("messageMediaPreview").style.display = "none";
    clearMessageMediaBtn.style.display = "none";
  });

  clearScheduleMediaBtn.addEventListener("click", () => {
    document.getElementById("scheduleMedia").value = "";
    document.getElementById("selectScheduleMedia").textContent =
      "🖼️ Select Image";
    document.getElementById("scheduleMediaPreview").style.display = "none";
    clearScheduleMediaBtn.style.display = "none";
  });

  // Close modal on outside click
  imageSelectorModal.addEventListener("click", (e) => {
    if (e.target === imageSelectorModal) {
      imageSelectorModal.classList.add("hidden");
    }
  });
}

async function uploadFiles(files) {
  const uploadContent = document.querySelector(".upload-content");
  const originalHTML = uploadContent.innerHTML;
  const filesToUpload = Array.from(files);

  // Check for duplicates
  const duplicates = filesToUpload.filter((file) =>
    mediaFiles.some((m) => m.filename === file.name),
  );

  if (duplicates.length > 0) {
    const filenames = duplicates.map((f) => f.name).join(", ");
    const confirmed = await confirmAction(
      `File(s) named "${filenames}" already exist. Upload anyway?`,
      { title: "Duplicate Files", confirmText: "Upload", type: "warning" },
    );
    if (!confirmed) {
      return;
    }
  }

  try {
    uploadContent.innerHTML = `<p>Uploading ${filesToUpload.length} file(s)...</p>`;
    await api.uploadMultipleFiles("/media/upload", filesToUpload);
  } catch (error) {
    console.error("Error uploading files:", error);
    showToast("Upload failed: " + error.message, "error");
  } finally {
    // Restore original content and reload media
    uploadContent.innerHTML = originalHTML;
    document.getElementById("selectFileBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("fileInput").click();
    });
    await loadMedia();
  }
}

function updateDashboardStats() {
  document.getElementById("totalMedia").textContent = mediaFiles.length;
}

export { mediaFiles };
