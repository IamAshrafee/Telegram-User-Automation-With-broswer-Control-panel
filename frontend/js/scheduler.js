import { api, formatDate } from "./app.js";
import { allGroups } from "./groups.js";
import { showToast, confirmAction } from "./ui-components.js";

let scheduledJobs = [];

export async function loadScheduledJobs() {
  try {
    scheduledJobs = await api.get("/scheduler/jobs");
    renderScheduledJobs();
    updateDashboardStats();
  } catch (error) {
    console.error("Error loading scheduled jobs:", error);
  }
}

function renderScheduledJobs() {
  const list = document.getElementById("scheduledList");

  if (scheduledJobs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏰</div>
        <p class="empty-state-text">No active schedules</p>
      </div>
    `;
    return;
  }

  list.innerHTML = scheduledJobs
    .map(
      (job) => `
        <div class="history-item"> <!-- Reusing history item style -->
            <div class="history-icon" style="background: var(--primary-50); color: var(--color-primary);">
                ⏰
            </div>
            <div class="history-content">
                <div class="history-text">
                    ${job.text ? job.text.substring(0, 80) + "..." : "Scheduled Message"}
                </div>
                <div class="history-meta">
                    <span style="color: var(--color-primary); font-weight: 600;">
                        Running: ${new Date(job.scheduled_at).toLocaleString()}
                    </span>
                    <span>•</span>
                    <span>ID: ${job.id}</span>
                </div>
            </div>
            <div class="history-actions">
                 <button class="btn btn-outline-danger btn-sm" onclick="cancelScheduledJob(${job.id})">
                    🗑️ Cancel
                 </button>
            </div>
        </div>
    `,
    )
    .join("");
}

export async function cancelScheduledJob(jobId) {
  const confirmed = await confirmAction(
    "Are you sure you want to cancel this scheduled message?",
    { title: "Cancel Scheduled Message", confirmText: "Cancel Message" },
  );

  if (!confirmed) return;

  try {
    await api.delete(`/scheduler/jobs/${jobId}`);
    await loadScheduledJobs();
    showToast("Scheduled message cancelled", "success");
  } catch (error) {
    showToast("Failed to cancel: " + error.message, "error");
  }
}

// Make it globally available for onclick
window.cancelScheduledJob = cancelScheduledJob;

// Helper to toggle media clear button
function setupMediaInputToggle(fileInputId, clearBtnId, selectBtnId) {
  const fileInput = document.getElementById(fileInputId);
  const clearBtn = document.getElementById(clearBtnId);
  const selectBtn = document.getElementById(selectBtnId);

  if (!fileInput || !clearBtn || !selectBtn) return;

  // Observe changes to hidden input
  const observer = new MutationObserver(() => {
    if (fileInput.value) {
      selectBtn.textContent = "Change Image";
      clearBtn.style.display = "inline-flex";
    } else {
      selectBtn.textContent = "🖼️ Select Image";
      clearBtn.style.display = "none";
    }
  });

  observer.observe(fileInput, { attributes: true, attributeFilter: ["value"] });

  // Also manual check
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    selectBtn.textContent = "🖼️ Select Image";
    clearBtn.style.display = "none";
  });
}

export function setupScheduler() {
  const scheduleBtn = document.getElementById("scheduleMessageBtn");
  const bulkScheduleCheck = document.getElementById("bulkScheduleCheck");
  const bulkPermissionGroup = document.getElementById(
    "bulkSchedulePermissionGroup",
  );
  const individualGroupsGroup = document.getElementById(
    "individualScheduleGroupsGroup",
  );

  // Setup media toggle
  setupMediaInputToggle(
    "scheduleMedia",
    "clearScheduleMedia",
    "selectScheduleMedia",
  );

  // Add null checks
  if (!bulkScheduleCheck || !bulkPermissionGroup || !individualGroupsGroup) {
    console.error("Bulk schedule elements not found in DOM");
    return;
  }

  // Bulk send toggle
  bulkScheduleCheck.addEventListener("change", () => {
    if (bulkScheduleCheck.checked) {
      bulkSchedulePermissionGroup.style.display = "block";
      individualScheduleGroupsGroup.style.display = "none";
    } else {
      bulkSchedulePermissionGroup.style.display = "none";
      individualScheduleGroupsGroup.style.display = "block";
    }
  });

  scheduleBtn.addEventListener("click", async () => {
    const text = document.getElementById("scheduleText").value.trim();
    const link = document.getElementById("scheduleLink").value.trim();
    const mediaId = document.getElementById("scheduleMedia").value;
    const dateTime = document.getElementById("scheduleDateTime").value;

    if (!text) {
      showToast("Please enter message text", "error");
      return;
    }

    if (!dateTime) {
      showToast("Please select date and time", "error");
      return;
    }

    let groupIds;
    if (bulkScheduleCheck.checked) {
      const permission = document.getElementById(
        "bulkSchedulePermission",
      ).value;
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
      groupIds = getSelectedGroups("scheduleGroupSelector");
      if (groupIds.length === 0) {
        showToast("Please select at least one group", "error");
        return;
      }
    }

    try {
      scheduleBtn.disabled = true;
      scheduleBtn.textContent = "Scheduling...";

      const response = await api.post("/scheduler/schedule", {
        text: text,
        link: link || null,
        media_id: mediaId ? parseInt(mediaId) : null,
        target_groups: groupIds,
        scheduled_at: new Date(dateTime).toISOString(),
      });

      showToast("Message scheduled successfully!", "success");

      // Reset form
      document.getElementById("scheduleText").value = "";
      document.getElementById("scheduleLink").value = "";
      document.getElementById("scheduleMedia").value = "";
      document.getElementById("scheduleDateTime").value = "";

      await loadScheduledJobs();
    } catch (error) {
      showToast("Failed to schedule message: " + error.message, "error");
    } finally {
      scheduleBtn.disabled = false;
      scheduleBtn.textContent = "Schedule Message";
    }
  });
}

function getSelectedGroups(selectorId) {
  const checkboxes = document.querySelectorAll(
    `#${selectorId} input[type="checkbox"]:checked`,
  );
  return Array.from(checkboxes).map((cb) => parseInt(cb.value));
}

function updateDashboardStats() {
  document.getElementById("scheduledMessages").textContent =
    scheduledJobs.length;
}
