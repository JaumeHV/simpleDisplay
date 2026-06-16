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

export class InventoryPanel extends PanelBase {
  static panelId = "inventory";
  static panelLabel = "Inventory";
  static panelIcon = "fas fa-box";

  async render(actor, containerEl) {
    console.log("[simple-display] InventoryPanel.render | actor:", actor?.name, "num items:", actor?.items?.size);
    const items = actor.items.filter(i => INVENTORY_TYPES.includes(i.type));
    console.log("[simple-display] InventoryPanel.render | filtered items:", items.length);

    const groups = {};
    for (const item of items) {
      (groups[item.type] ??= []).push(item);
    }

    const groupKeys = Object.keys(groups);
    let totalItems = 0;
    let totalWeight = 0;
    let groupsHtml = "";

    for (const type of groupKeys) {
      const typeItems = groups[type];
      const label = TYPE_LABELS[type] ?? type;

      let itemsHtml = "";
      for (const item of typeItems) {
        const qty = item.system.quantity ?? 1;
        const weight = (item.system.weight?.value ?? 0) * qty;
        totalItems += qty;
        totalWeight += weight;

        const icon = escapeHtml(item.img || "icons/svg/mystery-man.svg");
        const name = escapeHtml(item.name);

        itemsHtml += `<div class="sd-inv-item">
          <img class="sd-inv-item-icon" src="${icon}" alt="${name}" loading="lazy" />
          <span class="sd-inv-item-name">${name}</span>
          <span class="sd-inv-item-qty">×${qty}</span>
          <span class="sd-inv-item-weight">${weight > 0 ? `${weight.toFixed(1)} lb` : "—"}</span>
        </div>`;
      }

      groupsHtml += `<div class="sd-inv-group">
        <div class="sd-inv-group-header">${label} <span class="sd-inv-group-count">(${typeItems.length})</span></div>
        ${itemsHtml}
      </div>`;
    }

    containerEl.innerHTML = `<div class="sd-inv-panel">
      <div class="sd-inv-header">Inventory</div>
      ${groupsHtml || `<div class="sd-inv-empty">
        <i class="fas fa-box-open"></i>
        <p>No items in inventory</p>
      </div>`}
      ${groupsHtml ? `<div class="sd-inv-footer">${totalItems} items, ${totalWeight.toFixed(1)} lb</div>` : ""}
    </div>`;
  }
}
