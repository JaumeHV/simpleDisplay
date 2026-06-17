import { PanelBase, escapeHtml } from "./PanelBase.js";

const FEATURE_TYPE_MAP = {
  class: { label: "Class Features", icon: "fa-graduation-cap", color: "#6aa8ff" },
  race: { label: "Racial Traits", icon: "fa-users", color: "#4ade80" },
  species: { label: "Species Traits", icon: "fa-users", color: "#4ade80" },
  feat: { label: "Feats", icon: "fa-star", color: "#fbbf24" },
  background: { label: "Background", icon: "fa-book", color: "#a855f7" },
  supernatural: { label: "Supernatural", icon: "fa-wand-magic-sparkles", color: "#fb923c" },
  pclass: { label: "Class Features", icon: "fa-graduation-cap", color: "#6aa8ff" }
};

const RECHARGE_PERIODS = {
  shortRest: "per short rest",
  longRest: "per long rest",
  day: "per day",
  dawn: "at dawn",
  dusk: "at dusk",
  minute: "per minute",
  hour: "per hour"
};

export class FeaturesPanel extends PanelBase {
  static panelId = "features";
  static panelLabel = "Features";
  static panelIcon = "fas fa-star";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._allFeatures = [];
    this._searchTerm = "";
    this._collapsedTypes = new Set();
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;
    this._allFeatures = actor.items.filter(i => i.type === "feat");

    containerEl.innerHTML = `
      <div class="sd-feat-panel">
        <div class="sd-feat-toolbar">
          <div class="sd-feat-search">
            <i class="fas fa-search"></i>
            <input type="text" class="sd-feat-search-input" placeholder="Search features..." value="${escapeHtml(this._searchTerm)}" />
          </div>
        </div>
        <div class="sd-feat-scroll" id="sd-feat-scroll">
          ${this._renderFeatures()}
        </div>
      </div>
    `;

    containerEl.querySelector(".sd-feat-search-input")?.addEventListener("input", (e) => {
      this._searchTerm = e.target.value;
      const scrollEl = containerEl.querySelector("#sd-feat-scroll");
      if (scrollEl) scrollEl.innerHTML = this._renderFeatures();
    });

    const scrollEl = containerEl.querySelector("#sd-feat-scroll");
    if (scrollEl && !scrollEl._sdListener) {
      scrollEl._sdListener = true;
      scrollEl.addEventListener("click", (e) => {
        const header = e.target.closest(".sd-feat-group-header");
        const btn = e.target.closest("button");
        const itemRow = e.target.closest(".sd-feat-item");

        if (header) {
          const type = header.dataset.featType;
          if (!type) return;
          const group = header.closest(".sd-feat-group");
          this._collapsedTypes.has(type) ? this._collapsedTypes.delete(type) : this._collapsedTypes.add(type);
          group?.classList.toggle("collapsed");
          return;
        }

        if (btn) {
          const featId = btn.dataset.featId;
          if (!featId) return;
          const feat = this._actor?.items.get(featId);
          if (!feat) return;
          if (btn.classList.contains("sd-feat-use")) {
            try { feat.use({ legacy: false }); } catch(e) {}
          } else if (btn.classList.contains("sd-feat-chat")) {
            feat.displayCard();
          } else if (btn.classList.contains("sd-feat-recharge")) {
            feat.update({ "system.uses.value": feat.system.uses?.max ?? 1 });
          }
          return;
        }

        if (itemRow) {
          const featId = itemRow.dataset.featId;
          if (featId) this._showPopup(featId);
        }
      });
    }
  }

  _renderFeatures() {
    let features = this._allFeatures;
    if (this._searchTerm) {
      const term = this._searchTerm.toLowerCase();
      features = features.filter(f => f.name.toLowerCase().includes(term));
    }

    const groups = {};
    for (const feat of features) {
      const typeVal = feat.system.type?.value ?? "feat";
      (groups[typeVal] ??= []).push(feat);
    }

    const typeOrder = ["class", "pclass", "species", "race", "feat", "background", "supernatural"];
    const sortedTypes = Object.keys(groups).sort((a, b) => {
      const ai = typeOrder.indexOf(a);
      const bi = typeOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    let html = "";
    for (const typeVal of sortedTypes) {
      const meta = FEATURE_TYPE_MAP[typeVal] ?? { label: typeVal, icon: "fa-circle", color: "var(--sd-text-dim)" };
      const typeFeatures = groups[typeVal].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
      const collapsed = this._collapsedTypes.has(typeVal);

      let itemsHtml = "";
      for (const feat of typeFeatures) {
        itemsHtml += this._renderFeatureRow(feat);
      }

      html += `<div class="sd-feat-group${collapsed ? " collapsed" : ""}">
        <div class="sd-feat-group-header" data-feat-type="${typeVal}">
          <i class="fas ${meta.icon}" style="color:${meta.color}"></i>
          ${meta.label} <span class="sd-feat-group-count">(${typeFeatures.length})</span>
        </div>
        ${itemsHtml}
      </div>`;
    }

    return html || `<div class="sd-feat-empty">
      <i class="fas fa-star"></i>
      <p>${this._searchTerm ? "No features match your search" : "No features available"}</p>
    </div>`;
  }

  _renderFeatureRow(feat) {
    const name = escapeHtml(feat.name);
    const icon = escapeHtml(feat.img || "icons/svg/mystery-man.svg");
    const hasActivation = !!feat.system.activation?.type;
    const uses = feat.system.uses;
    const hasUses = uses && uses.max > 0;
    const isDepleted = hasUses && (uses.value ?? 0) <= 0;

    const desc = feat.system.description?.value ?? "";
    const plainDesc = desc.replace(/<[^>]*>/g, "").trim();
    const tooltip = plainDesc ? escapeHtml(plainDesc.substring(0, 150) + (plainDesc.length > 150 ? "…" : "")) : null;

    return `<div class="sd-feat-item" data-feat-id="${feat.id}"${tooltip ? ` title="${tooltip}"` : ""}>
      <span class="sd-feat-icon-wrap">
        <img class="sd-feat-icon" src="${icon}" alt="${name}" loading="lazy" />
      </span>
      <span class="sd-feat-info">
        <span class="sd-feat-name">${name}</span>
        ${hasUses ? `<span class="sd-feat-uses${isDepleted ? " depleted" : ""}">${uses.value ?? 0}/${uses.max} ${RECHARGE_PERIODS[uses.per] ?? ""}</span>` : ""}
      </span>
      <span class="sd-feat-actions">
        ${hasActivation ? `<button class="sd-feat-use" data-feat-id="${feat.id}" title="Use"><i class="fas fa-bolt"></i></button>` : ""}
        ${hasUses && isDepleted ? `<button class="sd-feat-recharge" data-feat-id="${feat.id}" title="Recharge"><i class="fas fa-rotate-left"></i></button>` : ""}
        <button class="sd-feat-chat" data-feat-id="${feat.id}" title="Show in chat"><i class="fas fa-comment"></i></button>
      </span>
    </div>`;
  }

  _showPopup(featId) {
    const panel = this._containerEl?.querySelector(".sd-feat-panel");
    if (!panel) return;
    const existing = panel.querySelector(".sd-feat-popup");
    if (existing) { existing.remove(); return; }

    const feat = this._actor?.items.get(featId);
    if (!feat) return;

    const name = escapeHtml(feat.name);
    const icon = escapeHtml(feat.img || "icons/svg/mystery-man.svg");
    const desc = feat.system.description?.value ?? "<p><em>No description</em></p>";
    const typeVal = feat.system.type?.value ?? "";
    const meta = FEATURE_TYPE_MAP[typeVal] ?? { label: typeVal, icon: "fa-circle", color: "var(--sd-text-dim)" };

    const popup = document.createElement("div");
    popup.className = "sd-feat-popup";
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());

    let detailsHtml = "";
    const activation = feat.system.activation?.type;
    const uses = feat.system.uses;
    if (activation || (uses?.max > 0)) {
      detailsHtml = '<div class="sd-feat-popup-details">';
      if (activation) {
        const actEntry = CONFIG?.DND5E?.abilityActivationTypes?.[activation];
        const actKey = typeof actEntry === "string" ? actEntry : actEntry?.label ?? activation;
        const actLabel = game.i18n?.localize(actKey) ?? activation;
        detailsHtml += `<div><strong>Activation:</strong> ${actLabel}</div>`;
      }
      if (uses?.max > 0) {
        detailsHtml += `<div><strong>Uses:</strong> ${uses.value ?? 0}/${uses.max}${uses.per ? ` (${RECHARGE_PERIODS[uses.per] ?? uses.per})` : ""}</div>`;
      }
      detailsHtml += "</div>";
    }

    popup.innerHTML = `<div class="sd-feat-popup-header" style="border-left:3px solid ${meta.color}">
      <img src="${icon}" alt="${name}" />
      <span class="sd-feat-popup-title">${name}</span>
      <button type="button" class="sd-feat-popup-close" title="Close">&times;</button>
    </div>
    ${detailsHtml}
    <div class="sd-feat-popup-body">${desc}</div>`;

    popup.querySelector(".sd-feat-popup-close")?.addEventListener("click", () => popup.remove());
    panel.querySelector(".sd-feat-scroll")?.before(popup);
    panel.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".sd-feat-popup")) popup.remove();
    }, { once: true });
  }

  destroy() {
    this._containerEl = null;
    this._actor = null;
    this._allFeatures = [];
    super.destroy();
  }
}
