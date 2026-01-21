import { api } from "./api.js";
import { showToast } from "./ui-components.js";
import { formatDate } from "./utils.js";

export function setupMessages() {
  const sendMessageBtn = document.getElementById("sendMessageBtn");
  const scheduleCheck = document.getElementById("scheduleCheck");
  const scheduleTimeGroup = document.getElementById("scheduleTimeGroup");
  const bulkSendCheck = document.getElementById("bulkSendCheck");
  const bulkPermissionGroup = document.getElementById("bulkPermissionGroup");
  const individualGroupsGroup = document.getElementById(
    "individualGroupsGroup",
  );
  const refreshScheduledBtn = document.getElementById("refreshScheduledBtn");

  if (sendMessageBtn)
    sendMessageBtn.addEventListener("click", handleSendMessage);

  if (scheduleCheck) {
    scheduleCheck.addEventListener("change", (e) => {
      scheduleTimeGroup.style.display = e.target.checked ? "block" : "none";
      sendMessageBtn.textContent = e.target.checked
        ? "📅 Schedule Message"
        : "🚀 Send Message Now";
    });
  }

  if (bulkSendCheck) {
    bulkSendCheck.addEventListener("change", (e) => {
      bulkPermissionGroup.style.display = e.target.checked ? "block" : "none";
      individualGroupsGroup.style.display = e.target.checked ? "none" : "block";
    });
  }

  if (refreshScheduledBtn)
    refreshScheduledBtn.addEventListener("click", loadScheduledJobs);

  loadHistory();
}

async function handleSendMessage() {
  const text = document.getElementById("messageText").value.trim();
  const link = document.getElementById("messageLink").value.trim();
  const mediaId = document.getElementById("messageMedia").value;
  const isScheduled = document.getElementById("scheduleCheck").checked;
  const scheduleTime = document.getElementById("scheduleDateTime").value;
  const isBulk = document.getElementById("bulkSendCheck").checked;
  const bulkPermission = document.getElementById("messageBulkPermission").value;

  const selectedGroups = Array.from(
    document.querySelectorAll('input[name="target_groups"]:checked'),
  ).map((cb) => parseInt(cb.value));

  if (!text) {
    showToast("Please enter message text", "error");
    return;
  }
  if (isBulk && !bulkPermission) {
    showToast("Please select a permission type for bulk sending", "error");
    return;
  }
  if (!isBulk && selectedGroups.length === 0) {
    showToast("Please select at least one target group", "error");
    return;
  }
  if (isScheduled && !scheduleTime) {
    showToast("Please select a schedule time", "error");
    return;
  }

  try {
    const btn = document.getElementById("sendMessageBtn");
    btn.disabled = true;
    btn.textContent = isScheduled ? "Scheduling..." : "Sending...";

    const payload = {
      text,
      link: link || null,
      media_id: mediaId ? parseInt(mediaId) : null,
    };

    if (isScheduled)
      payload.scheduled_at = new Date(scheduleTime).toISOString();

    let endpoint = "";
    if (isBulk) {
      payload.permission_type = bulkPermission;
      endpoint = isScheduled
        ? "/messages/schedule/bulk"
        : "/messages/send/bulk";
    } else {
      payload.group_ids = selectedGroups;
      endpoint = isScheduled ? "/messages/schedule" : "/messages/send";
    }

    await api.post(endpoint, payload);
    showToast(
      isScheduled ? "Message scheduled!" : "Message sending started!",
      "success",
    );

    if (!isScheduled) {
      document.getElementById("messageText").value = "";
      document.getElementById("messageLink").value = "";
      document.getElementById("messageMedia").value = "";
      const preview = document.getElementById("messageMediaPreview");
      if (preview) preview.style.display = "none";
    }

    if (isScheduled) await loadScheduledJobs();
    else await loadHistory();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    const btn = document.getElementById("sendMessageBtn");
    btn.disabled = false;
    btn.textContent = isScheduled
      ? "📅 Schedule Message"
      : "🚀 Send Message Now";
  }
}

export async function loadScheduledJobs() {
  try {
    const jobs = await api.get("/messages/scheduled");
    renderScheduledJobs(jobs);
    updateDashboardScheduledCount(jobs.length);
  } catch (error) {
    console.error("Failed to load scheduled jobs:", error);
  }
}

function updateDashboardScheduledCount(count) {
  const badge = document.getElementById("scheduledMessages");
  if (badge) badge.textContent = count;
}

function renderScheduledJobs(jobs) {
  const list = document.getElementById("scheduledList");
  if (!list) return;

  if (jobs.length === 0) {
    list.innerHTML =
      '<div class="empty-state"><p>No messages scheduled</p></div>';
    return;
  }

  list.innerHTML = jobs
    .map(
      (job) => `
    <div class="scheduled-card">
        <div class="scheduled-info">
            <p class="message-preview">${job.text.substring(0, 100)}${job.text.length > 100 ? "..." : ""}</p>
            <div class="scheduled-meta">
                <span>📅 ${formatDate(job.scheduled_at)}</span>
                <span>🎯 ${job.is_bulk ? "Bulk: " + job.permission_type : job.group_count + " groups"}</span>
            </div>
        </div>
        <div class="scheduled-actions">
            <button class="btn btn-outline-danger btn-sm" onclick="cancelJob(${job.id})">Cancel</button>
        </div>
    </div>
  `,
    )
    .join("");
}

window.cancelJob = async (id) => {
  if (!confirm("Are you sure you want to cancel this scheduled message?"))
    return;
  try {
    await api.delete(`/messages/scheduled/${id}`);
    showToast("Message cancelled", "success");
    await loadScheduledJobs();
  } catch (error) {
    showToast(error.message, "error");
  }
};

async function loadHistory() {
  try {
    const history = await api.get("/messages/history");
    renderHistory(history);
  } catch (error) {
    console.error("Failed to load history:", error);
  }
}

function renderHistory(history) {
  const list = document.getElementById("historyList");
  if (!list) return;

  if (history.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No message history</p></div>';
    return;
  }

  list.innerHTML = history
    .map(
      (item) => `
    <div class="history-item ${item.status}">
        <div class="history-main">
            <p class="history-text">${item.text.substring(0, 150)}${item.text.length > 150 ? "..." : ""}</p>
            <div class="history-meta">
                <span>${formatDate(item.created_at)}</span>
                <span>Group: ${item.group_title}</span>
            </div>
        </div>
        <div class="history-status">
            <span class="status-badge ${item.status}">${item.status}</span>
            ${item.error_message ? `<p class="error-text">${item.error_message}</p>` : ""}
        </div>
    </div>
  `,
    )
    .join("");
}
