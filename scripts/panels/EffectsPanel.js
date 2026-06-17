import { PanelBase, escapeHtml } from "./PanelBase.js";

export class EffectsPanel extends PanelBase {
  static panelId = "effects";
  static panelLabel = "Effects";
  static panelIcon = "fas fa-magic";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;

    const effects = actor.effects;
    const tempEffects = effects.filter(e => e.isTemporary && !e.disabled);
    const passiveEffects = effects.filter(e => !e.isTemporary && !e.disabled);

    containerEl.innerHTML = `
      <div class="sd-effects-panel">
        <h3 class="sd-effects-heading"><i class="fas fa-hourglass-half"></i> Temporary Effects ${tempEffects.length > 0 ? `<span class="sd-effects-count">${tempEffects.length}</span>` : ""}</h3>
        <div class="sd-effects-temp" id="sd-effects-temp">
          ${tempEffects.length === 0 ? '<div class="sd-effects-none">No active temporary effects</div>' : ""}
          ${tempEffects.map(e => this._renderEffect(e)).join("")}
        </div>
        <h3 class="sd-effects-heading"><i class="fas fa-passport"></i> Passive Effects ${passiveEffects.length > 0 ? `<span class="sd-effects-count">${passiveEffects.length}</span>` : ""}</h3>
        <div class="sd-effects-passive" id="sd-effects-passive">
          ${passiveEffects.length === 0 ? '<div class="sd-effects-none">No passive effects</div>' : ""}
          ${passiveEffects.map(e => this._renderEffect(e)).join("")}
        </div>
      </div>
    `;

    containerEl.querySelector("#sd-effects-temp")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-effect-remove]");
      if (!btn) return;
      const effectId = btn.dataset.effectRemove;
      const effect = actor.effects.get(effectId);
      if (effect) effect.delete().then(() => this.render(actor, containerEl));
    });
  }

  _renderEffect(effect) {
    const name = escapeHtml(effect.name || effect.label || "Unknown Effect");
    const icon = escapeHtml(effect.icon || "icons/svg/mystery-man.svg");

    let durationHtml = "";
    if (effect.isTemporary) {
      const remaining = effect.duration?.remaining ?? 0;
      const total = effect.duration?.startTime && effect.duration?.seconds
        ? effect.duration.seconds
        : remaining;
      if (total > 0) {
        const pct = Math.min((remaining / total) * 100, 100);
        const color = pct <= 25 ? "#ff6b6b" : pct <= 50 ? "#fb923c" : "#4ade80";
        const remainingStr = this._formatDuration(remaining);
        durationHtml = `<div class="sd-effects-duration-bar">
          <div class="sd-effects-duration-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="sd-effects-duration-text">${remainingStr}</span>`;
      }
    }

    let statusHtml = "";
    if (effect.statuses?.size > 0) {
      const statuses = Array.from(effect.statuses).map(s => {
        const label = game.i18n ? game.i18n.localize(CONFIG?.DND5E?.conditionTypes?.[s]?.label ?? s) : s;
        return escapeHtml(label);
      });
      statusHtml = `<div class="sd-effects-statuses">${statuses.join(", ")}</div>`;
    }

    const origin = effect.origin ? this._getOriginName(effect.origin) : null;

    return `<div class="sd-effects-item">
      <span class="sd-effects-icon-wrap">
        <img class="sd-effects-icon" src="${icon}" alt="${name}" loading="lazy" />
      </span>
      <span class="sd-effects-info">
        <span class="sd-effects-name">${name}</span>
        ${origin ? `<span class="sd-effects-origin">${escapeHtml(origin)}</span>` : ""}
        ${statusHtml}
      </span>
      ${durationHtml ? `<span class="sd-effects-duration">${durationHtml}</span>` : ""}
      ${effect.isTemporary ? `<button class="sd-effects-remove" data-effect-remove="${effect.id}" title="Remove effect"><i class="fas fa-times"></i></button>` : ""}
    </div>`;
  }

  _getOriginName(originUuid) {
    try {
      const doc = fromUuidSync(originUuid);
      return doc?.name ?? "";
    } catch(e) {
      return "";
    }
  }

  _formatDuration(seconds) {
    if (seconds <= 0) return "Expired";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  }

  destroy() {
    this._containerEl = null;
    this._actor = null;
    super.destroy();
  }
}
