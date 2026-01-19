import { api } from "./app.js";
import { showToast, confirmAction } from "./ui-components.js";

let messageHistory = [];
let filteredHistory = [];

// Load message history
export async function loadMessageHistory() {
  try {
    messageHistory = await api.get("/messages/history?limit=100");
    filteredHistory = [...messageHistory];
    renderHistory();
  } catch (error) {
    console.error("Error loading message history:", error);
    document.getElementById("historyList").innerHTML =
      '<p class="text-secondary">Failed to load history</p>';
  }
}

// Render history list
function renderHistory() {
  const historyList = document.getElementById("historyList");

  if (filteredHistory.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <p class="empty-state-text">No message history</p>
        <p class="empty-state-subtext">Your sent messages will appear here.</p>
      </div>`;
    return;
  }

  historyList.innerHTML = filteredHistory
    .map(
      (msg) => `
        <div class="history-item">
            <div class="history-icon ${msg.status.toLowerCase() === "sent" ? "sent" : "failed"}">
                ${msg.status.toLowerCase() === "sent" ? "✓" : "!"}
            </div>
            <div class="history-content">
                <div class="history-text" title="${msg.text || "(Media Message)"}">
                    ${truncateText(msg.text || "(Media Message)", 150)}
                </div>
                <div class="history-meta">
                    <span>📅 ${formatDate(msg.created_at)}</span>
                    <span>•</span>
                    <span>👥 ${msg.group_count || 0} groups</span>
                    ${msg.link ? "<span>•</span><span>🔗 Has link</span>" : ""}
                    ${msg.media_id ? "<span>•</span><span>🖼️ Has media</span>" : ""}
                </div>
            </div>
            <div class="history-actions">
                 ${
                   msg.status === "FAILED"
                     ? `<button class="btn btn-secondary btn-sm" onclick="retryMessage(${msg.id})">🔄 Retry</button>`
                     : ""
                 }
                 <button class="btn btn-secondary btn-sm" onclick="alert('View details feature coming soon!')">
                    🔍 Details
                 </button>
            </div>
        </div>
  `,
    )
    .join("");
}

// Filter history
function filterHistory(searchTerm, statusFilter) {
  filteredHistory = messageHistory.filter((msg) => {
    const matchesSearch =
      !searchTerm || msg.text.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      msg.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  renderHistory();
}

// Retry failed message
export async function retryMessage(messageId) {
  const confirmed = await confirmAction(
    "Retry sending this message to all failed groups?",
    { title: "Retry Message", confirmText: "Retry" },
  );

  if (!confirmed) return;

  try {
    // Get the message details
    const message = messageHistory.find((m) => m.id === messageId);
    if (!message) {
      showToast("Message not found", "error");
      return;
    }

    // Resend using the send endpoint
    const response = await api.post("/messages/send", {
      text: message.text,
      link: message.link,
      media_id: message.media_id,
      target_groups: message.target_groups,
    });

    showToast(
      `Retry complete! Sent: ${response.sent_count}, Failed: ${response.failed_count}`,
      "success",
    );

    // Reload history
    await loadMessageHistory();
  } catch (error) {
    showToast("Failed to retry message: " + error.message, "error");
  }
}

// Export to CSV
function exportToCSV() {
  if (filteredHistory.length === 0) {
    showToast("No messages to export", "warning");
    return;
  }

  // CSV headers
  const headers = ["Date", "Status", "Text", "Link", "Groups", "Has Media"];

  // CSV rows
  const rows = filteredHistory.map((msg) => [
    formatDate(msg.created_at),
    msg.status,
    `"${msg.text.replace(/"/g, '""')}"`, // Escape quotes
    msg.link || "",
    msg.group_count || 0,
    msg.media_id ? "Yes" : "No",
  ]);

  // Combine
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n",
  );

  // Download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `message-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast("History exported successfully", "success");
}

// Setup history tab
export function setupMessageHistory() {
  // Tab switching
  // Tab switching is handled globally in ui-components.js
  // We only need to listen for the specific tab activation if needed
  // But global handler toggles display:block based on ID
  // The global handler does NOT call loadMessageHistory() automatically though
  // So we need to hook into the tab switch for 'history' specific logic

  const historyTabBtn = document.querySelector('.tab-btn[data-tab="history"]');
  if (historyTabBtn) {
    historyTabBtn.addEventListener("click", () => {
      loadMessageHistory();
    });
  }

  // Search
  const searchInput = document.getElementById("historySearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const statusFilter = document.getElementById("historyFilter").value;
      filterHistory(e.target.value, statusFilter);
    });
  }

  // Filter
  const filterSelect = document.getElementById("historyFilter");
  if (filterSelect) {
    filterSelect.addEventListener("change", (e) => {
      const searchTerm = document.getElementById("historySearch").value;
      filterHistory(searchTerm, e.target.value);
    });
  }

  // Export
  const exportBtn = document.getElementById("exportHistoryBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportToCSV);
  }
}

// Helper functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Make retryMessage globally available
window.retryMessage = retryMessage;
