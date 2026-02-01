import { api } from "./api.js";
import { showToast, confirmAction, showCustomModal } from "./ui-components.js";
import { formatDate, capitalize } from "./utils.js";
import { progressWidget } from "./progress-widget.js";

let messageHistory = [];
let currentPage = 1;
let totalPages = 1;
let isPageLoading = false;
let currentFilters = {
  q: "",
  status: "",
  limit: 20,
};

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

  const previewBtn = document.getElementById("previewMessageBtn");

  if (sendMessageBtn)
    sendMessageBtn.addEventListener("click", handleSendMessage);

  if (previewBtn) {
    previewBtn.addEventListener("click", handlePreview);
  }

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

  // Recurrence logic
  const recurrenceTypeSelect = document.getElementById("recurrenceType");
  const recurrenceCustomGroup = document.getElementById("recurrenceCustomGroup");
  const recurrenceEndGroup = document.getElementById("recurrenceEndGroup");

  if (recurrenceTypeSelect) {
    recurrenceTypeSelect.addEventListener("change", (e) => {
      const type = e.target.value;
      if (recurrenceCustomGroup) {
        recurrenceCustomGroup.style.display = type === "custom" ? "block" : "none";
      }
      if (recurrenceEndGroup) {
        recurrenceEndGroup.style.display = type !== "once" ? "block" : "none";
      }
    });
  }

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
  loadHistory(1, false);
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

    if (isScheduled) {
      payload.scheduled_at = new Date(scheduleTime).toISOString();

      const recurrenceType = document.getElementById("recurrenceType").value;
      payload.recurrence_type = recurrenceType;

      if (recurrenceType === "custom") {
        const interval = parseInt(document.getElementById("recurrenceInterval").value);
        if (!interval || interval < 1) {
          showToast("Please enter a valid recurrence interval (minutes)", "error");
          btn.disabled = false;
          btn.textContent = "📅 Schedule Message";
          return;
        }
        payload.recurrence_interval = interval;
      }

      const endDate = document.getElementById("recurrenceEndDate").value;
      if (endDate) {
        payload.recurrence_end_date = new Date(endDate).toISOString();
      }
    }

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

      // Hide discard button if visible
      const discardBtn = document.getElementById("discardDraftBtn");
      if (discardBtn) discardBtn.style.display = "none";
    }

    if (isScheduled) await loadScheduledJobs();
    else {
      // Reload history from scratch after new send
      await loadHistory(1, false);
    }
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
        <span>${job.recurrence_type && job.recurrence_type !== 'once' ? '🔁 ' + capitalize(job.recurrence_type) : ''}</span>
        <span>🎯 ${job.is_bulk ? "Bulk: " + job.permission_type : (job.target_groups ? job.target_groups.length : 0) + " groups"}</span>
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

async function loadHistory(page = 1, append = false) {
  if (isPageLoading) return;
  isPageLoading = true;

  try {
    const params = new URLSearchParams({
      page: page,
      limit: currentFilters.limit,
    });
    // Currently backend "get_message_history" does not support filtering by query/status
    // in the API logic we just added (it justpaginates *all* history).
    // So front-end filters won't work perfectly server-side yet.
    // We will rely on loading and filtering client-side or accepting that simple history is time-based.
    // For now, removing complex client-side filter logic in favor of paginated data.

    const response = await api.get(`/messages/history?${params.toString()}`);

    const items = response.items || [];
    currentPage = response.page;
    totalPages = response.pages;

    if (append) {
      messageHistory = [...messageHistory, ...items];
    } else {
      messageHistory = items;
    }

    renderHistory(items, append);
    renderLoadMore();
  } catch (error) {
    console.error("Failed to load history:", error);
    if (!append) {
      document.getElementById("historyList").innerHTML =
        '<div class="empty-state"><p>Failed to load history</p></div>';
    }
  } finally {
    isPageLoading = false;
  }
}

function renderLoadMore() {
  let container = document.getElementById("historyLoadMore");
  if (!container) {
    container = document.createElement("div");
    container.id = "historyLoadMore";
    container.className = "load-more-container mt-4 text-center pb-3";
    document.getElementById("historyList")?.after(container);
  }

  if (currentPage >= totalPages || totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
        <button id="loadMoreHistoryBtn" class="btn btn-secondary shadow-sm">
            <span class="btn-text">Load Older Messages</span>
            <div class="spinner-sm hidden" style="margin-left:8px;"></div>
        </button>
    `;

  const btn = document.getElementById("loadMoreHistoryBtn");
  btn.onclick = async () => {
    btn.disabled = true;
    btn.querySelector(".spinner-sm").classList.remove("hidden");
    await loadHistory(currentPage + 1, true);
  };
}

function renderHistory(items, append = false) {
  const list = document.getElementById("historyList");
  if (!list) return;

  if (!append) {
    list.innerHTML = "";
  }

  if (items.length === 0 && !append) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <p class="empty-state-text">No message history</p>
        <p class="empty-state-subtext">Your sent messages will appear here.</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((msg, index) => {
    const item = document.createElement("div");
    item.className = `history-item ${msg.status.toLowerCase()}`;
    item.style.animationDelay = `${index * 0.05}s`;

    // Simple text search filter on client side if needed,
    // but better to omit if pagination is active to avoid confusion.

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

    // Use safe accessors for group counts if not available
    const gCount =
      msg.group_count || (msg.target_groups ? msg.target_groups.length : 0);

    let metaHtml = `<span>📅 ${formatDate(msg.created_at)}</span>
    <span>•</span>
    <span>👥 ${gCount} groups</span>`;

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

function setupHistoryListeners() {
  const historyTabBtn = document.querySelector('.tab-btn[data-tab="history"]');
  if (historyTabBtn) {
    historyTabBtn.addEventListener("click", () => loadHistory(1, false));
  }

  // Client side filtering is temporarily disabled or needs to be server-side
  // For now we remove the listeners that filtered the local array to avoid conflict with pagination
  /*
  const searchInput = document.getElementById("historySearch");
  if (searchInput) searchInput.addEventListener("input", filterHistory);
  */

  const exportBtn = document.getElementById("exportHistoryBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportToCSV);
}

function exportToCSV() {
  // Note: This only exports loaded messages
  if (messageHistory.length === 0) {
    showToast("No messages loaded to export", "warning");
    return;
  }

  const headers = ["Date", "Status", "Text", "Link", "Groups", "Has Media"];
  const rows = messageHistory.map((msg) => [
    formatDate(msg.created_at),
    msg.status,
    `"${(msg.text || "").replace(/"/g, '""')}"`,
    msg.link || "",
    msg.group_count || msg.target_groups?.length || 0,
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
    if (!message) throw new Error("Message not found or not loaded");

    await api.post("/messages/send", {
      text: message.text,
      link: message.link,
      media_id: message.media_id,
      target_groups: message.target_groups || [],
    });

    showToast("Retry started!", "success");
    await loadHistory(1, false);
  } catch (error) {
    showToast("Failed to retry: " + error.message, "error");
  }
};

/**
 * Handle Preview Button Click
 * Simulates Telegram message appearance
 */
function handlePreview() {
  const text = document.getElementById("messageText").value;
  const link = document.getElementById("messageLink").value;
  const mediaPreviewImg = document.getElementById("messageMediaPreview").querySelector("img");
  const hasMedia = mediaPreviewImg && mediaPreviewImg.src && document.getElementById("messageMediaPreview").style.display !== "none";

  if (!text && !link && !hasMedia) {
    showToast("Enter some content to preview", "info");
    return;
  }

  // Telegram-style Preview HTML
  let contentHtml = `
    <div style="background: #e4e4e4; padding: 20px; border-radius: 8px; font-family: 'Inter', sans-serif;">
       <div style="max-width: 350px; background: white; border-radius: 12px 12px 12px 0; padding: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin: 0 auto; overflow: hidden;">
  `;

  // 1. Media
  if (hasMedia) {
    contentHtml += `
        <div style="width: 100%; height: 180px; overflow: hidden; background: #f0f0f0;">
           <img src="${mediaPreviewImg.src}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
        </div>
      `;
  }

  // 2. Text (with highlighting variables)
  if (text) {
    // Highlight variables
    let formattedText = text
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>")
      .replace(/(\{group_name\}|\{date\}|\{time\})/g, '<span style="color: #6366f1; background: #eef2ff; border-radius: 3px; padding: 0 2px;">$1</span>');

    contentHtml += `
         <div style="padding: 10px 14px; color: #000; font-size: 15px; line-height: 1.4;">
            ${formattedText}
         </div>
      `;
  }

  // 3. Link Preview (Placeholder)
  if (link) {
    contentHtml += `
         <div style="border-left: 3px solid #6366f1; background: #f8fafc; margin: 0 14px 10px 14px; padding: 8px 10px;">
             <div style="color: #6366f1; font-weight: 500; font-size: 13px;">${link}</div>
             <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">Link Title Mockup</div>
             <div style="font-size: 12px; color: #64748b; margin-top: 2px;">This is a simulated link preview card</div>
         </div>
      `;
  }

  // Footer (Time)
  contentHtml += `
         <div style="padding: 0 14px 8px 14px; text-align: right;">
             <span style="font-size: 11px; color: #94a3b8;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
         </div>
       </div>
       <div style="text-align: center; margin-top: 15px; color: #64748b; font-size: 12px;">
          Note: This is an approximation. Actual rendering depends on Telegram clients.
       </div>
    </div>
  `;

  showCustomModal("Telegram Preview", contentHtml, [{ id: "close", text: "Close", class: "btn-primary" }]);
}
