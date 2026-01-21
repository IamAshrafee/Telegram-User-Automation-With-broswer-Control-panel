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
  const groupsList = document.getElementById("groupsList");

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

  // --- Event Delegation for Groups List ---
  if (groupsList) {
    groupsList.addEventListener("change", (e) => {
      const target = e.target;
      // Toggle Group Status
      if (target.matches(".group-toggle-input")) {
        const id = parseInt(target.dataset.id);
        toggleGroup(id, target.checked);
      }
      // Update Permission
      if (target.matches(".permission-select")) {
        const id = parseInt(target.dataset.id);
        updatePermission(id, target.value);
      }
      // Bulk Checkbox
      if (target.matches(".group-checkbox")) {
        updateSelectedCount();
      }
    });

    groupsList.addEventListener("click", (e) => {
      const target = e.target;
      // Delete Group
      if (target.closest(".delete-group-btn")) {
        const btn = target.closest(".delete-group-btn");
        const id = parseInt(btn.dataset.id);
        deleteGroup(id);
      }
      // Stop propagation for checkboxes to prevent card click issues if implemented later
      if (target.matches(".group-checkbox")) {
        e.stopPropagation();
      }
    });
  }
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

  groupsList.innerHTML = ""; // Clear list safely

  if (filtered.length === 0) {
    groupsList.innerHTML =
      '<div class="empty-state"><p>No groups found.</p></div>';
    return;
  }

  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();

  filtered.forEach((group, index) => {
    // Escape search term for regex safely
    const card = document.createElement("div");
    card.className = `group-card ${group.is_active ? "active" : ""}`;
    card.style.animationDelay = `${index * 0.05}s`;

    // Highlight logic using text nodes to prevent injection
    const titleContainer = document.createElement("h3");
    titleContainer.className = "ml-2";

    if (searchTerm) {
      const parts = group.title.split(new RegExp(`(${searchTerm})`, "gi"));
      parts.forEach((part) => {
        if (part.toLowerCase() === searchTerm) {
          const highlight = document.createElement("span");
          highlight.className = "highlight";
          highlight.textContent = part;
          titleContainer.appendChild(highlight);
        } else {
          titleContainer.appendChild(document.createTextNode(part));
        }
      });
    } else {
      titleContainer.textContent = group.title;
    }

    card.innerHTML = `
        <div class="group-header">
            <div class="d-flex align-items-center">
                <input type="checkbox" class="group-checkbox" data-id="${group.id}">
            </div>
            <div class="group-status">
                <label class="switch">
                    <input type="checkbox" class="group-toggle-input" data-id="${group.id}" ${group.is_active ? "checked" : ""}>
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
        <div class="group-details">
            <p><strong>Username:</strong> <span class="text-secondary group-username"></span></p>
            <div class="mb-3">
              <span class="badge badge-${group.permission_type}">${group.permission_type.replace("_", " ")}</span>
            </div>
            <p class="text-sm text-muted">Added: ${formatDate(group.created_at)}</p>
            <div class="group-stats-strip mt-2">
                <span title="Total Messages Sent">💬 ${group.total_messages || 0}</span>
                <span title="Successful Messages">✅ ${group.success_count || 0}</span>
            </div>
        </div>
        <div class="group-actions mt-auto pt-4">
            <select class="form-control form-control-sm permission-select" data-id="${group.id}">
                <option value="all" ${group.permission_type === "all" ? "selected" : ""}>All Content</option>
                <option value="text_only" ${group.permission_type === "text_only" ? "selected" : ""}>Text Only</option>
                <option value="text_link" ${group.permission_type === "text_link" ? "selected" : ""}>Text + Link</option>
                <option value="text_image" ${group.permission_type === "text_image" ? "selected" : ""}>Text + Image</option>
                <option value="text_link_image" ${group.permission_type === "text_link_image" ? "selected" : ""}>Text + Link + Image</option>
            </select>
            <button class="btn btn-outline-danger btn-sm delete-group-btn" data-id="${group.id}">🗑️ Remove</button>
        </div>
    `;

    // Inject the safe title and username
    card.querySelector(".group-header .d-flex").appendChild(titleContainer);

    card.querySelector(".group-username").textContent = group.username || "N/A";

    fragment.appendChild(card);
  });

  groupsList.appendChild(fragment);
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

// Internal functions (no longer attached to window)
const toggleGroup = async (id, isActive) => {
  try {
    await api.patch(`/groups/${id}`, { is_active: isActive });
  } catch (error) {
    showToast(error.message, "error");
    await loadGroups();
  }
};

const updatePermission = async (id, type) => {
  try {
    await api.patch(`/groups/${id}`, { permission_type: type });
    showToast("Permission updated", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
};

const deleteGroup = async (id) => {
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
  const overview = data.overview || {};
  const totalSpan = document.getElementById("analyticsTotalMessages");
  const rateSpan = document.getElementById("analyticsSuccessRate");
  const failedSpan = document.getElementById("analyticsFailed");

  if (totalSpan)
    totalSpan.textContent =
      (overview.total_messages_sent || 0) +
      (overview.total_messages_failed || 0);
  if (rateSpan)
    rateSpan.textContent = `${Math.round(overview.overall_success_rate || 0)}%`;
  if (failedSpan) failedSpan.textContent = overview.total_messages_failed || 0;

  renderRankedList("topGroupsList", data.top_groups || [], "success_rate", "%");
  renderRankedList(
    "problemGroupsList",
    data.problem_groups || [],
    "total_attempts",
  );
  renderRankedList(
    "inactiveGroupsList",
    data.inactive_groups || [],
    "last_message_at",
    "date",
  );
}

function renderRankedList(id, items, valueKey, unit = "") {
  const container = document.getElementById(id);
  if (!container) return;
  if (items.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted">No data available</p>';
    return;
  }

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "ranked-item";

    let val = item[valueKey];
    if (unit === "%") val = Math.round(val);
    else if (unit === "date") {
      val = val ? new Date(val).toLocaleDateString() : "Never";
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "ranked-title";
    titleSpan.textContent = item.title;

    const valueSpan = document.createElement("span");
    valueSpan.className = "ranked-value";
    valueSpan.textContent = `${val}${unit !== "date" ? unit : ""}`;

    div.appendChild(titleSpan);
    div.appendChild(valueSpan);
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
}

export function renderGroupSelectors() {
  const selector = document.getElementById("groupSelector");
  if (!selector) return;
  if (allGroups.length === 0) {
    selector.innerHTML = '<p class="text-muted">No groups available</p>';
    return;
  }

  selector.innerHTML = "";

  allGroups
    .filter((g) => g.is_active)
    .forEach((group) => {
      const label = document.createElement("label");
      label.className = "group-select-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "target_groups";
      input.value = group.id;

      const spanTitle = document.createElement("span");
      spanTitle.textContent = group.title;

      const smallPerm = document.createElement("small");
      smallPerm.textContent = group.permission_type;

      label.appendChild(input);
      label.appendChild(spanTitle);
      label.appendChild(smallPerm);

      selector.appendChild(label);
    });
}
