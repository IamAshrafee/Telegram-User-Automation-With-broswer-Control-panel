import { api } from "./app.js";
import { showToast, confirmAction, setButtonLoading } from "./ui-components.js";

let allGroups = [];
let selectedGroupIds = new Set();

export async function loadGroups() {
  try {
    allGroups = await api.get("/groups/");

    // Auto-sync if no groups exist
    if (allGroups.length === 0) {
      await syncGroupsFromTelegram();
      return;
    }

    renderGroups();
    renderGroupSelectors();
    updateDashboardStats();
  } catch (error) {
    console.error("Error loading groups:", error);
  }
}

async function syncGroupsFromTelegram() {
  try {
    const result = await api.post("/groups/sync", {});
    await loadGroups();
  } catch (error) {
    console.error("Error syncing groups:", error);
  }
}

function renderGroups() {
  const groupsList = document.getElementById("groupsList");
  const permissionFilter = document.getElementById("permissionFilter").value;
  const activeOnly = document.getElementById("activeOnlyFilter").checked;
  const searchQuery =
    document.getElementById("groupSearch")?.value.toLowerCase() || "";
  const sortBy = document.getElementById("sortBy")?.value || "title-asc";

  let filteredGroups = allGroups;

  // Search filter
  if (searchQuery) {
    filteredGroups = filteredGroups.filter((g) =>
      g.title.toLowerCase().includes(searchQuery),
    );
  }

  // Permission filter
  if (permissionFilter) {
    filteredGroups = filteredGroups.filter(
      (g) => g.permission_type === permissionFilter,
    );
  }

  // Active filter
  if (activeOnly) {
    filteredGroups = filteredGroups.filter((g) => g.is_active);
  }

  // Sorting
  const [sortField, sortOrder] = sortBy.split("-");
  filteredGroups.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "title") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (filteredGroups.length === 0) {
    groupsList.innerHTML = groupsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p class="empty-state-text">No groups found</p>
        <p class="empty-state-subtext">Click "Sync from Telegram" to fetch your groups.</p>
      </div>`;
    return;
  }

  groupsList.innerHTML = filteredGroups
    .map(
      (group) => `
        <div class="group-card">
            <div class="group-content" style="display: flex; flex-direction: column; gap: 10px">
            <div style="display: flex; align-items: center; gap: 10px">
                <div class="group-checkbox-wrapper">
                    <input 
                        type="checkbox" 
                        class="group-select-checkbox" 
                        data-group-id="${group.id}"
                        ${selectedGroupIds.has(group.id) ? "checked" : ""}
                    />
                </div>
                <div class="group-header" style="display: flex; justify-content: space-between; align-items: center; gap: 10px">
                    <h3 class="group-title">${group.title}</h3>
                </div></div>
                <div class="group-meta" style="display: flex; align-items: center; gap: 10px">
                <span class="group-status">
                        ${group.is_active ? "✅ Active" : "❌ Inactive"}
                    </span>
                    <span class="badge">${formatPermissionType(group.permission_type)}</span>
                </div>
                <div class="group-controls" style="display: flex; align-items: center; gap: 10px">
                    <select class="permission-select" data-group-id="${group.id}">
                        <option value="all" ${group.permission_type === "all" ? "selected" : ""}>All Content</option>
                        <option value="text_only" ${group.permission_type === "text_only" ? "selected" : ""}>Text Only</option>
                        <option value="text_link" ${group.permission_type === "text_link" ? "selected" : ""}>Text + Link</option>
                        <option value="text_image" ${group.permission_type === "text_image" ? "selected" : ""}>Text + Image</option>
                        <option value="text_link_image" ${group.permission_type === "text_link_image" ? "selected" : ""}>Text + Link + Image</option>
                    </select>
                    <button class="btn btn-secondary toggle-active" data-group-id="${group.id}" data-active="${group.is_active}">
                        ${group.is_active ? "Deactivate" : "Activate"}
                    </button>
                </div>
            </div>
        </div>
    `,
    )
    .join("");

  // Add event listeners for checkboxes
  document.querySelectorAll(".group-select-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const groupId = parseInt(e.target.dataset.groupId);
      if (e.target.checked) {
        selectedGroupIds.add(groupId);
      } else {
        selectedGroupIds.delete(groupId);
      }
      updateBulkActionsUI();
    });
  });

  // Add event listeners for permission selects
  document.querySelectorAll(".permission-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const groupId = e.target.dataset.groupId;
      const newPermission = e.target.value;
      await updateGroup(groupId, { permission_type: newPermission });
    });
  });

  // Add event listeners for toggle buttons
  document.querySelectorAll(".toggle-active").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const groupId = e.target.dataset.groupId;
      const isActive = e.target.dataset.active === "true";

      await handleGroupAction(btn, async () => {
        await updateGroup(groupId, { is_active: !isActive });
      });
    });
  });
}

async function updateGroup(groupId, data) {
  try {
    await api.patch(`/groups/${groupId}`, data);
    await loadGroups();
  } catch (error) {
    console.error("Error updating group:", error);
  }
}

function formatPermissionType(type) {
  const map = {
    all: "All Content",
    text_only: "Text Only",
    text_link: "Text + Link",
    text_image: "Text + Image",
    text_link_image: "Text + Link + Image",
  };
  return map[type] || type;
}

export function setupGroups() {
  const syncBtn = document.getElementById("syncGroupsBtn");
  const permissionFilter = document.getElementById("permissionFilter");
  const activeOnlyFilter = document.getElementById("activeOnlyFilter");
  const groupSearch = document.getElementById("groupSearch");
  const sortBy = document.getElementById("sortBy");
  const selectAllCheckbox = document.getElementById("selectAllGroups");
  const bulkPermission = document.getElementById("bulkPermission");
  const bulkActivateBtn = document.getElementById("bulkActivateBtn");
  const bulkDeactivateBtn = document.getElementById("bulkDeactivateBtn");

  // Sync button
  syncBtn.addEventListener("click", async () => {
    try {
      setButtonLoading(syncBtn, true, "Syncing...");
      const result = await api.post("/groups/sync");
      await loadGroups();
      showToast(
        `Synced successfully! Added: ${result.added}, Updated: ${result.updated}`,
        "success",
      );
    } catch (error) {
      showToast("Error syncing groups: " + error.message, "error");
    } finally {
      setButtonLoading(syncBtn, false);
    }
  });

  // Filters and search
  permissionFilter.addEventListener("change", renderGroups);
  activeOnlyFilter.addEventListener("change", renderGroups);

  // Search with debounce
  let searchTimeout;
  groupSearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(renderGroups, 300);
  });

  // Sort
  sortBy.addEventListener("change", renderGroups);

  // Select all
  selectAllCheckbox.addEventListener("change", (e) => {
    const checkboxes = document.querySelectorAll(".group-select-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = e.target.checked;
      const groupId = parseInt(checkbox.dataset.groupId);
      if (e.target.checked) {
        selectedGroupIds.add(groupId);
      } else {
        selectedGroupIds.delete(groupId);
      }
    });
    updateBulkActionsUI();
  });

  // Bulk permission change
  bulkPermission.addEventListener("change", async (e) => {
    if (selectedGroupIds.size === 0) return;
    const permission = e.target.value;
    if (!permission) return;

    const confirmed = await confirmAction(
      `Update permission to "${formatPermissionType(permission)}" for ${selectedGroupIds.size} selected groups?`,
      { title: "Update Permissions", confirmText: "Update" },
    );
    if (!confirmed) {
      e.target.value = ""; // Reset select if not confirmed
      return;
    }

    try {
      for (const groupId of selectedGroupIds) {
        await api.patch(`/groups/${groupId}`, {
          permission_type: permission,
        });
      }
      await loadGroups();
      showToast(`Updated ${selectedGroupIds.size} groups`, "success");
      selectedGroupIds.clear();
      e.target.value = ""; // Reset select after successful update
      updateBulkActionsUI();
    } catch (error) {
      showToast("Failed to update groups: " + error.message, "error");
    }
  });

  // Bulk activate
  bulkActivateBtn.addEventListener("click", async () => {
    if (selectedGroupIds.size === 0) return;

    const confirmed = await confirmAction(
      `Activate ${selectedGroupIds.size} selected groups?`,
      { title: "Activate Groups", confirmText: "Activate" },
    );
    if (!confirmed) return;

    try {
      for (const groupId of selectedGroupIds) {
        await api.patch(`/groups/${groupId}`, { is_active: true });
      }
      await loadGroups();
      showToast(`Activated ${selectedGroupIds.size} groups`, "success");
      selectedGroupIds.clear();
      updateBulkActionsUI();
    } catch (error) {
      showToast("Failed to activate groups: " + error.message, "error");
    }
  });

  // Bulk deactivate
  bulkDeactivateBtn.addEventListener("click", async () => {
    if (selectedGroupIds.size === 0) return;

    const confirmed = await confirmAction(
      `Deactivate ${selectedGroupIds.size} selected groups?`,
      { title: "Deactivate Groups", confirmText: "Deactivate" },
    );
    if (!confirmed) return;

    try {
      for (const groupId of selectedGroupIds) {
        await api.patch(`/groups/${groupId}`, { is_active: false });
      }
      await loadGroups();
      showToast(`Deactivated ${selectedGroupIds.size} groups`, "success");
      selectedGroupIds.clear();
      updateBulkActionsUI();
    } catch (error) {
      showToast("Failed to deactivate groups: " + error.message, "error");
    }
  });

  // Setup analytics
  setupAnalytics();
}

function updateBulkActionsUI() {
  const selectedCount = document.getElementById("selectedCount");
  const bulkActionsDropdown = document.getElementById("bulkActionsDropdown");
  const selectAllCheckbox = document.getElementById("selectAllGroups");

  selectedCount.textContent = selectedGroupIds.size; // Update the badge number only

  if (selectedGroupIds.size > 0) {
    bulkActionsDropdown.style.display = "flex";
  } else {
    bulkActionsDropdown.style.display = "none";
  }

  // Update select all checkbox state
  const totalCheckboxes = document.querySelectorAll(
    ".group-select-checkbox",
  ).length;
  selectAllCheckbox.checked =
    selectedGroupIds.size === totalCheckboxes && totalCheckboxes > 0;
  selectAllCheckbox.indeterminate =
    selectedGroupIds.size > 0 && selectedGroupIds.size < totalCheckboxes;
}

// Helper for loading states on group cards
async function handleGroupAction(btn, actionFn) {
  const originalText = btn.textContent;
  try {
    setButtonLoading(btn, true, "");
    await actionFn();
  } catch (e) {
    console.error(e);
    showToast("Action failed", "error");
  } finally {
    // We generally reload the list after actions, so the button might be gone.
    // If it persists (e.g. failure), reset it.
    if (document.body.contains(btn)) {
      setButtonLoading(btn, false);
      btn.textContent = originalText;
    }
  }
}

export function renderGroupSelectors() {
  const activeGroups = allGroups.filter((g) => g.is_active);

  if (activeGroups.length === 0) {
    const html =
      '<p class="text-secondary p-4">No active groups. Please sync groups first.</p>';
    document.getElementById("groupSelector").innerHTML = html;
    return;
  }

  const html = activeGroups
    .map(
      (group) => `
        <div class="group-checkbox" style="display: flex; align-items: center; gap: 10px">
            <input type="checkbox" id="group-${group.id}" value="${group.id}" class="group-check" />
            <label for="group-${group.id}">${group.title} <span class="text-muted text-sm">(${formatPermissionType(group.permission_type)})</span></label>
        </div>
    `,
    )
    .join("");

  document.getElementById("groupSelector").innerHTML = html;
}

function updateDashboardStats() {
  document.getElementById("totalGroups").textContent = allGroups.length;
  document.getElementById("activeGroups").textContent = allGroups.filter(
    (g) => g.is_active,
  ).length;
}

// Analytics Functions
async function loadAnalytics() {
  try {
    const analytics = await api.get("/groups/analytics");
    renderAnalytics(analytics);
  } catch (error) {
    console.error("Error loading analytics:", error);
  }
}

function renderAnalytics(analytics) {
  // Overview stats
  document.getElementById("analyticsTotalMessages").textContent =
    analytics.overview.total_messages_sent;
  document.getElementById("analyticsSuccessRate").textContent =
    `${analytics.overview.overall_success_rate}%`;
  document.getElementById("analyticsFailed").textContent =
    analytics.overview.total_messages_failed;

  // Top groups
  const topGroupsList = document.getElementById("topGroupsList");
  if (analytics.top_groups.length === 0) {
    topGroupsList.innerHTML =
      '<p class="empty-state">No data yet. Send some messages to see stats!</p>';
  } else {
    topGroupsList.innerHTML = analytics.top_groups
      .map(
        (group, index) => `
      <div class="analytics-item">
        <span class="rank">#${index + 1}</span>
        <span class="group-name">${group.title}</span>
        <span class="stat-badge">${group.messages_sent} messages</span>
        <span class="stat-badge success">${group.success_rate}% success</span>
      </div>
    `,
      )
      .join("");
  }

  // Problem groups
  const problemGroupsList = document.getElementById("problemGroupsList");
  if (analytics.problem_groups.length === 0) {
    problemGroupsList.innerHTML =
      '<p class="empty-state">✅ All groups performing well!</p>';
  } else {
    problemGroupsList.innerHTML = analytics.problem_groups
      .map(
        (group) => `
      <div class="analytics-item warning">
        <span class="group-name">${group.title}</span>
        <span class="stat-badge error">${group.success_rate}% success</span>
        <span class="stat-badge">${group.total_attempts} attempts</span>
      </div>
    `,
      )
      .join("");
  }

  // Inactive groups
  const inactiveGroupsList = document.getElementById("inactiveGroupsList");
  if (analytics.inactive_groups.length === 0) {
    inactiveGroupsList.innerHTML =
      '<p class="empty-state">✅ All groups recently active!</p>';
  } else {
    inactiveGroupsList.innerHTML = analytics.inactive_groups
      .map(
        (group) => `
      <div class="analytics-item">
        <span class="group-name">${group.title}</span>
        <span class="stat-badge muted">
          ${group.last_message_at ? "Last: " + new Date(group.last_message_at).toLocaleDateString() : "Never sent"}
        </span>
      </div>
    `,
      )
      .join("");
  }
}

function setupAnalytics() {
  const toggleBtn = document.getElementById("toggleAnalyticsBtn");
  const analyticsSection = document.getElementById("groupAnalytics");
  const groupsList = document.getElementById("groupsList");
  const refreshBtn = document.getElementById("refreshAnalyticsBtn");

  if (!toggleBtn) return; // Element not found

  let analyticsVisible = false;

  toggleBtn.addEventListener("click", async () => {
    analyticsVisible = !analyticsVisible;

    if (analyticsVisible) {
      analyticsSection.style.display = "block";
      groupsList.style.display = "none";
      toggleBtn.textContent = "📋 Show Groups List";
      await loadAnalytics();
    } else {
      analyticsSection.style.display = "none";
      groupsList.style.display = "block";
      toggleBtn.textContent = "📊 Show Analytics";
    }
  });

  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "🔄 Loading...";
    await loadAnalytics();
    refreshBtn.disabled = false;
    refreshBtn.textContent = "🔄 Refresh";
  });
}

function updateDashboardStats() {
  const total = allGroups.length;
  const active = allGroups.filter((g) => g.is_active).length;
  if (document.getElementById("totalGroups")) {
    document.getElementById("totalGroups").textContent = total;
  }
  if (document.getElementById("activeGroups")) {
    document.getElementById("activeGroups").textContent = active;
  }
}

export { allGroups };
