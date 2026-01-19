import { api } from "./app.js";
import { allGroups } from "./groups.js";
import { showToast, setButtonLoading } from "./ui-components.js";
import { setupMessageHistory } from "./message-history.js";

export function setupMessages() {
  setupMessageHistory();

  const messageText = document.getElementById("messageText");
  const charCount = document.getElementById("charCount");
  const sendBtn = document.getElementById("sendMessageBtn");
  const bulkSendCheck = document.getElementById("bulkSendCheck");
  const bulkPermissionGroup = document.getElementById("bulkPermissionGroup");
  const individualGroupsGroup = document.getElementById(
    "individualGroupsGroup",
  );

  // Add null checks
  if (!bulkSendCheck || !bulkPermissionGroup || !individualGroupsGroup) {
    console.error("Bulk send elements not found in DOM");
    return;
  }

  // Character count with validation
  messageText.addEventListener("input", () => {
    const length = messageText.value.length;
    charCount.textContent = length;

    // Visual feedback for length
    if (length > 4096) {
      charCount.style.color = "var(--color-danger)"; // Red
      messageText.classList.add("field-invalid");
    } else if (length > 3500) {
      charCount.style.color = "var(--color-warning)"; // Orange warning
      messageText.classList.remove("field-invalid");
    } else {
      charCount.style.color = "var(--color-text-secondary)";
      messageText.classList.remove("field-invalid");
    }
  });

  // Bulk send toggle
  bulkSendCheck.addEventListener("change", () => {
    if (bulkSendCheck.checked) {
      bulkPermissionGroup.style.display = "block";
      individualGroupsGroup.style.display = "none";
    } else {
      bulkPermissionGroup.style.display = "none";
      individualGroupsGroup.style.display = "block";
    }
  });

  // Send message
  sendBtn.addEventListener("click", async () => {
    const text = messageText.value.trim();
    const link = document.getElementById("messageLink").value.trim();
    const mediaId = document.getElementById("messageMedia").value;

    if (!text) {
      showToast("Please enter message text", "error");
      return;
    }

    let groupIds;
    if (bulkSendCheck.checked) {
      const permission = document.getElementById("messageBulkPermission").value;
      if (!permission) {
        showToast("Please select a permission type", "error");
        return;
      }
      // Get all active groups with this permission
      groupIds = allGroups
        .filter((g) => g.is_active && g.permission_type === permission)
        .map((g) => g.id);

      if (groupIds.length === 0) {
        showToast(
          `No active groups found with permission: ${permission}`,
          "warning",
        );
        return;
      }
    } else {
      groupIds = getSelectedGroups("groupSelector");
      if (groupIds.length === 0) {
        showToast("Please select at least one group", "error");
        return;
      }
    }

    try {
      setButtonLoading(sendBtn, true, "Sending...");

      const response = await api.post("/messages/send", {
        text: text,
        link: link || null,
        media_id: mediaId ? parseInt(mediaId) : null,
        target_groups: groupIds,
      });

      showToast(
        `Message sent! Sent: ${response.sent_count}, Failed: ${response.failed_count}, Skipped: ${response.skipped_count}`,
        "success",
      );

      // DON'T reset the form - user requested this
      // Only clear the message text
      messageText.value = "";
      charCount.textContent = "0";
    } catch (error) {
      showToast("Failed to send message: " + error.message, "error");
    } finally {
      setButtonLoading(sendBtn, false);
    }
  });

  // Media toggle logic
  const mediaInput = document.getElementById("messageMedia");
  const clearMediaBtn = document.getElementById("clearMessageMedia");
  const selectMediaBtn = document.getElementById("selectMessageMedia");

  if (mediaInput && clearMediaBtn && selectMediaBtn) {
    const updateMediaUI = () => {
      if (mediaInput.value) {
        selectMediaBtn.textContent = "Change Image";
        clearMediaBtn.style.display = "inline-flex";
      } else {
        selectMediaBtn.textContent = "🖼️ Select Image";
        clearMediaBtn.style.display = "none";
      }
    };

    // Watch for changes (since it's a hidden input updated by modal)
    const observer = new MutationObserver(updateMediaUI);
    observer.observe(mediaInput, {
      attributes: true,
      attributeFilter: ["value"],
    });

    clearMediaBtn.addEventListener("click", () => {
      mediaInput.value = "";
      updateMediaUI();
    });
  }

  // Preview message
  const previewBtn = document.getElementById("previewMessageBtn");
  if (previewBtn) {
    previewBtn.addEventListener("click", async () => {
      const text = messageText.value.trim();
      const link = document.getElementById("messageLink").value.trim();
      const mediaId = document.getElementById("messageMedia").value;

      if (!text) {
        showToast("Please enter message text to preview", "error");
        return;
      }

      let groupIds;
      if (bulkSendCheck.checked) {
        const permission = document.getElementById(
          "messageBulkPermission",
        ).value;
        if (!permission) {
          showToast("Please select a permission type", "error");
          return;
        }
        groupIds = allGroups
          .filter((g) => g.is_active && g.permission_type === permission)
          .map((g) => g.id);
      } else {
        groupIds = getSelectedGroups("groupSelector");
      }

      if (groupIds.length === 0) {
        showToast("Please select at least one group", "error");
        return;
      }

      try {
        setButtonLoading(previewBtn, true, "Loading...");

        const preview = await api.post("/messages/preview", {
          text: text,
          link: link || null,
          media_id: mediaId ? parseInt(mediaId) : null,
          target_groups: groupIds,
        });

        showPreviewModal(preview);
      } catch (error) {
        showToast("Failed to load preview: " + error.message, "error");
      } finally {
        setButtonLoading(previewBtn, false);
      }
    });
  }
}

function showPreviewModal(preview) {
  const modal = document.createElement("div");
  modal.className = "confirm-modal-overlay confirm-modal-show preview-backdrop";

  const now = new Date();
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Render each group's preview as a "Message Block"
  // If multiple groups, we can show them separated by dividers
  let messagesHTML = preview.previews
    .map(
      (p) => `
    <div class="mockup-divider"><span>To: ${p.group_name}</span></div>
    <div class="mockup-message sent">
      <div class="mockup-text">${formatMessageText(p.processed_text)}</div>
       <div class="mockup-meta">
          <span class="mockup-time">${timeString}</span>
          <span class="mockup-checks">✓✓</span>
        </div>
    </div>
  `,
    )
    .join("");

  modal.innerHTML = `
    <div class="telegram-mockup">
      <!-- Header -->
      <div class="mockup-header">
         <div class="mockup-avatar">Bot</div>
         <div class="mockup-info">
            <div class="mockup-name">Message Preview</div>
            <div class="mockup-status">bot • ${preview.total_groups} recipients</div>
         </div>
         <button class="mockup-close" id="closePreviewModal">✕</button>
      </div>

      <!-- Chat Area -->
      <div class="mockup-body">
         <div class="mockup-divider"><span>Today</span></div>
         <!-- Stats / Info Message from System -->
         <div class="mockup-message received">
             <div class="mockup-text">
                <strong>Analysis Complete 📊</strong><br>
                Ready to send to ${preview.total_groups} groups.<br>
                Est. time: ${preview.estimated_time}
             </div>
             <div class="mockup-meta">
               <span class="mockup-time">${timeString}</span>
             </div>
         </div>
         
         ${messagesHTML}
         
         ${
           preview.previews.length < preview.total_groups
             ? `<div class="mockup-divider"><span>+ ${preview.total_groups - preview.previews.length} more groups</span></div>`
             : ""
         }
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById("closePreviewModal");
  const closeModal = () => {
    modal.classList.remove("confirm-modal-show");
    setTimeout(() => modal.remove(), 300);
  };

  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Helper to highlight variables/links in preview
function formatMessageText(text) {
  // Escape HTML first
  let safeText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Linkify URLs (simple regex)
  safeText = safeText.replace(
    /(https?:\/\/[^\s]+)/g,
    '<span style="color: #3b82f6; text-decoration: underline;">$1</span>',
  );
  return safeText;
}

function getSelectedGroups(selectorId) {
  const checkboxes = document.querySelectorAll(
    `#${selectorId} input[type="checkbox"]:checked`,
  );
  return Array.from(checkboxes).map((cb) => parseInt(cb.value));
}
