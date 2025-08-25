/**
 * @name QuickLeaveServer
 * @version 3.0.0
 * @description Custom hotkey + mouse button combo to instantly leave servers (fully customizable)
 * @author harryeffinpotter
 * @source https://github.com/harryeffinpotter/quick-leave-server
 * @updateUrl https://raw.githubusercontent.com/harryeffinpotter/quick-leave-server/main/QuickLeaveServer.plugin.js
 */

module.exports = class QuickLeaveServer {
  constructor(meta) {
    this.meta = meta;
    this.keysHeld = new Set();
    this.isRecording = false;
    this.recordedKeys = new Set();
    this.recordedMouseButton = null;
  }

  // Required plugin info methods
  getName() { return "QuickLeaveServer"; }
  getDescription() { return "Custom hotkey + mouse button combo to instantly leave servers (fully customizable)"; }
  getVersion() { return "3.0.0"; }
  getAuthor() { return "harryeffinpotter"; }
  
  // Optional load method for initialization
  load() {
    console.log('[QuickLeaveServer] Plugin loaded');
  }

  getConfigPath() {
    const path = require('path');
    // Get the directory where this plugin file is located
    const pluginPath = BdApi.Plugins.folder || path.dirname(require.main.filename);
    return path.join(pluginPath, 'QuickLeaveServer.config.json');
  }

  loadSettings() {
    const fs = require('fs');
    const configPath = this.getConfigPath();
    
    const defaults = {
      keys: ["Backspace"],
      mouseButton: 0, // 0=left, 1=middle, 2=right
      requireConfirmation: false,
      showFirstRunConfirmation: true
    };
    
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        const stored = JSON.parse(data);
        return Object.assign({}, defaults, stored);
      }
    } catch (e) {
      console.error('[QuickLeaveServer] Failed to load config:', e);
    }
    
    // Create default config if it doesn't exist
    this.settings = defaults;
    this.saveSettings();
    return defaults;
  }

  saveSettings() {
    const fs = require('fs');
    const configPath = this.getConfigPath();
    
    console.log('[QuickLeaveServer] Saving settings to:', configPath);
    console.log('[QuickLeaveServer] Settings being saved:', JSON.stringify(this.settings, null, 2));
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.settings, null, 4), 'utf8');
      console.log('[QuickLeaveServer] Settings saved successfully');
    } catch (e) {
      console.error('[QuickLeaveServer] Failed to save config:', e);
      BdApi.UI.showToast("Failed to save settings to config file", { type: "error" });
    }
  }

  start() {
    try {
      console.log('[QuickLeaveServer] Plugin starting');
      
      // If handlers already exist, remove them first to prevent duplicates
      if (this.handleKeyDown) {
        document.removeEventListener('keydown', this.handleKeyDown, true);
        document.removeEventListener('keyup', this.handleKeyUp, true);
        document.removeEventListener('mousedown', this.handleMouseDown, true);
        document.removeEventListener('contextmenu', this.handleContextMenu, true);
      }
      
      // Load settings
      this.settings = this.loadSettings();
      console.log('[QuickLeaveServer] Loaded settings:', JSON.stringify(this.settings, null, 2));
      
      // Bind event handlers (create new bound functions each time)
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleKeyUp = this.handleKeyUp.bind(this);
      this.handleMouseDown = this.handleMouseDown.bind(this);
      this.handleContextMenu = this.handleContextMenu.bind(this);
      
      // Add event listeners
      document.addEventListener('keydown', this.handleKeyDown, true);
      document.addEventListener('keyup', this.handleKeyUp, true);
      document.addEventListener('mousedown', this.handleMouseDown, true);
      document.addEventListener('contextmenu', this.handleContextMenu, true);
      
    } catch (err) {
      console.error('[QuickLeaveServer] Failed to start:', err);
      try {
        this.stop();
      } catch (e) {
        console.error('[QuickLeaveServer] Failed to stop after error:', e);
      }
    }
  }

  stop() {
    console.log('[QuickLeaveServer] Plugin stopping');
    
    // Remove event listeners
    if (this.handleKeyDown) document.removeEventListener('keydown', this.handleKeyDown, true);
    if (this.handleKeyUp) document.removeEventListener('keyup', this.handleKeyUp, true);
    if (this.handleMouseDown) document.removeEventListener('mousedown', this.handleMouseDown, true);
    if (this.handleContextMenu) document.removeEventListener('contextmenu', this.handleContextMenu, true);
    
    // Clear held keys
    if (this.keysHeld) this.keysHeld.clear();
    
    // Clear recording state
    this.isRecording = false;
    
    // Cleanup settings panel if it exists
    if (this.panelCleanup) {
      this.panelCleanup();
      this.panelCleanup = null;
    }
  }

  getSettingsPanel() {
    const panel = document.createElement("div");
    panel.style.padding = "10px";
    
    const mouseButtonNames = {
      0: "Left Click",
      1: "Middle Click",
      2: "Right Click"
    };
    
    const formatKeybind = () => {
      const keys = this.settings.keys.length > 0 ? this.settings.keys.join(" + ") : "None";
      const mouse = mouseButtonNames[this.settings.mouseButton] || "Left Click";
      return `${keys} + ${mouse}`;
    };
    
    // Create temporary settings for UI updates
    let tempSettings = Object.assign({}, this.settings);
    
    panel.innerHTML = `

      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #ffffff; font-size: 16px;">Hotkey Configuration</label>
        <div style="margin-bottom: 10px; padding: 12px; background: var(--background-secondary-alt); border-radius: 5px; border: 1px solid var(--background-tertiary);">
          <div style="margin-bottom: 15px;">
            <div style="font-size: 12px; margin-bottom: 6px; color: #b9bbbe; text-transform: uppercase; font-weight: 600;">Current Hotkey:</div>
            <div id="current-hotkey" style="font-size: 20px; font-weight: bold; color: #5865F2; padding: 8px; background: #202225; border-radius: 4px; border: 2px solid #2f3136;">${formatKeybind()}</div>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button id="qls-record" style="padding: 10px 20px; background: #5865F2; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: 500; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='#4752C4'" onmouseout="this.style.background='#5865F2'">
              🔴 Record New Hotkey
            </button>
            
            <button id="qls-reset" style="padding: 10px 20px; background: #4f545c; color: #ffffff; border: none; border-radius: 3px; cursor: pointer; font-weight: 500; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='#5d6269'" onmouseout="this.style.background='#4f545c'">
              ↺ Reset to Default
            </button>
          </div>
          
          <div id="recording-status" style="margin-top: 12px; display: none; padding: 10px; background: rgba(88, 101, 242, 0.1); border: 2px solid #5865F2; border-radius: 4px;">
            <strong style="color: #5865F2;">🔴 Recording...</strong> Hold your desired key(s) and click a mouse button to set the hotkey.
            <br><span style="font-size: 12px; color: var(--text-muted);">Press ESC to cancel</span>
            <div id="keys-held" style="margin-top: 8px; font-size: 14px; color: #dcddde;">Keys held: <span id="keys-display" style="color: #5865F2; font-weight: bold;">None</span></div>
          </div>
        </div>
        
        <div style="font-size: 13px; color: #dcddde; line-height: 1.5;">
          • You can use any keyboard key(s) + any mouse button (Left/Right/Middle)<br>
          • Examples: <code style="background: #2f3136; padding: 2px 4px; border-radius: 3px; color: #dcddde;">F + Right Click</code>, <code style="background: #2f3136; padding: 2px 4px; border-radius: 3px; color: #dcddde;">Ctrl+Shift + Middle Click</code>, <code style="background: #2f3136; padding: 2px 4px; border-radius: 3px; color: #dcddde;">Q + Left Click</code><br>
          • The mouse click will trigger the server leave action
        </div>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; cursor: pointer; color: #dcddde;">
          <input type="checkbox" id="qls-require-confirmation" ${this.settings.requireConfirmation ? "checked" : ""} style="margin-right: 8px;">
          <span>Always require confirmation before leaving</span>
        </label>
        <div style="margin-top: 5px; margin-left: 23px; font-size: 12px; color: #8e9297;">
          When enabled, always shows a confirmation dialog before leaving each server
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; cursor: pointer; color: #dcddde;">
          <input type="checkbox" id="qls-show-first-run" ${this.settings.showFirstRunConfirmation ? "checked" : ""} style="margin-right: 8px;">
          <span>Show confirmation on first/next use</span>
        </label>
        <div style="margin-top: 5px; margin-left: 23px; font-size: 12px; color: #8e9297;">
          Shows confirmation on next use
        </div>
      </div>
	  <div style="margin-bottom: 20px; padding: 12px; background: rgba(240, 71, 71, 0.1); border: 1px solid rgba(240, 71, 71, 0.3); border-radius: 5px;">
        <h3 style="color: #f04747; margin-top: 0; margin-bottom: 8px;">⚠️ Warning</h3>
        <p style="margin: 8px 0; color: #dcddde; line-height: 1.4;">In rare cases leaving many (20+) servers rapidly (within a minute) may trigger Discord's anti-hijacking protection system. This could result in:</p>
        <ul style="margin: 8px 0 8px 20px; color: #dcddde; line-height: 1.4;">
          <li>Temporary account restrictions</li>
          <li>Verification requirements</li>
        </ul>
      </div>
    `;
    
    const recordBtn = panel.querySelector("#qls-record");
    const resetBtn = panel.querySelector("#qls-reset");
    const statusDiv = panel.querySelector("#recording-status");
    const currentHotkeyDiv = panel.querySelector("#current-hotkey");
    const keysDisplay = panel.querySelector("#keys-display");
    
    const updateTempKeybind = () => {
      const keys = tempSettings.keys.length > 0 ? tempSettings.keys.join(" + ") : "None";
      const mouse = mouseButtonNames[tempSettings.mouseButton] || "Left Click";
      return `${keys} + ${mouse}`;
    };
    
    const startRecording = () => {
      this.isRecording = true;
      this.recordedKeys.clear();
      this.recordedMouseButton = null;
      recordBtn.disabled = true;
      recordBtn.innerHTML = "⏺️ Recording...";
      statusDiv.style.display = "block";
      keysDisplay.textContent = "None";
    };
    
    const stopRecording = (save = true) => {
      this.isRecording = false;
      recordBtn.disabled = false;
      recordBtn.innerHTML = "🔴 Record New Hotkey";
      statusDiv.style.display = "none";
      
      if (save && (this.recordedKeys.size > 0 || this.recordedMouseButton !== null)) {
        if (this.recordedKeys.size > 0) {
          tempSettings.keys = Array.from(this.recordedKeys);
        }
        if (this.recordedMouseButton !== null) {
          tempSettings.mouseButton = this.recordedMouseButton;
        }
        currentHotkeyDiv.textContent = updateTempKeybind();
        // Save immediately
        this.settings.keys = tempSettings.keys;
        this.settings.mouseButton = tempSettings.mouseButton;
        this.saveSettings();
        BdApi.UI.showToast("Hotkey saved!", { type: "success" });
      }
      
      this.recordedKeys.clear();
      this.recordedMouseButton = null;
    };
    
    recordBtn.onclick = startRecording;
    
    resetBtn.onclick = () => {
      tempSettings.keys = ["Backspace"];
      tempSettings.mouseButton = 0;
      currentHotkeyDiv.textContent = updateTempKeybind();
      // Save immediately
      this.settings.keys = tempSettings.keys;
      this.settings.mouseButton = tempSettings.mouseButton;
      this.saveSettings();
      BdApi.UI.showToast("Reset to default!", { type: "success" });
    };
    
    // Auto-save checkbox changes
    panel.querySelector("#qls-require-confirmation").onchange = (e) => {
      this.settings.requireConfirmation = e.target.checked;
      this.saveSettings();
      BdApi.UI.showToast("Settings saved!", { type: "success" });
    };
    
    panel.querySelector("#qls-show-first-run").onchange = (e) => {
      this.settings.showFirstRunConfirmation = e.target.checked;
      this.saveSettings();
      BdApi.UI.showToast("Settings saved!", { type: "success" });
    };
    
    // Handle recording events
    const recordKeyDown = (e) => {
      if (!this.isRecording) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if (e.key === "Escape") {
        stopRecording(false);
        return;
      }
      
      // Check for modifier keys being held
      if (e.ctrlKey && !this.recordedKeys.has("Control")) this.recordedKeys.add("Control");
      if (e.shiftKey && !this.recordedKeys.has("Shift")) this.recordedKeys.add("Shift");
      if (e.altKey && !this.recordedKeys.has("Alt")) this.recordedKeys.add("Alt");
      if (e.metaKey && !this.recordedKeys.has("Meta")) this.recordedKeys.add("Meta");
      
      // Add the actual key pressed if it's not a modifier
      const key = this.normalizeKey(e);
      if (key && !["Control", "Shift", "Alt", "Meta"].includes(key)) {
        this.recordedKeys.add(key);
      }
      
      // Update the display to show currently held keys
      if (this.recordedKeys.size > 0) {
        keysDisplay.textContent = Array.from(this.recordedKeys).join(" + ");
      }
    };
    
    const recordKeyUp = (e) => {
      if (!this.isRecording) return;
      e.preventDefault();
      e.stopPropagation();
    };
    
    const recordMouseDown = (e) => {
      if (!this.isRecording) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Record the mouse button (0-4 for left, middle, right, M4, M5)
      this.recordedMouseButton = e.button;
      
      // If no keys were held, clear the keys array to allow mouse-only hotkey
      if (this.recordedKeys.size === 0) {
        tempSettings.keys = [];
      }
      
      stopRecording(true);
    };
    
    // Handle middle mouse button via auxclick
    const recordAuxClick = (e) => {
      if (!this.isRecording) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // auxclick fires for middle mouse button
      if (e.button === 1) {
        this.recordedMouseButton = e.button;
        stopRecording(true);
      }
    };
    
    const recordContextMenu = (e) => {
      if (this.isRecording) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    document.addEventListener('keydown', recordKeyDown, true);
    document.addEventListener('keyup', recordKeyUp, true);
    document.addEventListener('mousedown', recordMouseDown, true);
    document.addEventListener('auxclick', recordAuxClick, true);
    document.addEventListener('contextmenu', recordContextMenu, true);
    
    // Cleanup function to remove listeners when panel is closed
    panel.cleanup = () => {
      document.removeEventListener('keydown', recordKeyDown, true);
      document.removeEventListener('keyup', recordKeyUp, true);
      document.removeEventListener('mousedown', recordMouseDown, true);
      document.removeEventListener('auxclick', recordAuxClick, true);
      document.removeEventListener('contextmenu', recordContextMenu, true);
      this.isRecording = false;
    };
    
    // Store cleanup function for later use
    if (this.panelCleanup) this.panelCleanup();
    this.panelCleanup = panel.cleanup;
    
    return panel;
  }

  normalizeKey(event) {
    // Don't return modifiers if they're already being held
    // This allows us to capture both modifier + regular key combos
    
    // If it's a modifier key being pressed
    if (event.key === "Control" || event.key === "Shift" || event.key === "Alt" || event.key === "Meta") {
      return event.key;
    }
    
    // Handle regular keys
    const key = event.key;
    if (key.length === 1) return key.toUpperCase();
    
    // Handle special key names
    const specialKeys = {
      " ": "Space",
      "Backspace": "Backspace",
      "Delete": "Delete",
      "Enter": "Enter",
      "Tab": "Tab",
      "Escape": "Escape",
      "ArrowUp": "Up",
      "ArrowDown": "Down",
      "ArrowLeft": "Left",
      "ArrowRight": "Right",
      "Home": "Home",
      "End": "End",
      "PageUp": "PageUp",
      "PageDown": "PageDown",
      "Insert": "Insert",
      "CapsLock": "CapsLock"
    };
    
    // Function keys
    if (key.match(/^F\d+$/)) return key;
    
    return specialKeys[key] || key;
  }

  handleKeyDown(e) {
    if (this.isRecording) return;
    
    const key = this.normalizeKey(e);
    if (key && this.settings.keys.includes(key)) {
      this.keysHeld.add(key);
      console.log('[QuickLeaveServer] Key pressed and added:', key, 'Keys held:', Array.from(this.keysHeld), 'Required:', this.settings.keys);
    }
  }

  handleKeyUp(e) {
    if (this.isRecording) return;
    
    const key = this.normalizeKey(e);
    if (key) {
      this.keysHeld.delete(key);
    }
  }

  areRequiredKeysHeld() {
    if (this.settings.keys.length === 0) return true;
    return this.settings.keys.every(key => this.keysHeld.has(key));
  }

  async handleMouseDown(event) {
    if (this.isRecording) return;
    
    // Check if this is the configured mouse button
    if (event.button !== this.settings.mouseButton) {
      console.log('[QuickLeaveServer] Wrong mouse button:', event.button, 'Expected:', this.settings.mouseButton);
      return;
    }
    
    // Check if required keys are held
    if (!this.areRequiredKeysHeld()) {
      console.log('[QuickLeaveServer] Required keys not held. Held:', Array.from(this.keysHeld), 'Required:', this.settings.keys);
      return;
    }
    
    console.log('[QuickLeaveServer] Hotkey triggered! Keys:', Array.from(this.keysHeld), 'Mouse:', event.button);

    // Check if we're clicking on a server icon
    const iconEl = event.target.closest('[data-list-item-id]');
    if (!iconEl) return;

    const raw = iconEl.getAttribute('data-list-item-id');
    const m = raw && raw.match(/\d+/);
    if (!m) return;

    const guildId = m[0];
    
    event.preventDefault();
    event.stopPropagation();
    
    // Show confirmation if enabled (with don't show again option on first use)
    if (this.settings.requireConfirmation || this.settings.showFirstRunConfirmation) {
      // Try multiple methods to get the guild name
      let guildName = "this server";
      
      // Method 1: Try BdApi Webpack modules
      const guildStore = BdApi.Webpack.getModule(m => m.getGuild && m.getGuilds) || 
                        BdApi.findModuleByProps("getGuild", "getGuilds");
      
      if (guildStore && guildStore.getGuild) {
        const guild = guildStore.getGuild(guildId);
        if (guild && guild.name) {
          guildName = guild.name;
        }
      }
      
      // Method 2: If that fails, try to get it from the DOM element
      if (guildName === "this server") {
        const guildElement = document.querySelector(`[data-list-item-id*="${guildId}"] [aria-label]`);
        if (guildElement) {
          const ariaLabel = guildElement.getAttribute("aria-label");
          if (ariaLabel) {
            guildName = ariaLabel;
          }
        }
      }
      
      // Only show checkbox if requireConfirmation is false (first run scenario)
      const showCheckbox = !this.settings.requireConfirmation && this.settings.showFirstRunConfirmation;
      const result = await this.showLeaveConfirmation(guildName, showCheckbox);
      
      if (result === "cancel") return;
      
      if (result === "never") {
        // User checked "Don't show again" - disable first run confirmation
        this.settings.requireConfirmation = false;
        this.settings.showFirstRunConfirmation = false;
        this.saveSettings();
      }
      // If result is "confirm", user either:
      // 1. Unchecked "Don't show again" - keep showFirstRunConfirmation true
      // 2. Or requireConfirmation is true (no checkbox shown) - keep settings as is
    }
    
    console.log('[QuickLeaveServer] leaving server:', guildId);

    const guildActions = BdApi.findModuleByProps('leaveGuild');
    if (!guildActions || typeof guildActions.leaveGuild !== 'function') {
      console.error('[QuickLeaveServer] Could not find leaveGuild action');
      return;
    }

    guildActions.leaveGuild(guildId);
    BdApi.showToast('Left server', { type: 'success' });
  }

  handleContextMenu(event) {
    if (this.isRecording) return;
    
    // Prevent context menu if using right-click as trigger and keys are held
    if (this.settings.mouseButton === 2 && this.areRequiredKeysHeld()) {
      const iconEl = event.target.closest('[data-list-item-id]');
      if (iconEl) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }

  showConfirmDialog(title, content, confirmText, cancelText) {
    return new Promise((resolve) => {
      BdApi.UI.showConfirmationModal(title, content, {
        confirmText: confirmText,
        cancelText: cancelText,
        danger: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }

  showLeaveConfirmation(serverName, showCheckbox) {
    return new Promise((resolve) => {
      const React = BdApi.React;
      let dontShowAgain = true; // Checkbox checked by default
      
      const content = React.createElement("div", {},
        React.createElement("p", { style: { marginBottom: showCheckbox ? "15px" : "0", color: "#dcddde" } },
          serverName === "this server" 
            ? "Are you sure you want to leave this server?" 
            : `Are you sure you want to leave "${serverName}"?`
        ),
        showCheckbox && React.createElement("label", { 
          style: { 
            display: "flex", 
            alignItems: "center", 
            cursor: "pointer",
            fontSize: "14px",
            color: "#dcddde"
          }
        },
          React.createElement("input", {
            type: "checkbox",
            defaultChecked: true,
            style: { marginRight: "8px" },
            onChange: (e) => { dontShowAgain = e.target.checked; }
          }),
          "Don't show this again"
        )
      );
      
      BdApi.UI.showConfirmationModal(
        "Leave Server?",
        content,
        {
          confirmText: "Yes",
          cancelText: "No",
          danger: true,
          onConfirm: () => {
            // Only return "never" if checkbox is shown AND checked
            if (showCheckbox && dontShowAgain) {
              resolve("never");
            } else {
              // Either checkbox not shown, or user unchecked it
              resolve("confirm");
            }
          },
          onCancel: () => resolve("cancel")
        }
      );
    });
  }
};
