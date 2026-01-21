import { api } from "./api.js";
import { showToast, confirmAction } from "./ui-components.js";
import { formatDate } from "./utils.js";
import { progressWidget } from "./progress-widget.js";

let messageHistory = [];
let filteredHistory = [];

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

  // Setup list delegation
  const scheduledList = document.getElementById("scheduledList");
  if (scheduledList) {
    scheduledList.addEventListener("click", (e) => {
      const btn = e.target.closest(".cancel-job-btn");
      if (btn) {
        cancelJob(parseInt(btn.dataset.id));
      }
    });
  }

  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.addEventListener("click", (e) => {
      const btn = e.target.closest(".retry-message-btn");
      if (btn) {
        retryMessage(parseInt(btn.dataset.id));
      }
    });
  }

  // Setup History Listeners
  setupHistoryListeners();

  // Initial load
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
      payload.target_groups = selectedGroups;
      endpoint = isScheduled ? "/messages/schedule" : "/messages/send";
    }

    const response = await api.post(endpoint, payload);
    showToast(
      isScheduled ? "Message scheduled!" : "Message sending started!",
      "success",
    );

    if (!isScheduled && response && response.message_id) {
      progressWidget.startTracking(response.message_id);
    }

    if (!isScheduled) {
      document.getElementById("messageText").value = "";
      document.getElementById("messageLink").value = "";
      document.getElementById("messageMedia").value = "";
      const preview = document.getElementById("messageMediaPreview");
      if (preview) preview.style.display = "none";

      const selectBtn = document.getElementById("selectMessageMedia");
      if (selectBtn) selectBtn.textContent = "🖼️ Select Image";
      const clearBtn = document.getElementById("clearMessageMedia");
      if (clearBtn) clearBtn.style.display = "none";
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

// --- Scheduled Jobs ---

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

  // Clear list safely
  list.innerHTML = "";
  const fragment = document.createDocumentFragment();

  jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "scheduled-card";

    // Create text preview safely
    const previewText =
      job.text.substring(0, 100) + (job.text.length > 100 ? "..." : "");
    const infoDiv = document.createElement("div");
    infoDiv.className = "scheduled-info";

    const p = document.createElement("p");
    p.className = "message-preview";
    p.textContent = previewText;

    const meta = document.createElement("div");
    meta.className = "scheduled-meta";
    meta.innerHTML = `
        <span>📅 ${formatDate(job.scheduled_at)}</span>
        <span>🎯 ${job.is_bulk ? "Bulk: " + job.permission_type : job.group_count + " groups"}</span>
    `;

    infoDiv.appendChild(p);
    infoDiv.appendChild(meta);

    // Actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "scheduled-actions";

    const btn = document.createElement("button");
    btn.className = "btn btn-outline-danger btn-sm cancel-job-btn";
    btn.dataset.id = job.id;
    btn.textContent = "Cancel";

    actionsDiv.appendChild(btn);

    card.appendChild(infoDiv);
    card.appendChild(actionsDiv);
    fragment.appendChild(card);
  });

  list.appendChild(fragment);
}

const cancelJob = async (id) => {
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

// --- Message History ---

async function loadHistory() {
  try {
    messageHistory = await api.get("/messages/history?limit=100");
    filteredHistory = [...messageHistory];
    renderHistory();
  } catch (error) {
    console.error("Failed to load history:", error);
    const list = document.getElementById("historyList");
    if (list)
      list.innerHTML =
        '<div class="empty-state"><p>Failed to load history</p></div>';
  }
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;

  if (filteredHistory.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <p class="empty-state-text">No message history</p>
        <p class="empty-state-subtext">Your sent messages will appear here.</p>
      </div>`;
    return;
  }

  list.innerHTML = "";
  const fragment = document.createDocumentFragment();

  filteredHistory.forEach((msg) => {
    const item = document.createElement("div");
    item.className = `history-item ${msg.status.toLowerCase()}`;

    const mainDiv = document.createElement("div");
    mainDiv.className = "history-main";

    const textP = document.createElement("p");
    textP.className = "history-text";
    textP.title = msg.text || "(Media Message)";
    textP.textContent = msg.text
      ? msg.text.substring(0, 150) + (msg.text.length > 150 ? "..." : "")
      : "(Media Message)";

    const metaDiv = document.createElement("div");
    metaDiv.className = "history-meta";

    let metaHtml = `<span>📅 ${formatDate(msg.created_at)}</span>
    <span>•</span>
    <span>👥 ${msg.group_count || 1} groups</span>`;

    if (msg.link) metaHtml += "<span>•</span><span>🔗 Has link</span>";
    if (msg.media_id) metaHtml += "<span>•</span><span>🖼️ Has media</span>";

    metaDiv.innerHTML = metaHtml;

    mainDiv.appendChild(textP);
    mainDiv.appendChild(metaDiv);

    const statusDiv = document.createElement("div");
    statusDiv.className = "history-status";

    const badge = document.createElement("span");
    badge.className = `status-badge ${msg.status.toLowerCase()}`;
    badge.textContent = msg.status;

    statusDiv.appendChild(badge);

    if (msg.status.toLowerCase() === "failed") {
      const retryBtn = document.createElement("button");
      retryBtn.className =
        "btn btn-outline-primary btn-sm mt-1 retry-message-btn";
      retryBtn.dataset.id = msg.id;
      retryBtn.innerHTML = "🔄 Retry";
      statusDiv.appendChild(retryBtn);
    }

    if (msg.error_message) {
      const errP = document.createElement("p");
      errP.className = "error-text";
      errP.textContent = msg.error_message;
      statusDiv.appendChild(errP);
    }

    item.appendChild(mainDiv);
    item.appendChild(statusDiv);
    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

function filterHistory() {
  const searchTerm = document
    .getElementById("historySearch")
    ?.value.toLowerCase();
  const statusFilter = document.getElementById("historyFilter")?.value;

  filteredHistory = messageHistory.filter((msg) => {
    const text = msg.text || "";
    const matchesSearch =
      !searchTerm || text.toLowerCase().includes(searchTerm);
    const matchesStatus =
      !statusFilter ||
      statusFilter === "all" ||
      msg.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  renderHistory();
}

function setupHistoryListeners() {
  const historyTabBtn = document.querySelector('.tab-btn[data-tab="history"]');
  if (historyTabBtn) {
    historyTabBtn.addEventListener("click", () => loadHistory());
  }

  const searchInput = document.getElementById("historySearch");
  if (searchInput) searchInput.addEventListener("input", filterHistory);

  const filterSelect = document.getElementById("historyFilter");
  if (filterSelect) filterSelect.addEventListener("change", filterHistory);

  const exportBtn = document.getElementById("exportHistoryBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportToCSV);
}

function exportToCSV() {
  if (filteredHistory.length === 0) {
    showToast("No messages to export", "warning");
    return;
  }

  const headers = ["Date", "Status", "Text", "Link", "Groups", "Has Media"];
  const rows = filteredHistory.map((msg) => [
    formatDate(msg.created_at),
    msg.status,
    `"${(msg.text || "").replace(/"/g, '""')}"`,
    msg.link || "",
    msg.group_count || 1,
    msg.media_id ? "Yes" : "No",
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n",
  );
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.id = "csv-download-link";
  a.href = url;
  a.download = `message-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("History exported successfully", "success");
}

const retryMessage = async (messageId) => {
  const confirmed = await confirmAction(
    "Retry sending this message to groups?",
    { title: "Retry Message", confirmText: "Retry" },
  );
  if (!confirmed) return;

  try {
    const message = messageHistory.find((m) => m.id === messageId);
    if (!message) throw new Error("Message not found");

    await api.post("/messages/send", {
      text: message.text,
      link: message.link,
      media_id: message.media_id,
      target_groups: message.target_groups || [],
    });

    showToast("Retry started!", "success");
    await loadHistory();
  } catch (error) {
    showToast("Failed to retry: " + error.message, "error");
  }
};
