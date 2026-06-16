import { PanelBase, escapeHtml } from "./PanelBase.js";

const INVENTORY_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"];

const TYPE_LABELS = {
  weapon: "Weapons",
  equipment: "Equipment",
  consumable: "Consumables",
  tool: "Tools",
  loot: "Loot",
  container: "Containers",
  backpack: "Backpacks"
};

const SORT_MODES = [
  { id: "name", label: "Name" },
  { id: "value", label: "Value" }
];

const RARITY_COLORS = {
  common: "#8a8a8a",
  uncommon: "#4ade80",
  rare: "#6aa8ff",
  veryRare: "#a855f7",
  legendary: "#fb923c",
  artifact: "#fbbf24"
};

const CURRENCY_META = [
  { key: "pp", label: "PP", color: "#e8e8e8" },
  { key: "gp", label: "GP", color: "#ffd700" },
  { key: "ep", label: "EP", color: "#4ade80" },
  { key: "sp", label: "SP", color: "#c0c0c0" },
  { key: "cp", label: "CP", color: "#b87333" }
];

export class InventoryPanel extends PanelBase {
  static panelId = "inventory";
  static panelLabel = "Inventory";
  static panelIcon = "fas fa-box";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._allItems = [];
    this._searchTerm = "";
    this._sortMode = "name";
    this._collapsedTypes = new Set();
    this._activeTypes = new Set(INVENTORY_TYPES);
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;
    this._allItems = actor.items.filter(i => INVENTORY_TYPES.includes(i.type));

    containerEl.innerHTML = `
      <div class="sd-inv-panel">
        <div class="sd-inv-toolbar">
          <select class="sd-inv-sort">
            ${SORT_MODES.map(m => `<option value="${m.id}" ${this._sortMode === m.id ? "selected" : ""}>${escapeHtml(m.label)}</option>`).join("")}
          </select>
          <div class="sd-inv-search">
            <i class="fas fa-search"></i>
            <input type="text" class="sd-inv-search-input" placeholder="Search..." value="${escapeHtml(this._searchTerm)}" />
          </div>
        </div>

        <div class="sd-inv-currency" id="sd-inv-currency">
          ${this._renderCurrency()}
        </div>

        <div class="sd-inv-type-filters" id="sd-inv-type-filters">
          ${INVENTORY_TYPES.map(t => `<button class="sd-inv-type-pill ${this._activeTypes.has(t) ? "active" : ""}" data-type="${t}">${escapeHtml(TYPE_LABELS[t])}</button>`).join("")}
        </div>

        <div class="sd-inv-scroll" id="sd-inv-scroll"></div>

        <div class="sd-inv-footer" id="sd-inv-footer"></div>
      </div>
    `;

    const scrollEl = containerEl.querySelector("#sd-inv-scroll");
    this._renderItems();

    containerEl.querySelector(".sd-inv-search-input")?.addEventListener("input", (e) => {
      this._searchTerm = e.target.value;
      this._renderItems();
    });

    containerEl.querySelector(".sd-inv-sort")?.addEventListener("change", (e) => {
      this._sortMode = e.target.value;
      this._renderItems();
    });

    containerEl.querySelector("#sd-inv-currency")?.addEventListener("click", (e) => {
      const currSpan = e.target.closest(".sd-inv-currency-item");
      if (!currSpan || currSpan.querySelector("input")) return;
      const key = currSpan.dataset.curr;
      if (!key) return;
      this._startEditCurrency(key, currSpan);
    });

    containerEl.querySelector("#sd-inv-type-filters")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".sd-inv-type-pill");
      if (!pill) return;
      const type = pill.dataset.type;
      if (!this._activeTypes.delete(type)) this._activeTypes.add(type);
      this._renderItems();
    });

    if (scrollEl && !scrollEl._sdListener) {
      scrollEl._sdListener = true;
      scrollEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        const header = e.target.closest(".sd-inv-group-header");
        if (btn) {
          const itemId = btn.dataset.itemId;
          if (!itemId) return;
          const item = this._actor?.items.get(itemId);
          if (!item) return;

          if (btn.classList.contains("sd-inv-item-equip")) {
            await item.update({ "system.equipped": !item.system.equipped });
            this._allItems = this._actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
            this._renderItems();
          } else if (btn.classList.contains("sd-inv-item-chat")) {
            await item.displayCard();
          } else if (btn.classList.contains("sd-inv-item-use")) {
            try { await item.use({ legacy: false }); } catch(e) { /* silently fail */ }
          }
        } else if (header) {
          const type = header.dataset.type;
          if (!type) return;
          const group = header.closest(".sd-inv-group");
          if (this._collapsedTypes.has(type)) {
            this._collapsedTypes.delete(type);
            group?.classList.remove("collapsed");
          } else {
            this._collapsedTypes.add(type);
            group?.classList.add("collapsed");
          }
        }
      });
    }
  }

  _renderCurrency() {
    const currency = this._actor?.system?.currency ?? {};
    return CURRENCY_META.map(({ key, label, color }) =>
      `<span class="sd-inv-currency-item" data-curr="${key}">
        <i class="fas fa-coins" style="color:${color}"></i> ${currency[key] ?? 0} ${label}
      </span>`
    ).join("");
  }

  _startEditCurrency(key, spanEl) {
    const currentValue = this._actor?.system?.currency?.[key] ?? 0;
    const meta = CURRENCY_META.find(c => c.key === key);
    spanEl.innerHTML = `<i class="fas fa-coins" style="color:${meta?.color}"></i>
      <input type="number" class="sd-curr-edit" value="${currentValue}" step="1" min="0" />`;
    const input = spanEl.querySelector("input");
    if (!input) return;
    input.focus();
    input.select();

    const finish = async (save) => {
      if (save) {
        const newVal = parseInt(input.value) || 0;
        try { await this._actor?.update({ [`system.currency.${key}`]: newVal }); }
        catch(e) { /* silently fail */ }
      }
      const currBar = this._containerEl?.querySelector("#sd-inv-currency");
      if (currBar) currBar.innerHTML = this._renderCurrency();
    };

    input.addEventListener("blur", () => finish(true));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
  }

  _renderItems() {
    const scrollEl = this._containerEl?.querySelector("#sd-inv-scroll");
    const footerEl = this._containerEl?.querySelector("#sd-inv-footer");
    const filterEl = this._containerEl?.querySelector("#sd-inv-type-filters");
    if (!scrollEl || !footerEl || !filterEl) return;

    filterEl.querySelectorAll(".sd-inv-type-pill").forEach(pill => {
      pill.classList.toggle("active", this._activeTypes.has(pill.dataset.type));
    });

    let items = this._allItems;

    if (this._searchTerm) {
      const term = this._searchTerm.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(term));
    }

    const groups = {};
    for (const item of items) {
      (groups[item.type] ??= []).push(item);
    }

    const groupKeys = INVENTORY_TYPES.filter(t => groups[t] && this._activeTypes.has(t));
    let totalItems = 0;
    let totalWeight = 0;
    let groupsHtml = "";

    for (const type of groupKeys) {
      let typeItems = groups[type];
      const label = TYPE_LABELS[type] ?? type;

      if (this._sortMode === "name") {
        typeItems = [...typeItems].sort((a, b) => a.name.localeCompare(b.name));
      } else if (this._sortMode === "value") {
        typeItems = [...typeItems].sort((a, b) => (b.system.price?.value ?? 0) - (a.system.price?.value ?? 0));
      }

      let itemsHtml = "";
      for (const item of typeItems) {
        const qty = item.system.quantity ?? 1;
        const weight = (item.system.weight?.value ?? 0) * qty;
        totalItems += qty;
        totalWeight += weight;

        const icon = escapeHtml(item.img || "icons/svg/mystery-man.svg");
        const name = escapeHtml(item.name);
        const value = item.system.price?.value ?? 0;
        const denom = item.system.price?.denomination ?? "gp";
        const canEquip = "equipped" in (item.system ?? {});
        const rarity = item.system.rarity;
        const rarityColor = RARITY_COLORS[rarity] ?? null;

        // Attunement
        const attunement = item.system.attunement;
        const attuned = item.system.attuned;
        let attIcon = "";
        if (attuned) {
          attIcon = `<i class="fas fa-sun" style="color:#ffd700" title="Attuned"></i>`;
        } else if (attunement === "required") {
          attIcon = `<i class="fas fa-sun" style="color:#fb923c;opacity:0.6" title="Requires Attunement"></i>`;
        } else if (attunement === "optional") {
          attIcon = `<i class="fas fa-sun" style="color:#6aa8ff;opacity:0.5" title="Optional Attunement"></i>`;
        }

        // Use button for items with activation or activities
        const hasActivation = item.system.activation?.type;
        const hasActivities = item.system.activities?.length > 0;
        const showUse = type === "consumable" || hasActivation || hasActivities;

        // Tooltip description
        const desc = item.system.description?.value ?? "";
        const plainDesc = desc.replace(/<[^>]*>/g, "").trim();
        const tooltip = plainDesc
          ? escapeHtml(plainDesc.substring(0, 200) + (plainDesc.length > 200 ? "…" : ""))
          : null;

        // Rarity border on icon
        const rarityStyle = rarityColor ? `style="border-color:${rarityColor}"` : "";

        itemsHtml += `<div class="sd-inv-item"${tooltip ? ` title="${tooltip}"` : ""}>
          <img class="sd-inv-item-icon" src="${icon}" alt="${name}" loading="lazy" ${rarityStyle} />
          <span class="sd-inv-item-name">${name}</span>
          <span class="sd-inv-item-qty">×${qty}</span>
          <span class="sd-inv-item-weight">${weight > 0 ? weight.toFixed(1) : "—"}</span>
          <span class="sd-inv-item-value">${value > 0 ? `${value} ${denom}` : ""}</span>
          ${attIcon ? `<span class="sd-inv-item-att">${attIcon}</span>` : ""}
          ${showUse ? `<button class="sd-inv-item-use" data-item-id="${item.id}" title="Use item"><i class="fas fa-bolt"></i></button>` : ""}
          ${canEquip ? `<button class="sd-inv-item-equip" data-item-id="${item.id}" title="${item.system.equipped ? "Unequip" : "Equip"}">
            <i class="fas ${item.system.equipped ? "fa-check-circle" : "fa-circle"}"></i>
          </button>` : ""}
          <button class="sd-inv-item-chat" data-item-id="${item.id}" title="Show in chat">
            <i class="fas fa-comment"></i>
          </button>
        </div>`;
      }

      const collapsed = this._collapsedTypes.has(type);
      groupsHtml += `<div class="sd-inv-group${collapsed ? " collapsed" : ""}">
        <div class="sd-inv-group-header" data-type="${type}">${escapeHtml(label)} <span class="sd-inv-group-count">(${typeItems.length})</span></div>
        ${itemsHtml}
      </div>`;
    }

    scrollEl.innerHTML = groupsHtml || `<div class="sd-inv-empty">
      <i class="fas fa-box-open"></i>
      <p>${this._searchTerm ? "No items match your search" : "No items in inventory"}</p>
    </div>`;

    const encumbrance = this._actor?.system?.attributes?.encumbrance;
    const maxWeight = encumbrance?.max ?? 0;
    footerEl.innerHTML = `
      <span>${totalItems} items</span>
      <span>${totalWeight.toFixed(1)} / ${maxWeight} lb</span>
    `;

  }
}
