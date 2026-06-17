import { PanelBase, escapeHtml } from "./PanelBase.js";

const DISPOSITION_ICONS = {
  [-1]: "fa-skull",
  0: "fa-question-circle",
  1: "fa-shield-haloed"
};

const DISPOSITION_COLORS = {
  [-1]: "#ff6b6b",
  0: "#fbbf24",
  1: "#4ade80"
};

export class TacMapPanel extends PanelBase {
  static panelId = "tacmap";
  static panelLabel = "TacMap";
  static panelIcon = "fas fa-map-marked-alt";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._hookIds = [];
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;

    this._refresh();

    this._hookIds.push(Hooks.on("updateCombat", () => this._refresh()));
    this._hookIds.push(Hooks.on("deleteCombat", () => this._refresh()));
    this._hookIds.push(Hooks.on("createCombatant", () => this._refresh()));
    this._hookIds.push(Hooks.on("updateToken", () => this._refresh()));
    this._hookIds.push(Hooks.on("updateActor", (updated) => {
      const relevant = canvas?.scene?.tokens?.some(t => t.actor?.id === updated.id);
      if (relevant) this._refresh();
    }));
  }

  _refresh() {
    if (!this._containerEl) return;
    const scene = canvas?.scene;
    const combat = game.combats?.active ?? game.combats?.find(c => c.started);

    this._containerEl.innerHTML = `
      <div class="sd-tac-panel">
        ${this._renderHeader(scene, combat)}
        ${this._renderCombat(combat)}
        ${this._renderTokens(scene)}
      </div>
    `;

    if (!this._containerEl._sdTacListeners) {
      this._containerEl._sdTacListeners = true;
      this._containerEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-token-pan]");
        if (!btn) return;
        const tokenId = btn.dataset.tokenPan;
        const token = canvas?.tokens?.get(tokenId);
        if (token) {
          canvas.animatePan({ x: token.center.x, y: token.center.y });
        }
      });
    }
  }

  _renderHeader(scene, combat) {
    const sceneName = scene ? escapeHtml(scene.name) : "No Scene Active";
    let combatInfo = "";
    if (combat) {
      const round = combat.round ?? 0;
      const turn = combat.turn ?? 0;
      const total = combat.turns?.length ?? 0;
      combatInfo = `<div class="sd-tac-combat-info">
        <span><i class="fas fa-fist-raised"></i> Round ${round}</span>
        <span>Turn ${turn + 1} / ${total}</span>
      </div>`;
    }
    return `<div class="sd-tac-header">
      <div class="sd-tac-scene-name"><i class="fas fa-map"></i> ${sceneName}</div>
      ${combatInfo}
    </div>`;
  }

  _renderCombat(combat) {
    if (!combat || !combat.started) return "";

    const turns = combat.turns ?? [];
    const currentTurn = combat.turn;

    let html = `<div class="sd-tac-section"><h3 class="sd-tac-heading"><i class="fas fa-swords"></i> Combat</h3><div class="sd-tac-combat-list">`;

    for (let i = 0; i < turns.length; i++) {
      const c = turns[i];
      const token = c.token;
      if (!token) continue;
      const isCurrent = i === currentTurn;
      const name = escapeHtml(c.name || token.name || "Unknown");
      const init = c.initiative != null ? c.initiative.toFixed(1) : "—";
      const actor = c.actor || token.actor;
      const hp = actor ? this._getHPInfo(actor) : null;
      const img = escapeHtml(token.texture?.src || token.img || "icons/svg/mystery-man.svg");

      html += `<div class="sd-tac-combatant${isCurrent ? " active" : ""}">
        <div class="sd-tac-combatant-order">${isCurrent ? '<i class="fas fa-caret-right"></i>' : (i + 1)}</div>
        <span class="sd-tac-combatant-img"><img src="${img}" alt="${name}" /></span>
        <span class="sd-tac-combatant-info">
          <span class="sd-tac-combatant-name">${name}</span>
          ${hp ? `<span class="sd-tac-combatant-hp">
            <div class="sd-tac-hp-bar">
              <div class="sd-tac-hp-fill" style="width:${hp.pct}%;background:${hp.color}"></div>
            </div>
            <span class="sd-tac-hp-text">${hp.value}/${hp.max}</span>
          </span>` : ""}
        </span>
        <span class="sd-tac-combatant-init">${init}</span>
        <button class="sd-tac-pan-btn" data-token-pan="${token.id}" title="Pan to token"><i class="fas fa-crosshairs"></i></button>
      </div>`;
    }

    html += `</div></div>`;
    return html;
  }

  _renderTokens(scene) {
    if (!scene) return "";

    const tokens = canvas?.tokens?.placeables ?? [];
    const visibleTokens = tokens.filter(t => t.document?.visible !== false && !t.document?.hidden);

    let html = `<div class="sd-tac-section"><h3 class="sd-tac-heading"><i class="fas fa-users"></i> Tokens</h3><div class="sd-tac-token-grid">`;

    const currentActorId = this._actor?.id;
    const sortedTokens = [...visibleTokens].sort((a, b) => {
      if (a.document.actor?.id === currentActorId) return -1;
      if (b.document.actor?.id === currentActorId) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    for (const token of sortedTokens) {
      const doc = token.document;
      const name = escapeHtml(doc.name || "Unknown");
      const img = escapeHtml(doc.texture?.src || doc.img || "icons/svg/mystery-man.svg");
      const actor = doc.actor;
      const hp = actor ? this._getHPInfo(actor) : null;
      const dispo = doc.disposition ?? 0;
      const isOwn = actor?.id === currentActorId;

      html += `<div class="sd-tac-token${isOwn ? " own" : ""}">
        <span class="sd-tac-token-img">
          <img src="${img}" alt="${name}" />
          <i class="fas ${DISPOSITION_ICONS[dispo] ?? "fa-question-circle"}" style="color:${DISPOSITION_COLORS[dispo] ?? "#fbbf24"};position:absolute;bottom:-2px;right:-2px;font-size:10px;text-shadow:0 0 3px #000"></i>
        </span>
        <span class="sd-tac-token-name">${name}</span>
        ${hp ? `<span class="sd-tac-token-hp">
          <div class="sd-tac-hp-bar">
            <div class="sd-tac-hp-fill" style="width:${hp.pct}%;background:${hp.color}"></div>
          </div>
          <span class="sd-tac-hp-text">${hp.value}/${hp.max}</span>
        </span>` : ""}
      </div>`;
    }

    html += `</div></div>`;
    return html;
  }

  _getHPInfo(actor) {
    const hp = actor.system?.attributes?.hp;
    if (!hp) return null;
    const value = hp.value ?? 0;
    const max = hp.max ?? 1;
    const temp = hp.temp ?? 0;
    const effective = value + temp;
    const pct = max > 0 ? Math.min((effective / max) * 100, 100) : 0;
    const color = pct <= 25 ? "#ff6b6b" : pct <= 50 ? "#fb923c" : pct <= 75 ? "#fbbf24" : "#4ade80";
    return { value: effective, max, pct, color };
  }

  destroy() {
    this._hookIds.forEach(id => Hooks.off(id));
    this._hookIds = [];
    this._containerEl = null;
    this._actor = null;
    super.destroy();
  }
}
