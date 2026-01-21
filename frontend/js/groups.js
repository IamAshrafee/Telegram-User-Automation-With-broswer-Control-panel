import { api } from "./api.js";
import { showToast } from "./ui-components.js";
import { formatDate } from "./utils.js";

let allGroups = [];

export function setupGroups() {
  const syncGroupsBtn = document.getElementById("syncGroupsBtn");
  const groupSearch = document.getElementById("groupSearch");
  const sortBy = document.getElementById("sortBy");
  const permissionFilter = document.getElementById("permissionFilter");
  const activeOnlyFilter = document.getElementById("activeOnlyFilter");
  const selectAllGroups = document.getElementById("selectAllGroups");

  if (syncGroupsBtn) {
    syncGroupsBtn.addEventListener("click", async () => {
      try {
        syncGroupsBtn.disabled = true;
        syncGroupsBtn.textContent = "Syncing...";
        const response = await api.post("/groups/sync");
        showToast(
          `Synced ${response.synced_count} groups successfully!`,
          "success",
        );
        await loadGroups();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        syncGroupsBtn.disabled = false;
        syncGroupsBtn.innerHTML = "🔄 Sync from Telegram";
      }
    });
  }

  // Search and filters
  if (groupSearch)
    groupSearch.addEventListener("input", () => renderGroups(allGroups));
  if (sortBy) sortBy.addEventListener("change", () => renderGroups(allGroups));
  if (permissionFilter)
    permissionFilter.addEventListener("change", () => renderGroups(allGroups));
  if (activeOnlyFilter)
    activeOnlyFilter.addEventListener("change", () => renderGroups(allGroups));

  // Bulk selectors
  if (selectAllGroups) {
    selectAllGroups.addEventListener("change", (e) => {
      const checkboxes = document.querySelectorAll(".group-checkbox");
      checkboxes.forEach((cb) => (cb.checked = e.target.checked));
      updateSelectedCount();
    });
  }

  // Bulk actions
  const bulkActivateBtn = document.getElementById("bulkActivateBtn");
  const bulkDeactivateBtn = document.getElementById("bulkDeactivateBtn");
  const bulkPermission = document.getElementById("bulkPermission");

  if (bulkActivateBtn) {
    bulkActivateBtn.addEventListener("click", () =>
      handleBulkAction("activate"),
    );
  }
  if (bulkDeactivateBtn) {
    bulkDeactivateBtn.addEventListener("click", () =>
      handleBulkAction("deactivate"),
    );
  }
  if (bulkPermission) {
    bulkPermission.addEventListener("change", (e) => {
      if (e.target.value) handleBulkAction("permission", e.target.value);
    });
  }

  // Analytics Toggle
  const toggleAnalyticsBtn = document.getElementById("toggleAnalyticsBtn");
  const analyticsSection = document.getElementById("groupAnalytics");

  if (toggleAnalyticsBtn && analyticsSection) {
    toggleAnalyticsBtn.addEventListener("click", () => {
      const isHidden = analyticsSection.style.display === "none";
      analyticsSection.style.display = isHidden ? "block" : "none";
      toggleAnalyticsBtn.textContent = isHidden
        ? "📊 Hide Analytics"
        : "📊 Show Analytics";
      if (isHidden) updateAnalytics();
    });
  }

  const refreshAnalyticsBtn = document.getElementById("refreshAnalyticsBtn");
  if (refreshAnalyticsBtn)
    refreshAnalyticsBtn.addEventListener("click", updateAnalytics);
}

export async function loadGroups() {
  try {
    allGroups = await api.get("/groups/");
    renderGroups(allGroups);
    updateDashboardStats(allGroups);
    // Also update the selectors in the composer tab
    renderGroupSelectors();
  } catch (error) {
    console.error("Failed to load groups:", error);
    showToast("Failed to load groups library", "error");
  }
}

function updateDashboardStats(groups) {
  const totalGroups = document.getElementById("totalGroups");
  const activeGroupsCount = document.getElementById("activeGroups");
  if (totalGroups) totalGroups.textContent = groups.length;
  if (activeGroupsCount)
    activeGroupsCount.textContent = groups.filter((g) => g.is_active).length;
}

function renderGroups(groups) {
  const groupsList = document.getElementById("groupsList");
  if (!groupsList) return;

  const searchTerm = document
    .getElementById("groupSearch")
    ?.value.toLowerCase();
  const sort = document.getElementById("sortBy")?.value;
  const permission = document.getElementById("permissionFilter")?.value;
  const activeOnly = document.getElementById("activeOnlyFilter")?.checked;

  let filtered = [...groups];
  if (searchTerm)
    filtered = filtered.filter((g) =>
      g.title.toLowerCase().includes(searchTerm),
    );
  if (permission)
    filtered = filtered.filter((g) => g.permission_type === permission);
  if (activeOnly) filtered = filtered.filter((g) => g.is_active);

  if (sort === "title-asc")
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "title-desc")
    filtered.sort((a, b) => b.title.localeCompare(a.title));
  else if (sort === "created_at-desc")
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === "created_at-asc")
    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (filtered.length === 0) {
    groupsList.innerHTML =
      '<div class="empty-state"><p>No groups found.</p></div>';
    return;
  }

  groupsList.innerHTML = filtered
    .map(
      (group) => `
    <div class="group-card ${group.is_active ? "active" : ""}">
        <div class="group-header">
            <div class="d-flex align-items-center">
                <input type="checkbox" class="group-checkbox" data-id="${group.id}" onclick="event.stopPropagation()">
                <h3 class="ml-2">${group.title}</h3>
            </div>
            <div class="group-status">
                <label class="switch">
                    <input type="checkbox" ${group.is_active ? "checked" : ""} onchange="toggleGroup(${group.id}, this.checked)">
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
        <div class="group-details">
            <p><strong>Username:</strong> ${group.username || "N/A"}</p>
            <p><strong>Level:</strong> ${group.permission_type}</p>
            <p><strong>Added:</strong> ${formatDate(group.created_at)}</p>
            <div class="group-stats-strip mt-2">
                <span>💬 ${group.total_messages || 0}</span>
                <span>✅ ${group.success_count || 0}</span>
            </div>
        </div>
        <div class="group-actions">
            <select class="form-control form-control-sm" onchange="updatePermission(${group.id}, this.value)">
                <option value="all" ${group.permission_type === "all" ? "selected" : ""}>All Content</option>
                <option value="text_only" ${group.permission_type === "text_only" ? "selected" : ""}>Text Only</option>
                <option value="text_link" ${group.permission_type === "text_link" ? "selected" : ""}>Text + Link</option>
                <option value="text_image" ${group.permission_type === "text_image" ? "selected" : ""}>Text + Image</option>
                <option value="text_link_image" ${group.permission_type === "text_link_image" ? "selected" : ""}>Text + Link + Image</option>
            </select>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteGroup(${group.id})">Delete</button>
        </div>
    </div>
  `,
    )
    .join("");

  const checkboxes = document.querySelectorAll(".group-checkbox");
  checkboxes.forEach((cb) =>
    cb.addEventListener("change", updateSelectedCount),
  );
}

function updateSelectedCount() {
  const selected = document.querySelectorAll(".group-checkbox:checked").length;
  const badge = document.getElementById("selectedCount");
  const dropdown = document.getElementById("bulkActionsDropdown");
  if (badge) badge.textContent = selected;
  if (dropdown) dropdown.style.display = selected > 0 ? "flex" : "none";
}

async function handleBulkAction(action, value = null) {
  const selectedIds = Array.from(
    document.querySelectorAll(".group-checkbox:checked"),
  ).map((cb) => parseInt(cb.dataset.id));
  if (selectedIds.length === 0) return;

  try {
    const payload = {
      group_ids: selectedIds,
      update_data: {},
    };

    if (action === "activate") payload.update_data.is_active = true;
    else if (action === "deactivate") payload.update_data.is_active = false;
    else if (action === "permission")
      payload.update_data.permission_type = value;

    await api.post("/groups/bulk-update", payload);
    showToast(`Bulk ${action} successful!`, "success");
    await loadGroups();
    const selectAll = document.getElementById("selectAllGroups");
    if (selectAll) selectAll.checked = false;
  } catch (error) {
    showToast(error.message, "error");
  }
}

window.toggleGroup = async (id, isActive) => {
  try {
    await api.patch(`/groups/${id}`, { is_active: isActive });
  } catch (error) {
    showToast(error.message, "error");
    await loadGroups();
  }
};

window.updatePermission = async (id, type) => {
  try {
    await api.patch(`/groups/${id}`, { permission_type: type });
    showToast("Permission updated", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
};

window.deleteGroup = async (id) => {
  if (!confirm("Are you sure you want to remove this group?")) return;
  try {
    await api.delete(`/groups/${id}`);
    showToast("Group removed", "success");
    await loadGroups();
  } catch (error) {
    showToast(error.message, "error");
  }
};

async function updateAnalytics() {
  try {
    const analytics = await api.get("/groups/analytics");
    renderAnalytics(analytics);
  } catch (error) {
    console.error("Failed to load analytics:", error);
  }
}

function renderAnalytics(data) {
  const totalSpan = document.getElementById("analyticsTotalMessages");
  const rateSpan = document.getElementById("analyticsSuccessRate");
  const failedSpan = document.getElementById("analyticsFailed");
  if (totalSpan) totalSpan.textContent = data.total_messages;
  if (rateSpan)
    rateSpan.textContent = `${Math.round(data.success_rate * 100)}%`;
  if (failedSpan) failedSpan.textContent = data.failed_messages;
  renderRankedList("topGroupsList", data.top_performing, "success_rate", "%");
  renderRankedList("problemGroupsList", data.need_attention, "failed_count");
  renderRankedList(
    "inactiveGroupsList",
    data.inactive_groups,
    "days_inactive",
    "d",
  );
}

function renderRankedList(id, items, valueKey, unit = "") {
  const container = document.getElementById(id);
  if (!container) return;
  if (items.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted">No data available</p>';
    return;
  }
  container.innerHTML = items
    .map((item) => {
      let val = item[valueKey];
      if (unit === "%") val = Math.round(val * 100);
      return `<div class="ranked-item"><span class="ranked-title">${item.title}</span><span class="ranked-value">${val}${unit}</span></div>`;
    })
    .join("");
}

export function renderGroupSelectors() {
  const selector = document.getElementById("groupSelector");
  if (!selector) return;
  if (allGroups.length === 0) {
    selector.innerHTML = '<p class="text-muted">No groups available</p>';
    return;
  }
  selector.innerHTML = allGroups
    .filter((g) => g.is_active)
    .map(
      (group) => `
    <label class="group-select-item">
        <input type="checkbox" name="target_groups" value="${group.id}">
        <span>${group.title}</span>
        <small>${group.permission_type}</small>
    </label>
  `,
    )
    .join("");
}
