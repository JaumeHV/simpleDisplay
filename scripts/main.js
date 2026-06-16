import { registerSettings } from "./settings.js";
import { DisplayApp, activeDisplays } from "./app.js";

const MODULE_ID = "simple-display";

function refreshAllDisplays() {
  for (const display of Object.values(activeDisplays)) {
    display.render(false);
  }
}

function refreshDisplaysForActor(actorId) {
  if (!actorId) return;
  for (let i = 1; i <= 4; i++) {
    const display = activeDisplays[i];
    if (!display) continue;
    if (game.settings.get(MODULE_ID, `player${i}ActorId`) === actorId) {
      display.render(false);
    }
  }
}

function openDisplay(displayIndex) {
  const existing = activeDisplays[displayIndex];
  if (existing) return existing.render(true);
  return new DisplayApp(displayIndex).render(true);
}

function buildDisplayTool(displayIndex) {
  return {
    name: `open-display-${displayIndex}`,
    title: `Open Display ${displayIndex}`,
    icon: "fas fa-tv",
    order: displayIndex,
    button: true,
    onChange: () => openDisplay(displayIndex)
  };
}

function buildDisplayTools() {
  return Object.fromEntries([1, 2, 3, 4].map((i) => {
    const tool = buildDisplayTool(i);
    return [tool.name, tool];
  }));
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | v0.1.0 initialising`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | v0.1.0 ready`);
  ui.notifications.info("Simple Display v0.1.0 loaded.");
});

Hooks.on("updateActor", (actor) => {
  refreshDisplaysForActor(actor.id);
});

Hooks.on("getSceneControlButtons", (controls) => {
  const control = {
    name: "simple-display",
    title: "Simple Display",
    icon: "fas fa-tablet-alt",
    layer: "tokens",
    order: 99,
    tools: buildDisplayTools()
  };
  if (Array.isArray(controls)) {
    controls.push(control);
  } else {
    controls["simple-display"] = control;
  }
});
