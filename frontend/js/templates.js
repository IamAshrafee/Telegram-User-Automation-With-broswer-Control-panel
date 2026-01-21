import { api } from "./app.js";
import { showToast } from "./ui-components.js";

let templates = [];
let draftSaveTimer = null;

// Load all templates
export async function loadTemplates() {
  try {
    templates = await api.get("/templates/");
    renderTemplateDropdown();
  } catch (error) {
    console.error("Error loading templates:", error);
  }
}

// Render template dropdown
function renderTemplateDropdown() {
  const select = document.getElementById("loadTemplateSelect");
  if (!select) return;

  // Keep first option (placeholder)
  select.innerHTML = '<option value="">📋 Load Template...</option>';

  templates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = `${template.name}${template.category ? ` (${template.category})` : ""}`;
    select.appendChild(option);
  });
}

// Save template
export async function saveTemplate() {
  const messageText = document.getElementById("messageText").value.trim();
  const messageLink = document.getElementById("messageLink").value.trim();
  const messageMedia = document.getElementById("messageMedia").value;

  if (!messageText) {
    showToast("Please enter message text before saving template", "error");
    return;
  }

  const name = prompt("Enter template name:");
  if (!name) return;

  const category = prompt(
    "Enter category (optional, e.g., Marketing, Announcement):",
  );

  try {
    await api.post("/templates/", {
      name: name,
      text: messageText,
      link: messageLink || null,
      media_id: messageMedia ? parseInt(messageMedia) : null,
      category: category || null,
    });

    showToast(`Template "${name}" saved successfully!`, "success");
    await loadTemplates();
  } catch (error) {
    showToast("Failed to save template: " + error.message, "error");
  }
}

// Load template
export async function loadTemplate(templateId) {
  try {
    const template = await api.get(`/templates/${templateId}`);

    // Fill form
    document.getElementById("messageText").value = template.text;
    document.getElementById("messageLink").value = template.link || "";
    document.getElementById("messageMedia").value = template.media_id || "";

    // Update char count
    const charCount = document.getElementById("charCount");
    if (charCount) {
      charCount.textContent = template.text.length;
    }

    // Update media button if media selected
    if (template.media_id) {
      const btn = document.getElementById("selectMessageMedia");
      if (btn) btn.textContent = `Image #${template.media_id} selected`;
    }

    showToast(`Template "${template.name}" loaded`, "success");
  } catch (error) {
    showToast("Failed to load template: " + error.message, "error");
  }
}

// Auto-save draft
export function autoSaveDraft() {
  const messageText = document.getElementById("messageText").value;
  const messageLink = document.getElementById("messageLink").value;
  const messageMedia = document.getElementById("messageMedia").value;
  const bulkSendCheck = document.getElementById("bulkSendCheck");
  const bulkPermission = document.getElementById("messageBulkPermission");

  // Get selected groups
  const selectedGroups = Array.from(
    document.querySelectorAll('#groupSelector input[type="checkbox"]:checked'),
  ).map((cb) => parseInt(cb.value));

  const draftData = {
    text: messageText || null,
    link: messageLink || null,
    media_id: messageMedia ? parseInt(messageMedia) : null,
    target_groups: selectedGroups.length > 0 ? selectedGroups : null,
    bulk_send: bulkSendCheck && bulkSendCheck.checked ? 1 : 0,
    bulk_permission: bulkPermission ? bulkPermission.value : null,
  };

  // Only save if there's actual content
  if (!draftData.text && !draftData.link && !draftData.media_id) {
    return;
  }

  api
    .post("/templates/draft", draftData)
    .then(() => {
      const indicator = document.getElementById("draftIndicator");
      if (indicator) {
        indicator.style.display = "inline";
        setTimeout(() => {
          indicator.style.display = "none";
        }, 2000);
      }
    })
    .catch((error) => {
      console.error("Failed to save draft:", error);
    });
}

// Load draft on page load
export async function loadDraft() {
  try {
    const draft = await api.request("/templates/draft", { silent: true });

    if (draft.text) document.getElementById("messageText").value = draft.text;
    if (draft.link) document.getElementById("messageLink").value = draft.link;
    if (draft.media_id)
      document.getElementById("messageMedia").value = draft.media_id;

    // Restore bulk send state
    const bulkSendCheck = document.getElementById("bulkSendCheck");
    if (bulkSendCheck && draft.bulk_send) {
      bulkSendCheck.checked = true;
      bulkSendCheck.dispatchEvent(new Event("change"));

      if (draft.bulk_permission) {
        document.getElementById("messageBulkPermission").value =
          draft.bulk_permission;
      }
    }

    showToast("Draft restored", "info");
  } catch (error) {
    // No draft found, that's okay
  }
}

// Setup template system
export function setupTemplates() {
  // Load templates on init
  loadTemplates();

  // Load draft on init
  loadDraft();

  // Save template button
  const saveBtn = document.getElementById("saveTemplateBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveTemplate);
  }

  // Load template dropdown
  const loadSelect = document.getElementById("loadTemplateSelect");
  if (loadSelect) {
    loadSelect.addEventListener("change", (e) => {
      if (e.target.value) {
        loadTemplate(parseInt(e.target.value));
        e.target.value = ""; // Reset dropdown
      }
    });
  }

  // Auto-save draft every 30 seconds
  const messageText = document.getElementById("messageText");
  if (messageText) {
    messageText.addEventListener("input", () => {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(autoSaveDraft, 30000); // 30 seconds
    });
  }
}
