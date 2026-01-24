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

  const iconInfo = {
    success: { icon: "CheckCircle", color: "#10b981", title: "Success" },
    error: { icon: "AlertCircle", color: "#ef4444", title: "Error" },
    warning: { icon: "AlertTriangle", color: "#f59e0b", title: "Warning" },
    info: { icon: "Info", color: "#3b82f6", title: "Information" },
  }[type] || { icon: "Info", color: "#3b82f6", title: "Info" };
  
  // Use SVG icons for premium look (inline for simplicity here)
  const icons = {
    CheckCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    AlertCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    AlertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    Info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[iconInfo.icon]}</span>
    <div class="toast-content">
        <div class="toast-title">${iconInfo.title}</div>
        <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">×</button>
    <div class="toast-progress">
        <div class="toast-progress-bar" style="transition: transform ${duration}ms linear;"></div>
    </div>
  `;

  container.appendChild(toast);

  // Trigger animation (next frame)
  requestAnimationFrame(() => {
    toast.classList.add("toast-show");
    
    // Start progress bar
    if (duration > 0) {
        const progressBar = toast.querySelector('.toast-progress-bar');
        // Start full width (scaleX 1) then shrink to 0
        progressBar.style.transform = "scaleX(1)";
        
        // Force reflow
        void progressBar.offsetWidth;
        
        progressBar.style.transform = "scaleX(0)";
    }
  });

  const close = () => {
    toast.classList.remove("toast-show");
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 400); // Match CSS transition duration
  };

  // Close button
  toast.querySelector(".toast-close").addEventListener("click", close);

  // Auto close
  if (duration > 0) {
    setTimeout(close, duration);
  }

  return toast;
}

function closeToast(toast) {
  // Helper kept for compatibility, though internal close() is preferred
  toast.classList.remove("toast-show");
  setTimeout(() => {
      if(toast.parentElement) toast.remove();
  }, 400);
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

// Generic Modal (for custom content like previews)
export function showCustomModal(title, contentHtml, buttons = []) {
  const modal = document.createElement("div");
  modal.className = "confirm-modal-overlay";
  
  // Generate buttons HTML
  const buttonsHtml = buttons.map(btn => 
      `<button class="btn ${btn.class || 'btn-secondary'} modal-btn-${btn.id}">${btn.text}</button>`
  ).join("");

  modal.innerHTML = `
    <div class="confirm-modal" style="max-width: 500px; width: 90%;">
      <div class="confirm-modal-header">
        <h3>${title}</h3>
        <button class="modal-close-icon" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">×</button>
      </div>
      <div class="confirm-modal-body" style="padding: 20px;">
        ${contentHtml}
      </div>
      <div class="confirm-modal-footer">
        ${buttonsHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("confirm-modal-show"), 10);

  const close = () => {
    modal.classList.remove("confirm-modal-show");
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector(".modal-close-icon").addEventListener("click", close);
  
  // Bind button events
  buttons.forEach(btn => {
      const btnEl = modal.querySelector(`.modal-btn-${btn.id}`);
      if (btnEl) {
          btnEl.addEventListener("click", () => {
              if (btn.onClick) btn.onClick(close);
              else close();
          });
      }
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  
  return modal;
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
