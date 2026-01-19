/**
 * Shared UI Components
 * Reusable components for consistent UX across all modules
 */

// Toast Notification System
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "success", duration = 5000) {
  const container = ensureToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon =
    {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    }[type] || "ℹ️";

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">×</button>
  `;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("toast-show"), 10);

  // Close button
  toast.querySelector(".toast-close").addEventListener("click", () => {
    closeToast(toast);
  });

  // Auto close
  if (duration > 0) {
    setTimeout(() => closeToast(toast), duration);
  }

  return toast;
}

function closeToast(toast) {
  toast.classList.remove("toast-show");
  setTimeout(() => toast.remove(), 300);
}

// Progress Bar
export function showProgress(current, total, label = "") {
  const percentage = Math.round((current / total) * 100);

  let progressBar = document.getElementById("global-progress-bar");

  if (!progressBar) {
    progressBar = document.createElement("div");
    progressBar.id = "global-progress-bar";
    progressBar.className = "progress-bar-container";
    progressBar.innerHTML = `
      <div class="progress-bar-label"></div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="progress-bar-percentage"></div>
    `;
    document.body.appendChild(progressBar);
  }

  const labelEl = progressBar.querySelector(".progress-bar-label");
  const fillEl = progressBar.querySelector(".progress-bar-fill");
  const percentageEl = progressBar.querySelector(".progress-bar-percentage");

  labelEl.textContent = label;
  fillEl.style.width = `${percentage}%`;
  percentageEl.textContent = `${current}/${total}`;

  progressBar.classList.add("progress-bar-show");

  // Auto hide when complete
  if (current >= total) {
    setTimeout(() => hideProgress(), 1000);
  }
}

export function hideProgress() {
  const progressBar = document.getElementById("global-progress-bar");
  if (progressBar) {
    progressBar.classList.remove("progress-bar-show");
  }
}

// Confirmation Modal
export function confirmAction(message, options = {}) {
  return new Promise((resolve) => {
    const {
      title = "Confirm Action",
      confirmText = "Confirm",
      cancelText = "Cancel",
      type = "warning",
    } = options;

    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-modal-header">
          <h3>${title}</h3>
        </div>
        <div class="confirm-modal-body confirm-modal-${type}">
          <p>${message}</p>
        </div>
        <div class="confirm-modal-footer">
          <button class="btn btn-secondary confirm-cancel">${cancelText}</button>
          <button class="btn btn-primary confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add("confirm-modal-show"), 10);

    const cleanup = (result) => {
      modal.classList.remove("confirm-modal-show");
      setTimeout(() => modal.remove(), 300);
      resolve(result);
    };

    modal
      .querySelector(".confirm-ok")
      .addEventListener("click", () => cleanup(true));
    modal
      .querySelector(".confirm-cancel")
      .addEventListener("click", () => cleanup(false));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) cleanup(false);
    });
  });
}

// Loading Spinner
export function showLoading(element, text = "Loading...") {
  const spinner = document.createElement("div");
  spinner.className = "loading-spinner";
  spinner.innerHTML = `
    <div class="spinner"></div>
    <div class="loading-text">${text}</div>
  `;

  element.style.position = "relative";
  element.appendChild(spinner);

  return spinner;
}

export function hideLoading(element) {
  const spinner = element.querySelector(".loading-spinner");
  if (spinner) {
    spinner.remove();
  }
}

// Inline Loading (for buttons)
export function setButtonLoading(button, loading = true, text = "Loading...") {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="btn-spinner"></span> ${text}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// Form Validation Helpers
export function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  // Remove existing error
  const existingError = field.parentElement.querySelector(".field-error");
  if (existingError) existingError.remove();

  // Add error class
  field.classList.add("field-invalid");

  // Add error message
  const error = document.createElement("div");
  error.className = "field-error";
  error.textContent = message;
  field.parentElement.appendChild(error);
}

export function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  field.classList.remove("field-invalid");
  const error = field.parentElement.querySelector(".field-error");
  if (error) error.remove();
}

export function clearAllFieldErrors(formElement) {
  formElement.querySelectorAll(".field-invalid").forEach((field) => {
    field.classList.remove("field-invalid");
  });
  formElement.querySelectorAll(".field-error").forEach((error) => {
    error.remove();
  });
}

// Tab Switching System
export function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      const parentSection = btn.closest(".content-section");

      if (!parentSection) return;

      // Deactivate all tabs in this section
      parentSection.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("active");
      });
      parentSection.querySelectorAll(".tab-content").forEach((c) => {
        c.style.display = "none";
        c.classList.remove("active");
      });

      // Activate clicked tab
      btn.classList.add("active");

      // Find content - tailored for the specific ID structure in index.html (e.g., "composeTab")
      const contentId = `${tabId}Tab`;
      const content = document.getElementById(contentId);
      if (content) {
        content.style.display = "block";
        content.classList.add("active");
      }
    });
  });
}
