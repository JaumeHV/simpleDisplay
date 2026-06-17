import { PanelBase, escapeHtml } from "./PanelBase.js";

const SCHOOL_COLORS = {
  abjuration: "#6aa8ff",
  conjuration: "#fbbf24",
  divination: "#a855f7",
  enchantment: "#fb923c",
  evocation: "#ff6b6b",
  illusion: "#c084fc",
  necromancy: "#4ade80",
  transmutation: "#34d399"
};

const SCHOOL_ICONS = {
  abjuration: "fa-shield-halved",
  conjuration: "fa-arrow-up-from-ground-water",
  divination: "fa-eye",
  enchantment: "fa-heart",
  evocation: "fa-bolt",
  illusion: "fa-mask",
  necromancy: "fa-skull",
  transmutation: "fa-wand-magic-sparkles"
};

const SPELL_LEVELS = ["all", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LEVEL_LABELS = { all: "All", 0: "Cantrip", 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th", 9: "9th" };

export class SpellsPanel extends PanelBase {
  static panelId = "spells";
  static panelLabel = "Spells";
  static panelIcon = "fas fa-hat-wizard";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._allSpells = [];
    this._searchTerm = "";
    this._levelFilter = "all";
    this._collapsedLevels = new Set();
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;
    this._allSpells = actor.items.filter(i => i.type === "spell");

    containerEl.innerHTML = `
      <div class="sd-spell-panel">
        <div class="sd-spell-slots" id="sd-spell-slots"></div>
        <div class="sd-spell-toolbar">
          <div class="sd-spell-search">
            <i class="fas fa-search"></i>
            <input type="text" class="sd-spell-search-input" placeholder="Search spells..." value="${escapeHtml(this._searchTerm)}" />
          </div>
        </div>
        <div class="sd-spell-level-filters" id="sd-spell-level-filters">
          ${SPELL_LEVELS.map(level => `<button class="sd-spell-level-pill ${this._levelFilter === level ? "active" : ""}" data-level="${level}">${LEVEL_LABELS[level]}</button>`).join("")}
        </div>
        <div class="sd-spell-scroll" id="sd-spell-scroll"></div>
      </div>
    `;

    this._renderSlots();
    this._renderSpells();

    containerEl.querySelector(".sd-spell-search-input")?.addEventListener("input", (e) => {
      this._searchTerm = e.target.value;
      this._renderSpells();
    });

    containerEl.querySelector("#sd-spell-level-filters")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".sd-spell-level-pill");
      if (!pill) return;
      const level = pill.dataset.level;
      if (level === "all") this._levelFilter = "all";
      else this._levelFilter = parseInt(level);
      this._renderSpells();
    });

    const scrollEl = containerEl.querySelector("#sd-spell-scroll");
    if (scrollEl && !scrollEl._sdListener) {
      scrollEl._sdListener = true;
      scrollEl.addEventListener("click", (e) => {
        const header = e.target.closest(".sd-spell-group-header");
        const btn = e.target.closest("button");
        const itemRow = e.target.closest(".sd-spell-item");

        if (header) {
          const level = parseInt(header.dataset.level);
          if (isNaN(level)) return;
          const group = header.closest(".sd-spell-group");
          this._collapsedLevels.has(level) ? this._collapsedLevels.delete(level) : this._collapsedLevels.add(level);
          group?.classList.toggle("collapsed");
          return;
        }

        if (btn) {
          const spellId = btn.dataset.spellId;
          if (!spellId) return;
          const spell = this._actor?.items.get(spellId);
          if (!spell) return;
          if (btn.classList.contains("sd-spell-cast")) {
            try { spell.use({ legacy: false }); } catch(e) {}
          } else if (btn.classList.contains("sd-spell-prep")) {
            const prepared = !(spell.system.preparation?.prepared ?? false);
            spell.update({ "system.preparation.prepared": prepared }).then(() => {
              this._allSpells = this._actor.items.filter(i => i.type === "spell");
              this._renderSpells();
            });
          } else if (btn.classList.contains("sd-spell-chat")) {
            spell.displayCard();
          }
          return;
        }

        if (itemRow) {
          const spellId = itemRow.dataset.spellId;
          if (spellId) this._showPopup(spellId);
        }
      });
    }
  }

  _renderSlots() {
    const slotsEl = this._containerEl?.querySelector("#sd-spell-slots");
    if (!slotsEl) return;
    const spells = this._actor?.system?.spells ?? {};
    let html = "";
    for (let i = 1; i <= 9; i++) {
      const slot = spells[`spell${i}`];
      if (!slot) continue;
      const max = slot.max || slot.override || 0;
      const value = slot.value ?? max;
      if (max === 0) continue;
      const pct = max > 0 ? (value / max) * 100 : 0;
      const color = pct === 0 ? "#ff6b6b" : pct <= 0.25 ? "#fb923c" : "#4ade80";
      html += `<div class="sd-spell-slot" title="${LEVEL_LABELS[i]}">
        <span class="sd-spell-slot-label">${LEVEL_LABELS[i]}</span>
        <div class="sd-spell-slot-bar">
          <div class="sd-spell-slot-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="sd-spell-slot-count">${value}/${max}</span>
      </div>`;
    }
    if (spells.pact?.max) {
      const pact = spells.pact;
      const max = pact.max;
      const value = pact.value ?? max;
      const pct = max > 0 ? (value / max) * 100 : 0;
      html += `<div class="sd-spell-slot pact" title="Pact">
        <span class="sd-spell-slot-label">Pact</span>
        <div class="sd-spell-slot-bar">
          <div class="sd-spell-slot-fill" style="width:${pct}%;background:#a855f7"></div>
        </div>
        <span class="sd-spell-slot-count">${value}/${max}</span>
      </div>`;
    }
    slotsEl.innerHTML = html || '<div class="sd-spell-slots-empty">No spell slots</div>';
  }

  _renderSpells() {
    const scrollEl = this._containerEl?.querySelector("#sd-spell-scroll");
    const filterEl = this._containerEl?.querySelector("#sd-spell-level-filters");
    if (!scrollEl || !filterEl) return;

    filterEl.querySelectorAll(".sd-spell-level-pill").forEach(pill => {
      const level = pill.dataset.level === "all" ? "all" : parseInt(pill.dataset.level);
      pill.classList.toggle("active", level === this._levelFilter);
    });

    let spells = this._allSpells;
    if (this._levelFilter !== "all") {
      spells = spells.filter(s => (s.system.spellLevel ?? 0) === this._levelFilter);
    }
    if (this._searchTerm) {
      const term = this._searchTerm.toLowerCase();
      spells = spells.filter(s => s.name.toLowerCase().includes(term));
    }

    const groups = {};
    for (const spell of spells) {
      const level = spell.system.spellLevel ?? 0;
      (groups[level] ??= []).push(spell);
    }

    const levels = Object.keys(groups).map(Number).sort((a, b) => a - b);
    let html = "";
    for (const level of levels) {
      const levelSpells = groups[level].sort((a, b) => a.name.localeCompare(b.name));
      const collapsed = this._collapsedLevels.has(level);
      html += `<div class="sd-spell-group${collapsed ? " collapsed" : ""}">
        <div class="sd-spell-group-header" data-level="${level}">
          ${LEVEL_LABELS[level]} <span class="sd-spell-group-count">(${levelSpells.length})</span>
        </div>`;
      for (const spell of levelSpells) {
        const name = escapeHtml(spell.name);
        const icon = escapeHtml(spell.img || "icons/svg/mystery-man.svg");
        const school = spell.system.school;
        const schoolColor = SCHOOL_COLORS[school] || "var(--sd-text-dim)";
        const schoolIcon = SCHOOL_ICONS[school] || "fa-circle";
        const schoolLabel = school ? (game.i18n?.localize(CONFIG?.DND5E?.spellSchools?.[school] ?? school) ?? school) : "";
        const activation = spell.system.activation?.type ?? "";
        const activLabel = activation ? (game.i18n?.localize(CONFIG?.DND5E?.abilityActivationTypes?.[activation] ?? activation) ?? activation) : "";
        const prepMode = spell.system.preparation?.mode ?? "";
        const isPrepared = spell.system.preparation?.prepared ?? false;
        const showPrep = prepMode === "prepared" || prepMode === "pact";
        const components = [];
        if (spell.system.components?.v) components.push("V");
        if (spell.system.components?.s) components.push("S");
        if (spell.system.components?.m) components.push("M");
        const compStr = components.join("");
        const duration = spell.system.duration?.value ? `${spell.system.duration.value} ${spell.system.duration.units ?? ""}` : spell.system.duration?.units ?? "";
        const rangeVal = spell.system.range?.value ? `${spell.system.range.value} ${spell.system.range.units ?? ""}` : spell.system.range?.units ?? "";

        const desc = spell.system.description?.value ?? "";
        const plainDesc = desc.replace(/<[^>]*>/g, "").trim();
        const tooltip = plainDesc ? escapeHtml(plainDesc.substring(0, 150) + (plainDesc.length > 150 ? "…" : "")) : null;

        const levelBadge = level === 0 ? "C" : level.toString();
        const badgeBg = level === 0 ? "#a855f7" : "#6aa8ff";

        html += `<div class="sd-spell-item" data-spell-id="${spell.id}"${tooltip ? ` title="${tooltip}"` : ""}>
          <span class="sd-spell-item-level" style="background:${badgeBg}">${levelBadge}</span>
          <span class="sd-spell-item-icon-wrap">
            <img class="sd-spell-item-icon" src="${icon}" alt="${name}" loading="lazy" />
          </span>
          <span class="sd-spell-item-info">
            <span class="sd-spell-item-name">${name}</span>
            <span class="sd-spell-item-meta">
              <i class="fas ${schoolIcon}" style="color:${schoolColor};margin-right:2px"></i>${schoolLabel}
              ${activLabel ? ` · ${activLabel}` : ""}
              ${compStr ? ` · ${compStr}` : ""}
              ${duration ? ` · ${duration}` : ""}
            </span>
          </span>
          <span class="sd-spell-item-actions">
            ${showPrep ? `<button class="sd-spell-prep" data-spell-id="${spell.id}" title="${isPrepared ? "Unprepare" : "Prepare"}">
              <i class="fas ${isPrepared ? "fa-book-open" : "fa-book"}" style="color:${isPrepared ? "#4ade80" : "var(--sd-text-dim)"}"></i>
            </button>` : ""}
            <button class="sd-spell-cast" data-spell-id="${spell.id}" title="Cast spell"><i class="fas fa-bolt"></i></button>
            <button class="sd-spell-chat" data-spell-id="${spell.id}" title="Show in chat"><i class="fas fa-comment"></i></button>
          </span>
        </div>`;
      }
      html += `</div>`;
    }

    scrollEl.innerHTML = html || `<div class="sd-spell-empty">
      <i class="fas fa-hat-wizard"></i>
      <p>${this._searchTerm ? "No spells match your search" : "No spells known"}</p>
    </div>`;
  }

  _showPopup(spellId) {
    const panel = this._containerEl?.querySelector(".sd-spell-panel");
    if (!panel) return;
    const existing = panel.querySelector(".sd-spell-popup");
    if (existing) { existing.remove(); return; }

    const spell = this._actor?.items.get(spellId);
    if (!spell) return;

    const name = escapeHtml(spell.name);
    const icon = escapeHtml(spell.img || "icons/svg/mystery-man.svg");
    const desc = spell.system.description?.value ?? "<p><em>No description</em></p>";
    const school = spell.system.school;
    const schoolColor = SCHOOL_COLORS[school] || "var(--sd-text-dim)";
    const schoolLabel = school ? (game.i18n?.localize(CONFIG?.DND5E?.spellSchools?.[school] ?? school) ?? school) : "";
    const level = spell.system.spellLevel ?? 0;
    const levelLabel = level === 0 ? "Cantrip" : `${level}${level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th"} level`;
    const activation = spell.system.activation?.type ? (game.i18n?.localize(CONFIG?.DND5E?.abilityActivationTypes?.[spell.system.activation.type] ?? spell.system.activation.type) ?? spell.system.activation.type) : "";
    const duration = spell.system.duration?.value ? `${spell.system.duration.value} ${spell.system.duration.units ?? ""}` : spell.system.duration?.units ?? "Instantaneous";
    const rangeVal = spell.system.range?.value ? `${spell.system.range.value} ${spell.system.range.units ?? ""}` : spell.system.range?.units ?? "Self";
    const components = [];
    if (spell.system.components?.v) components.push("Verbal");
    if (spell.system.components?.s) components.push("Somatic");
    if (spell.system.components?.m) components.push("Material");
    const compStr = components.join(", ") || "None";
    const materials = spell.system.materials?.value ? escapeHtml(spell.system.materials.value) : "";
    const target = spell.system.target?.type ? `${spell.system.target.value ? spell.system.target.value + " " : ""}${spell.system.target.type}${spell.system.target.units ? " (" + spell.system.target.units + ")" : ""}` : "";

    const popup = document.createElement("div");
    popup.className = "sd-spell-popup";
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());

    popup.innerHTML = `<div class="sd-spell-popup-header" style="border-left:3px solid ${schoolColor}">
      <img src="${icon}" alt="${name}" />
      <span class="sd-spell-popup-title">${name}</span>
      <button type="button" class="sd-spell-popup-close" title="Close">&times;</button>
    </div>
    <div class="sd-spell-popup-meta">
      <span><i class="fas ${SCHOOL_ICONS[school] || "fa-circle"}" style="color:${schoolColor}"></i> ${schoolLabel}</span>
      <span>${levelLabel}</span>
      ${activation ? `<span><i class="fas fa-clock"></i> ${activation}</span>` : ""}
    </div>
    <div class="sd-spell-popup-details">
      ${duration ? `<div><strong>Duration:</strong> ${duration}</div>` : ""}
      ${rangeVal ? `<div><strong>Range:</strong> ${rangeVal}</div>` : ""}
      ${target ? `<div><strong>Target:</strong> ${target}</div>` : ""}
      <div><strong>Components:</strong> ${compStr}${materials ? ` (${materials})` : ""}</div>
    </div>
    <div class="sd-spell-popup-body">${desc}</div>`;

    popup.querySelector(".sd-spell-popup-close")?.addEventListener("click", () => popup.remove());

    panel.querySelector(".sd-spell-scroll")?.before(popup);

    panel.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".sd-spell-popup")) popup.remove();
    }, { once: true });
  }

  destroy() {
    this._containerEl = null;
    this._actor = null;
    this._allSpells = [];
    super.destroy();
  }
}
