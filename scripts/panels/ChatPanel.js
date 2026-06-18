import { PanelBase, escapeHtml } from "./PanelBase.js";

const MAX_MESSAGES = 60;

export class ChatPanel extends PanelBase {
  static panelId = "chat";
  static panelLabel = "Chat";
  static panelIcon = "fas fa-comment-dots";

  constructor(display) {
    super(display);
    this._containerEl = null;
    this._actor = null;
    this._hookId = null;
    this._updateHookId = null;
    this._autoScroll = true;
    this._detailEl = null;
    this._usedActions = new Set();
  }

  async render(actor, containerEl) {
    this._containerEl = containerEl;
    this._actor = actor;

    containerEl.innerHTML = `
      <div class="sd-chat-panel">
        <div class="sd-chat-toolbar">
          <button class="sd-chat-scroll-btn" id="sd-chat-scroll-toggle" title="Scroll to latest">
            <i class="fas fa-arrow-down"></i> Latest
          </button>
        </div>
        <div class="sd-chat-scroll" id="sd-chat-scroll"></div>
      </div>
    `;

    const scrollEl = containerEl.querySelector("#sd-chat-scroll");
    this._rebuild();

    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      scrollEl.addEventListener("scroll", () => {
        const atBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 50;
        this._autoScroll = atBottom;
        const toggle = containerEl.querySelector("#sd-chat-scroll-toggle");
        if (toggle) toggle.classList.toggle("active", atBottom);
      });
    }

    containerEl.querySelector("#sd-chat-scroll-toggle")?.addEventListener("click", () => {
      this._autoScroll = true;
      const el = containerEl.querySelector("#sd-chat-scroll");
      if (el) el.scrollTop = el.scrollHeight;
    });

    this._hookId = Hooks.on("createChatMessage", () => this._rebuild(true));
    this._updateHookId = Hooks.on("updateChatMessage", () => this._rebuild(false));
  }

  _rebuild(scrollToBottom = false) {
    if (!this._containerEl) return;
    const scrollEl = this._containerEl.querySelector("#sd-chat-scroll");
    if (!scrollEl) return;

    const messages = game.messages?.contents ?? [];
    const recent = messages.slice(-MAX_MESSAGES);

    scrollEl.innerHTML = "";

    if (!recent.length) {
      scrollEl.innerHTML = `<div class="sd-chat-empty">
        <i class="fas fa-comment-dots"></i>
        <p>No messages</p>
      </div>`;
      return;
    }

    for (const msg of recent) {
      const card = this._buildCard(msg);
      if (card) scrollEl.appendChild(card);
    }

    if (this._autoScroll || scrollToBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  _getTypes() {
    return CONST?.CHAT_MESSAGE_TYPES ?? { IC: 2, OOC: 1, ROLL: 3, COMBAT: 5 };
  }

  /**
   * Build a chat card element. Parses the rendered message content to extract
   * the dnd5e chat-card structure (icon, title, subtitle, description, pills,
   * action buttons). Falls back to a plain text card for non-item messages.
   */
  _buildCard(msg) {
    const speaker = msg.alias || msg.speaker?.alias || msg.author?.name || "Unknown";
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const selfCls = msg.speaker?.actor && this._actor?.id === msg.speaker.actor ? " sd-chat-card-self" : "";

    // Parse the rendered HTML content into a DOM fragment.
    const parser = document.createElement("div");
    parser.innerHTML = msg.content ?? "";
    const chatCard = parser.querySelector(".chat-card");

    const card = document.createElement("div");
    card.className = `sd-chat-card${selfCls}`;

    if (chatCard) {
      this._buildItemCard(card, msg, chatCard, speaker, time);
    } else {
      this._buildTextCard(card, msg, parser, speaker, time);
    }

    return card;
  }

  _buildItemCard(card, msg, chatCard, speaker, time) {
    const img = chatCard.querySelector(".gold-icon, img")?.getAttribute("src") || "icons/svg/mystery-man.svg";
    const title = chatCard.querySelector(".title")?.textContent?.trim() || msg.flavor || speaker;
    const subtitle = chatCard.querySelector(".subtitle")?.innerHTML?.trim() || "";
    const descEl = chatCard.querySelector(".card-content .wrapper, .card-content");
    const descHtml = descEl?.innerHTML?.trim() || "";

    // Property pills (RITUAL, V/S/M, durations, ranges, etc.). Read .label when
    // present, otherwise the pill text — but never both (avoids duplicates).
    const pills = this._extractPills(chatCard);

    // Supplement lines (e.g. Materials).
    const supplements = [...chatCard.querySelectorAll(".supplement")]
      .map(s => s.innerHTML.trim())
      .filter(Boolean);

    // Roll results carried by this message (attack/damage/save totals).
    const rollHtml = this._renderRolls(msg);

    // Real action buttons — preserve their data-* attributes so native handlers fire.
    const buttons = [...chatCard.querySelectorAll(".card-buttons button, button[data-action]")];

    card.innerHTML = `
      <div class="sd-chat-card-thumb"><img src="${img}" alt="" loading="lazy"></div>
      <div class="sd-chat-card-content">
        <div class="sd-chat-card-head">
          <span class="sd-chat-card-title">${escapeHtml(title)}</span>
          <span class="sd-chat-card-time">${speaker ? escapeHtml(speaker) + " · " : ""}${time}</span>
        </div>
        ${subtitle ? `<div class="sd-chat-card-subtitle">${subtitle}</div>` : ""}
        ${rollHtml ? `<div class="sd-chat-card-rolls">${rollHtml}</div>` : ""}
        ${descHtml ? `<div class="sd-chat-card-desc">${descHtml}</div>` : ""}
        ${supplements.length ? `<div class="sd-chat-card-supplements">${supplements.map(s => `<div class="sd-chat-card-supplement">${s}</div>`).join("")}</div>` : ""}
        ${pills.length ? `<div class="sd-chat-card-pills">${pills.map(p => `<span class="sd-chat-pill">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="sd-chat-card-divider"></div>
      <div class="sd-chat-card-actions"></div>
    `;

    const actionsEl = card.querySelector(".sd-chat-card-actions");
    if (buttons.length) {
      for (const btn of buttons) {
        const clone = btn.cloneNode(true);
        clone.classList.add("sd-chat-action-btn");
        actionsEl.appendChild(clone);
      }
      // Wire up native dnd5e behavior on the cloned buttons.
      this._wireNativeListeners(msg, actionsEl, msg.id);
    } else {
      actionsEl.innerHTML = `<div class="sd-chat-card-noactions">—</div>`;
    }

    // Tap the title (or description) to open the full-text popup.
    if (descHtml || subtitle) {
      const open = () => this._openDetail({ img, title, subtitle, descHtml, supplements, pills, rollHtml });
      card.querySelector(".sd-chat-card-title")?.addEventListener("click", open);
      card.querySelector(".sd-chat-card-desc")?.addEventListener("click", open);
    }
  }

  _extractPills(chatCard) {
    const out = [];
    const seen = new Set();
    for (const pill of chatCard.querySelectorAll(".card-footer .pill")) {
      const label = pill.querySelector(".label");
      const text = (label ? label.textContent : pill.textContent).trim();
      if (text && !seen.has(text)) { seen.add(text); out.push(text); }
    }
    return out;
  }

  /**
   * Render roll totals + formulas carried by a message into compact HTML.
   * @returns {string}
   */
  _renderRolls(msg) {
    const rolls = msg.rolls ?? [];
    if (!rolls.length) return "";
    let html = "";
    for (const roll of rolls) {
      try {
        const total = roll.total ?? "?";
        const formula = roll.formula ?? "";
        const flavor = roll.options?.flavor || roll.options?.type || "";
        const dice = (roll.dice ?? []).map(d => {
          const faces = `d${d.faces}`;
          const results = (d.results ?? []).map(r => {
            const cls = r.discarded ? "discard" : r.rerolled ? "reroll" : "";
            const crit = (d.faces === 20 && r.result === 20) ? "max" : (d.faces === 20 && r.result === 1) ? "min" : "";
            return `<span class="sd-die ${cls} ${crit}">${r.result}</span>`;
          }).join("");
          return `<span class="sd-die-group" title="${escapeHtml(faces)}">${results}</span>`;
        }).join("");
        html += `<div class="sd-chat-roll">
          ${flavor ? `<span class="sd-chat-roll-flavor">${escapeHtml(String(flavor))}</span>` : ""}
          <span class="sd-chat-roll-formula">${escapeHtml(formula)}</span>
          ${dice ? `<span class="sd-chat-roll-dice">${dice}</span>` : ""}
          <span class="sd-chat-roll-total">${escapeHtml(String(total))}</span>
        </div>`;
      } catch (err) {
        console.warn("Simple Display: roll render error", err);
      }
    }
    return html;
  }

  _openDetail(data) {
    if (!this._containerEl) return;
    this._closeDetail();
    const overlay = document.createElement("div");
    overlay.className = "sd-chat-detail-overlay";
    overlay.innerHTML = `
      <div class="sd-chat-detail">
        <button type="button" class="sd-chat-detail-close" title="Close"><i class="fas fa-times"></i></button>
        <div class="sd-chat-detail-header">
          <img src="${data.img}" alt="" class="sd-chat-detail-icon">
          <div>
            <div class="sd-chat-detail-title">${escapeHtml(data.title)}</div>
            ${data.subtitle ? `<div class="sd-chat-detail-subtitle">${data.subtitle}</div>` : ""}
          </div>
        </div>
        ${data.rollHtml ? `<div class="sd-chat-card-rolls">${data.rollHtml}</div>` : ""}
        ${data.descHtml ? `<div class="sd-chat-detail-desc">${data.descHtml}</div>` : ""}
        ${data.supplements?.length ? `<div class="sd-chat-card-supplements">${data.supplements.map(s => `<div class="sd-chat-card-supplement">${s}</div>`).join("")}</div>` : ""}
        ${data.pills?.length ? `<div class="sd-chat-card-pills">${data.pills.map(p => `<span class="sd-chat-pill">${escapeHtml(p)}</span>`).join("")}</div>` : ""}
      </div>
    `;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest(".sd-chat-detail-close")) this._closeDetail();
    });
    this._containerEl.querySelector(".sd-chat-panel")?.appendChild(overlay);
    this._detailEl = overlay;
  }

  _closeDetail() {
    this._detailEl?.remove();
    this._detailEl = null;
  }

  _buildTextCard(card, msg, parser, speaker, time) {
    const T = this._getTypes();
    const isRoll = msg.type === T.ROLL || msg.rolls?.length;
    const isWhisper = msg.isWhisper;
    const isCombat = msg.type === T.COMBAT;

    // dnd5e tags roll messages with their kind (attack / damage).
    const rollKind = msg.getFlag?.("dnd5e", "roll")?.type ?? null;

    let icon, typeLabel;
    if (rollKind === "attack") { icon = "fa-crosshairs"; typeLabel = "Attack"; }
    else if (rollKind === "damage") { icon = "fa-burst"; typeLabel = "Damage"; }
    else if (isRoll) { icon = "fa-dice-d20"; typeLabel = "Roll"; }
    else if (isWhisper) { icon = "fa-mask"; typeLabel = "Whisper"; }
    else if (isCombat) { icon = "fa-swords"; typeLabel = "Combat"; }
    else { icon = "fa-comment"; typeLabel = "Chat"; }

    const kindCls = rollKind ? ` sd-chat-card-${rollKind}` : (isRoll ? " sd-chat-card-roll" : "");
    card.classList.add(...kindCls.trim().split(/\s+/).filter(Boolean));

    const flavor = msg.flavor ? `<div class="sd-chat-card-subtitle">${msg.flavor}</div>` : "";
    const rollHtml = this._renderRolls(msg);

    // Strip the raw rendered dice block from the text content when we already
    // render rolls ourselves, to avoid showing the unstyled native markup.
    parser.querySelectorAll(".dice-roll").forEach(el => el.remove());
    const content = parser.innerHTML.trim();

    // The combined total of all rolls — shown in the action column for rolls.
    const total = isRoll ? this._rollTotal(msg) : null;

    card.innerHTML = `
      <div class="sd-chat-card-thumb"><i class="fas ${icon}"></i></div>
      <div class="sd-chat-card-content">
        <div class="sd-chat-card-head">
          <span class="sd-chat-card-title">${escapeHtml(speaker)}</span>
          <span class="sd-chat-card-time">${time}</span>
        </div>
        ${flavor}
        ${rollHtml ? `<div class="sd-chat-card-rolls">${rollHtml}</div>` : ""}
        ${content ? `<div class="sd-chat-card-desc sd-chat-card-text">${content}</div>` : ""}
      </div>
      <div class="sd-chat-card-divider"></div>
      <div class="sd-chat-card-actions">
        <span class="sd-chat-tag-hidden" data-type="${typeLabel}" hidden></span>
        ${total !== null
          ? `<div class="sd-chat-total"><span class="sd-chat-total-label">${typeLabel}</span><span class="sd-chat-total-num">${escapeHtml(String(total))}</span></div>`
          : `<span class="sd-chat-pill sd-chat-pill-type">${typeLabel}</span>`}
      </div>
    `;

    if (content || rollHtml) {
      const open = () => this._openDetail({
        img: "icons/svg/d20.svg",
        title: speaker,
        subtitle: msg.flavor || "",
        descHtml: content,
        rollHtml
      });
      card.querySelector(".sd-chat-card-title")?.addEventListener("click", open);
    }
  }

  /** Sum of all roll totals on a message. */
  _rollTotal(msg) {
    const rolls = msg.rolls ?? [];
    if (!rolls.length) return null;
    return rolls.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }

  _wireNativeListeners(msg, actionsEl, msgId) {
    let nativeWired = false;
    try {
      const activity = msg.getAssociatedActivity?.();
      if (activity?.activateChatListeners) {
        activity.activateChatListeners(msg, actionsEl);
        nativeWired = true;
      }
    } catch (err) {
      console.warn("Simple Display: could not wire native chat listeners", err);
    }

    actionsEl.querySelectorAll(".sd-chat-action-btn").forEach(btn => {
      const action = btn.dataset.action;
      const key = `${msgId}:${action}`;

      // Re-apply persisted used state across rebuilds.
      if (this._usedActions.has(key)) btn.classList.add("sd-chat-action-used");

      // Fallback click dispatch when native wiring was unavailable.
      if (!nativeWired) {
        btn.addEventListener("click", () => this._fallbackButtonClick(msg, btn));
      }
      // Grey the button once its action actually resolves.
      btn.addEventListener("click", () => this._markUsedOnResolve(key, btn));
    });
  }

  /**
   * Grey a button only after its action resolves (a chat message / roll / use
   * event fires shortly after the click). A cancelled dialog produces none of
   * these, so the button stays active.
   * @param {string} key  `${msgId}:${action}` — persisted across rebuilds.
   * @param {HTMLElement} btn
   */
  _markUsedOnResolve(key, btn) {
    if (btn.classList.contains("sd-chat-action-used")) return;
    const events = ["createChatMessage", "dnd5e.rollAttackV2", "dnd5e.rollDamageV2", "dnd5e.postUseActivity"];
    const ids = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      for (const [name, id] of ids) Hooks.off(name, id);
      clearTimeout(timer);
    };
    const resolve = () => {
      btn.classList.add("sd-chat-action-used");
      this._usedActions.add(key);
      finish();
    };
    for (const name of events) ids.push([name, Hooks.once(name, resolve)]);
    const timer = setTimeout(finish, 6000);
  }

  _fallbackButtonClick(msg, clonedBtn) {
    const action = clonedBtn.dataset.action;
    const original = document.querySelector(`#chat-log [data-message-id="${msg.id}"] button[data-action="${action}"]`);
    if (original) original.click();
  }

  destroy() {
    if (this._hookId) { Hooks.off("createChatMessage", this._hookId); this._hookId = null; }
    if (this._updateHookId) { Hooks.off("updateChatMessage", this._updateHookId); this._updateHookId = null; }
    this._closeDetail();
    this._containerEl = null;
    this._actor = null;
    super.destroy();
  }
}
