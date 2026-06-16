# Handover — simpleDisplay Release Process

## Release workflow (manual)
1. **Update `module.json`**:
   - Bump `"version"` to next sequential tag (e.g. `v0.3.0` → `v0.4.0`)
   - Update `"download"` to match: `https://github.com/JaumeHV/simpleDisplay/releases/download/v0.X.0/module.zip`
   - `"manifest"` stays as `https://github.com/JaumeHV/simpleDisplay/releases/latest/download/module.json`

2. **Build `module.zip`**:
   - Delete old `module.zip` if present
   - Run (from repo root):
     ```
     Compress-Archive -Path "scripts", "styles", "assets", "module.json" -DestinationPath "module.zip" -Force
     ```

3. **Commit & Tag**:
   ```
   git add module.json
   git commit -m "chore: bump to v0.X.0"
   git tag v0.X.0
   git push
   git push origin v0.X.0
   ```

4. **Create GitHub release with assets**:
   ```
   gh release create v0.X.0 --title "v0.X.0" --notes "<release notes>" "module.json#Manifest JSON" "module.zip#Module Package"
   ```

## Release asset URLs
- **Manifest (Foundry reads this)**: `https://github.com/JaumeHV/simpleDisplay/releases/latest/download/module.json`
- **Download (zip)**: `https://github.com/JaumeHV/simpleDisplay/releases/download/v0.X.0/module.zip`

## Module structure
```
simpleDisplay/
├── scripts/
│   ├── main.js          # Entry point
│   ├── app.js           # DisplayApp (ApplicationV2)
│   ├── settings.js      # Module settings
│   └── panels/
│       ├── PanelBase.js
│       ├── InventoryPanel.js
│       ├── ChatPanel.js
│       ├── SpellsPanel.js
│       ├── TacMapPanel.js
│       ├── TradePanel.js
│       └── Panel6.js
├── styles/
│   └── display.css
├── assets/icons/
├── module.json
└── .opencode/handover.md
```

## Key Foundry details
- Targets Foundry VTT v14 only (verified: 14.363)
- dnd5e system v5.3.3
- ApplicationV2 (NOT HandlebarsApplicationMixin)
- Custom `_replaceHTML` and `_onClickAction` overrides in `app.js`
