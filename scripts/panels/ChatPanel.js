import { PanelBase, escapeHtml } from "./PanelBase.js";

const MAX_MESSAGES = 100;

const RARITY_COLORS = {
  common: "#a0a0a0",
  uncommon: "#1aab3a",
  rare: "#3a8aff",
  veryRare: "#8a3aff",
  legendary: "#ff8a00",
  artifact: "#ff3a3a"
};

const ATTACK_TYPES = ["mwak", "rwak", "msak", "rsak", "attack"];

export class ChatPanel extends PanelBase {
  static panelId = "chat";
  static panelLabel = "Chat";
  static panelIcon = "fas fa-comment-dots";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._hookId = null;
    this._filter = "all";
    this._autoScroll = true;
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;

    containerEl.innerHTML = `
      <div class="sd-chat-panel">
        <div class="sd-chat-toolbar">
          <div class="sd-chat-filters">
            <button class="sd-chat-filter-pill active" data-filter="all">All</button>
            <button class="sd-chat-filter-pill" data-filter="chat">Chat</button>
            <button class="sd-chat-filter-pill" data-filter="roll">Rolls</button>
            <button class="sd-chat-filter-pill" data-filter="combat">Combat</button>
            <button class="sd-chat-filter-pill" data-filter="whisper">Whisper</button>
          </div>
          <button class="sd-chat-scroll-btn" id="sd-chat-scroll-toggle" title="Auto-scroll">
            <i class="fas fa-arrow-down"></i>
          </button>
        </div>
        <div class="sd-chat-scroll" id="sd-chat-scroll">
          ${this._renderMessages()}
        </div>
      </div>
    `;

    const scrollEl = containerEl.querySelector("#sd-chat-scroll");
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      scrollEl.addEventListener("scroll", () => {
        const atBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 50;
        this._autoScroll = atBottom;
        const toggle = containerEl.querySelector("#sd-chat-scroll-toggle");
        if (toggle) toggle.classList.toggle("active", atBottom);
      });
      scrollEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".sd-chat-action-btn");
        if (!btn) return;
        this._handleAction(btn);
      });
    }

    containerEl.querySelector("#sd-chat-scroll-toggle")?.addEventListener("click", () => {
      this._autoScroll = true;
      const el = containerEl.querySelector("#sd-chat-scroll");
      if (el) el.scrollTop = el.scrollHeight;
    });

    containerEl.querySelector(".sd-chat-filters")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".sd-chat-filter-pill");
      if (!pill) return;
      this._filter = pill.dataset.filter;
      containerEl.querySelectorAll(".sd-chat-filter-pill").forEach(p => p.classList.toggle("active", p.dataset.filter === this._filter));
      const el = containerEl.querySelector("#sd-chat-scroll");
      if (el) el.innerHTML = this._renderMessages();
    });

    this._hookId = Hooks.on("createChatMessage", (msg) => {
      if (!this._containerEl) return;
      const scrollEl = this._containerEl.querySelector("#sd-chat-scroll");
      if (!scrollEl) return;
      scrollEl.innerHTML = this._renderMessages();
      if (this._autoScroll) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }

  async _handleAction(btn) {
    const action = btn.dataset.action;
    const card = btn.closest(".sd-chat-card");
    const uuid = card?.dataset.itemUuid;
    if (!uuid) return;
    const item = await fromUuid(uuid);
    if (!item) return;
    if (action === "attack" && item.rollAttack) {
      await item.rollAttack();
    } else if (action === "damage" && item.rollDamage) {
      await item.rollDamage();
    } else {
      await item.use({ legacy: false });
    }
  }

  _renderMessages() {
    const messages = game.messages?.contents ?? [];
    let filtered = this._filter === "all" ? messages : messages.filter(m => this._matchesFilter(m));
    const recent = filtered.slice(-MAX_MESSAGES);

    let html = "";
    for (const msg of recent) {
      html += this._renderMessage(msg);
    }

    return html || `<div class="sd-chat-empty">
      <i class="fas fa-comment-dots"></i>
      <p>No messages</p>
    </div>`;
  }

  _getTypes() {
    return CONST?.CHAT_MESSAGE_TYPES ?? { IC: 2, OOC: 1, ROLL: 3, COMBAT: 5 };
  }

  _matchesFilter(msg) {
    const T = this._getTypes();
    switch (this._filter) {
      case "chat": return msg.type === T.OOC || msg.type === T.IC;
      case "roll": return msg.type === T.ROLL;
      case "combat": return msg.type === T.COMBAT;
      case "whisper": return msg.isWhisper;
      default: return true;
    }
  }

  _renderMessage(msg) {
    const itemData = msg.flags?.dnd5e?.itemData;
    const itemUuid = msg.flags?.dnd5e?.item;
    if (itemData) {
      return this._renderItemCard(msg, itemData, itemUuid);
    }
    return this._renderTextCard(msg);
  }

  _renderItemCard(msg, itemData, itemUuid) {
    const name = itemData.name || "Unknown Item";
    const img = itemData.img || "icons/svg/mystery-man.svg";
    const type = itemData.type || "";
    const system = itemData.system || {};

    const rarity = system.rarity || "";
    const attunement = system.attunement || "";
    const cleanDesc = (system.description?.value || "").replace(/<[^>]*>/g, "").trim();
    const shortDesc = cleanDesc.length > 160
      ? escapeHtml(cleanDesc.substring(0, 160) + "…")
      : escapeHtml(cleanDesc);

    const actionType = system.actionType || "";
    const hasAttack = ATTACK_TYPES.includes(actionType)
      || system.activities?.some(a => ATTACK_TYPES.includes(a.actionType));

    const rarityColor = RARITY_COLORS[rarity] || null;

    let tagsHtml = `<span class="sd-chat-tag sd-chat-tag-type">${escapeHtml(type)}</span>`;
    if (rarity && rarityColor) {
      tagsHtml += `<span class="sd-chat-tag" style="background:${rarityColor}22;color:${rarityColor}">${escapeHtml(rarity)}</span>`;
    }
    if (attunement) {
      const label = attunement === "required" ? "Attune Req."
        : attunement === "attuned" ? "Attuned"
        : "Attune Opt.";
      tagsHtml += `<span class="sd-chat-tag sd-chat-tag-attune">${label}</span>`;
    }

    const speakerLabel = msg.alias || msg.speaker?.alias || msg.author?.name || "";
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    const selfCls = msg.speaker?.actor && this._actor?.id === msg.speaker.actor ? " sd-chat-card-self" : "";
    const uuidAttr = itemUuid ? ` data-item-uuid="${itemUuid}"` : "";

    return `<div class="sd-chat-card${selfCls}"${uuidAttr}>
      <div class="sd-chat-card-thumb">
        <img src="${img}" alt="${escapeHtml(name)}" loading="lazy">
      </div>
      <div class="sd-chat-card-content">
        <div class="sd-chat-card-title">${escapeHtml(name)}</div>
        <div class="sd-chat-card-tags">${tagsHtml}</div>
        <div class="sd-chat-card-desc">${shortDesc || ""}</div>
      </div>
      <div class="sd-chat-card-divider"></div>
      <div class="sd-chat-card-actions">
        ${hasAttack && itemUuid ? `<button class="sd-chat-action-btn" data-action="attack">Attack</button>` : ""}
        ${itemUuid ? `<button class="sd-chat-action-btn" data-action="damage">Damage</button>` : ""}
        <div class="sd-chat-card-speaker">${escapeHtml(speakerLabel)} · ${time}</div>
      </div>
    </div>`;
  }

  _renderTextCard(msg) {
    const alias = escapeHtml(msg.alias || msg.speaker?.alias || msg.author?.name || "Unknown");
    const content = msg.content ?? "";
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    const T = this._getTypes();
    const isRoll = msg.type === T.ROLL;
    const isWhisper = msg.isWhisper;
    const isCombat = msg.type === T.COMBAT;

    let icon, typeLabel;
    if (isRoll) { icon = "fa-dice-d20"; typeLabel = "Roll"; }
    else if (isWhisper) { icon = "fa-mask"; typeLabel = "Whisper"; }
    else if (isCombat) { icon = "fa-swords"; typeLabel = "Combat"; }
    else { icon = "fa-comment"; typeLabel = "Chat"; }

    const selfCls = msg.speaker?.actor && this._actor?.id === msg.speaker.actor ? " sd-chat-card-self" : "";

    return `<div class="sd-chat-card${selfCls}">
      <div class="sd-chat-card-thumb">
        <i class="fas ${icon}"></i>
      </div>
      <div class="sd-chat-card-content">
        <div class="sd-chat-card-title">${alias}</div>
        <div class="sd-chat-card-tags">
          <span class="sd-chat-tag sd-chat-tag-type">${typeLabel}</span>
        </div>
        <div class="sd-chat-card-desc">${content}</div>
      </div>
      <div class="sd-chat-card-divider"></div>
      <div class="sd-chat-card-actions">
        <div class="sd-chat-card-speaker">${alias} · ${time}</div>
      </div>
    </div>`;
  }

  destroy() {
    if (this._hookId) {
      Hooks.off(this._hookId);
      this._hookId = null;
    }
    this._containerEl = null;
    this._actor = null;
    super.destroy();
  }
}
