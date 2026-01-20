import { api } from "./app.js";
import { allGroups } from "./groups.js";
import { showToast, setButtonLoading, confirmAction } from "./ui-components.js";
import { setupMessageHistory } from "./message-history.js";

let scheduledJobs = [];

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

  // New Scheduler elements
  const scheduleCheck = document.getElementById("scheduleCheck");
  const scheduleTimeGroup = document.getElementById("scheduleTimeGroup");
  const scheduleDateTime = document.getElementById("scheduleDateTime");
  const refreshScheduledBtn = document.getElementById("refreshScheduledBtn");

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

  // Schedule for later toggle
  if (scheduleCheck) {
    scheduleCheck.addEventListener("change", () => {
      if (scheduleCheck.checked) {
        scheduleTimeGroup.style.display = "block";
        sendBtn.textContent = "📅 Schedule Message";
      } else {
        scheduleTimeGroup.style.display = "none";
        sendBtn.textContent = "🚀 Send Message Now";
      }
    });
  }

  // Refresh scheduled jobs
  if (refreshScheduledBtn) {
    refreshScheduledBtn.addEventListener("click", () => {
      loadScheduledJobs();
    });
  }

  // Load scheduled jobs when tab is clicked
  const scheduledTabBtn = document.querySelector(
    '.tab-btn[data-tab="scheduled"]',
  );
  if (scheduledTabBtn) {
    scheduledTabBtn.addEventListener("click", () => {
      loadScheduledJobs();
    });
  }

  // Send or Schedule message
  sendBtn.addEventListener("click", async () => {
    const text = messageText.value.trim();
    const link = document.getElementById("messageLink").value.trim();
    const mediaId = document.getElementById("messageMedia").value;
    const isScheduled = scheduleCheck && scheduleCheck.checked;
    const dateTime = scheduleDateTime.value;

    if (!text) {
      showToast("Please enter message text", "error");
      return;
    }

    if (isScheduled && !dateTime) {
      showToast("Please select date and time", "error");
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
      if (isScheduled) {
        setButtonLoading(sendBtn, true, "Scheduling...");
        await api.post("/messages/schedule", {
          text: text,
          link: link || null,
          media_id: mediaId ? parseInt(mediaId) : null,
          target_groups: groupIds,
          scheduled_at: new Date(dateTime).toISOString(),
        });

        showToast("Message scheduled successfully!", "success");

        // Reset inputs
        messageText.value = "";
        charCount.textContent = "0";
        document.getElementById("messageLink").value = "";
        document.getElementById("messageMedia").value = "";
        scheduleDateTime.value = "";
        scheduleCheck.checked = false;
        scheduleCheck.dispatchEvent(new Event("change")); // Reset UI state

        // Switch to scheduled tab
        if (scheduledTabBtn) {
          scheduledTabBtn.click();
        }
      } else {
        setButtonLoading(sendBtn, true, "Sending...");
        const response = await api.post("/messages/send", {
          text: text,
          link: link || null,
          media_id: mediaId ? parseInt(mediaId) : null,
          target_groups: groupIds,
        });

        if (
          response.sent_count === 0 &&
          response.failed_count === 0 &&
          response.skipped_count === 0
        ) {
          // Started in background
          import("./progress-widget.js").then(({ progressWidget }) => {
            progressWidget.startTracking(response.message_id);
          });
          showToast(
            "Message sending started! Minimizing to progress card...",
            "success",
          );
        } else {
          showToast(
            `Message processed! Sent: ${response.sent_count}, Failed: ${response.failed_count}, Skipped: ${response.skipped_count}`,
            "success",
          );
        }

        // DON'T reset the form - user requested this
        // Only clear the message text
        messageText.value = "";
        charCount.textContent = "0";
      }
    } catch (error) {
      showToast(
        `Failed to ${isScheduled ? "schedule" : "send"} message: ` +
          error.message,
        "error",
      );
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

// Scheduled Jobs Logic (ported from scheduler.js)
export async function loadScheduledJobs() {
  try {
    scheduledJobs = await api.get("/messages/scheduled");
    renderScheduledJobs();
    updateDashboardStats(); // If this exists
  } catch (error) {
    console.error("Error loading scheduled jobs:", error);
  }
}

function renderScheduledJobs() {
  const list = document.getElementById("scheduledList");
  if (!list) return;

  if (scheduledJobs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏰</div>
        <p class="empty-state-text">No active schedules</p>
        <p class="empty-state-subtext">Messages scheduled for the future will appear here</p>
      </div>
    `;
    return;
  }

  list.innerHTML = scheduledJobs
    .map((job) => {
      const date = new Date(job.scheduled_at);
      const dayName = date.toLocaleDateString(undefined, { weekday: "short" });
      const dayNum = date.getDate();
      const fullDate = date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      // Time with explicitly showing the timezone code (e.g. EST, GMT, etc.)
      const timeStr = date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

      const groups = job.target_groups || [];
      const groupsCount = groups.length;

      // Create a snippet of target groups: "Group A, Group B + 3 others"
      let groupText = "No groups";
      if (groupsCount > 0) {
        // We only have IDs in the job usually, unless we fetch details.
        // But we have 'allGroups' imported! Let's try to map names.
        const groupNames = groups.map((gid) => {
          const g = allGroups.find((x) => x.id === gid);
          return g ? g.title : `ID:${gid}`;
        });

        if (groupsCount <= 2) {
          groupText = groupNames.join(", ");
        } else {
          groupText = `${groupNames.slice(0, 2).join(", ")} + ${groupsCount - 2} others`;
        }
      }

      // Calculate "starts in" calculation
      const now = new Date();
      const diffMs = date - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      let relativeTime = "";
      let countdownClass = "countdown";

      if (diffMs < 0) {
        relativeTime = "Running Soon...";
        countdownClass = "time"; // Neutral style for running/overdue
      } else if (diffHrs > 48) {
        const days = Math.floor(diffHrs / 24);
        relativeTime = `In ${days} days`;
      } else if (diffHrs > 0) {
        relativeTime = `In ${diffHrs}h ${diffMins}m`;
      } else {
        relativeTime = `In ${diffMins} mins`;
      }

      // Message Snippet
      const msgSnippet = job.text
        ? job.text.length > 60
          ? job.text.substring(0, 60) + "..."
          : job.text
        : "Image/Media Message";

      return `
        <div class="scheduled-card" title="Scheduled for ${fullDate} at ${timeStr}">
            <div class="scheduled-icon">
                <span class="day">${dayName}</span>
                <span class="date">${dayNum}</span>
            </div>
            <div class="scheduled-info">
                <div class="scheduled-header">
                     <div class="scheduled-title">${msgSnippet}</div>
                </div>
                
                <div class="scheduled-targets">
                    <span>📡 Sending to:</span>
                    <span style="font-weight: 500; color: var(--text-main);">${groupText}</span>
                </div>

                <div class="scheduled-meta">
                    <span class="meta-badge time">
                        📅 ${fullDate}
                    </span>
                    <span class="meta-badge time">
                        ⏰ ${timeStr}
                    </span>
                    <span class="meta-badge ${countdownClass}">
                        ⏳ ${relativeTime}
                    </span>
                </div>
            </div>
            <div class="scheduled-actions">
                 <button class="btn btn-outline-danger btn-sm" onclick="cancelScheduledJob(${job.id})" title="Cancel Schedule">
                    🗑️ Cancel
                 </button>
            </div>
        </div>
    `;
    })
    .join("");
}

export async function cancelScheduledJob(jobId) {
  const confirmed = await confirmAction(
    "Are you sure you want to cancel this scheduled message?",
    { title: "Cancel Scheduled Message", confirmText: "Cancel Message" },
  );

  if (!confirmed) return;

  try {
    await api.delete(`/messages/scheduled/${jobId}`);
    await loadScheduledJobs();
    showToast("Scheduled message cancelled", "success");
  } catch (error) {
    showToast("Failed to cancel: " + error.message, "error");
  }
}

// Make it globally available for onclick
window.cancelScheduledJob = cancelScheduledJob;

function updateDashboardStats() {
  const statEl = document.getElementById("scheduledMessages");
  if (statEl) {
    statEl.textContent = scheduledJobs.length;
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
