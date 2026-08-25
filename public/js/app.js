// Starlight Fleet Observatory & Agent Pet Client
document.addEventListener('DOMContentLoaded', () => {
  let petRenderer = null;
  let ws = null;
  let fleetState = null;

  // Initialize Canvas Pet
  if (document.getElementById('pet-canvas')) {
    petRenderer = new window.PetRenderer('pet-canvas');
  }

  // DOM Elements
  const petContainer = document.getElementById('floating-pet-container');
  const petBubble = document.getElementById('pet-bubble');
  const petStatusText = document.getElementById('pet-status-text');
  const dynamicIsland = document.getElementById('dynamic-island');
  const islandStatus = document.getElementById('island-status');
  const islandVelocity = document.getElementById('island-velocity');

  // Metrics
  const metricTodayCost = document.getElementById('metric-today-cost');
  const metricTodayTokens = document.getElementById('metric-today-tokens');
  const metricVelocity = document.getElementById('metric-velocity');
  const metricActiveSessions = document.getElementById('metric-active-sessions');
  const metricSavings = document.getElementById('metric-savings');
  const sessionsList = document.getElementById('sessions-list');
  const permissionsContainer = document.getElementById('permissions-container');

  // Progression
  const userLevel = document.getElementById('user-level');
  const userGate = document.getElementById('user-gate');
  const xpText = document.getElementById('xp-text');
  const xpFill = document.getElementById('xp-fill');

  // Setup Dragging
  initDraggable(petContainer);

  // Setup Skin Picker Buttons
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      const skin = target.dataset.skin;
      target.classList.add('active');
      if (petRenderer) petRenderer.setSkin(skin);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'SET_SKIN', skin }));
      }
    });
  });

  // Sound Toggle
  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      const isEnabled = petRenderer ? !petRenderer.audio.enabled : false;
      if (petRenderer) petRenderer.audio.enabled = isEnabled;
      soundBtn.textContent = isEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      fetch('/api/pet/sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: isEnabled })
      }).catch(() => {});
    });
  }

  // Connect WebSocket
  connectWebSocket();

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:9224';
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
      console.log('[Starlight HUD] Connected to live telemetry stream');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'FLEET_STATE') {
          fleetState = msg.payload;
          updateUI(fleetState);
        } else if (msg.type === 'PET_POKED') {
          if (petRenderer) petRenderer.triggerPoke();
        }
      } catch (err) {
        console.error('Error parsing telemetry message:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }

  function updateUI(state) {
    if (!state) return;

    // 1. Update Pet Renderer
    if (petRenderer) {
      petRenderer.setState(state.overallState);
      petRenderer.setVelocity(state.currentFleetVelocity);
      petRenderer.setSubagents(state.activeSubagentsTotal);
      if (state.pet?.skin) petRenderer.setSkin(state.pet.skin);
    }

    // 2. Update Pet Bubble & Status Pill
    if (petBubble) {
      petBubble.textContent = state.pet?.speechBubble || state.pet?.currentMood || 'All fleets nominal';
    }
    if (petStatusText) {
      petStatusText.textContent = `${state.overallState.toUpperCase()} • ${state.currentFleetVelocity} tok/s`;
    }

    // 3. Update Dynamic Island
    if (islandStatus) {
      islandStatus.textContent = `${state.activeSessions.length} Active Fleet • ${state.overallState.toUpperCase()}`;
    }
    if (islandVelocity) {
      islandVelocity.textContent = `${state.currentFleetVelocity} tok/s`;
    }

    // 4. Update Metrics
    const today = state.historicalSummary?.today;
    if (today) {
      if (metricTodayCost) metricTodayCost.textContent = `$${today.totalCostUSD.toFixed(4)}`;
      if (metricTodayTokens) metricTodayTokens.textContent = today.totalTokens.toLocaleString();
    }
    if (metricVelocity) metricVelocity.textContent = `${state.currentFleetVelocity} tok/s`;
    if (metricActiveSessions) metricActiveSessions.textContent = state.activeSessions.length.toString();
    if (metricSavings && state.historicalSummary) {
      metricSavings.textContent = `$${(state.historicalSummary.totalAllTimeSavingsUSD || 0).toFixed(2)}`;
    }

    // 5. Update Progression & Arcanea Gate
    if (state.pet) {
      if (userLevel) userLevel.textContent = `Level ${state.pet.level}`;
      if (userGate) userGate.textContent = state.pet.arcaneaGate;
      if (xpText) xpText.textContent = `${state.pet.currentXP} / ${state.pet.nextLevelXP} XP`;
      if (xpFill) {
        const pct = Math.min(100, (state.pet.currentXP / state.pet.nextLevelXP) * 100);
        xpFill.style.width = `${pct}%`;
      }
    }

    // 6. Update Pending Permissions Card
    if (permissionsContainer) {
      renderPermissions(state.pendingPermissions || []);
    }

    // 7. Update Fleet Sessions List
    if (sessionsList) {
      renderSessions(state.activeSessions);
    }
  }

  function renderPermissions(perms) {
    if (!perms || perms.length === 0) {
      permissionsContainer.style.display = 'none';
      return;
    }

    permissionsContainer.style.display = 'block';
    permissionsContainer.innerHTML = perms.map(p => `
      <div class="glass-panel" style="padding: 16px; border: 1px solid var(--amber-glow); background: rgba(245, 158, 11, 0.1); margin-bottom: 18px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 20px;">⚡</div>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #fff;">Permission Requested: ${escapeHtml(p.toolName)}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(p.description)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-approve" onclick="handlePermissionAction('${p.id}', 'approve')">✓ Approve</button>
          <button class="btn-deny" onclick="handlePermissionAction('${p.id}', 'deny')">✕ Deny</button>
        </div>
      </div>
    `).join('');
  }

  window.handlePermissionAction = function(id, action) {
    fetch(`/api/permission/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).then(() => {
      if (petRenderer) petRenderer.triggerPoke();
    }).catch(console.error);
  };

  function renderSessions(sessions) {
    if (!sessions || sessions.length === 0) {
      sessionsList.innerHTML = '<div class="glass-panel" style="padding: 24px; text-align: center; color: var(--text-muted);">No active CLI sessions detected. Start Claude Code, Codex, Antigravity or Hermes.</div>';
      return;
    }

    sessionsList.innerHTML = sessions.map(s => {
      const isHealthy = s.context.warningLevel === 'healthy';
      const ctxClass = isHealthy ? 'ctx-healthy' : s.context.warningLevel === 'high' ? 'ctx-high' : 'ctx-critical';
      const harnessClass = `harness-${s.harness}`;
      const activeToolHtml = s.activeTool ? `<div style="font-size: 11px; color: var(--cyan-glow); margin-top: 4px;">⚡ Tool: <strong>${escapeHtml(s.activeTool.name)}</strong> (${escapeHtml(s.activeTool.summary || '')})</div>` : '';
      const savingsHtml = s.savings && s.savings.cacheSavingsUSD > 0 
        ? `<span style="color: var(--emerald-glow); margin-left: 8px;">(Saved: $${s.savings.cacheSavingsUSD.toFixed(3)})</span>` 
        : '';

      return `
        <div class="glass-panel session-card">
          <div class="session-header">
            <div>
              <span class="session-harness-badge ${harnessClass}">${s.harness}</span>
              <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">${escapeHtml(s.modelDisplayName || s.model)}</span>
            </div>
            <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">${timeAgo(s.lastActiveAt)}</span>
          </div>

          <div>
            <div class="session-proj-name">${escapeHtml(s.projectName)}</div>
            <div style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); margin-top: 2px;">Branch: ${escapeHtml(s.gitBranch || 'main')} • ${escapeHtml(s.machineTag || '@frank-desktop')}</div>
          </div>

          <div class="session-task">
            ${escapeHtml(s.currentTask || 'Idle / Waiting for instructions')}
          </div>

          ${activeToolHtml}

          <div class="context-bar-container">
            <div class="context-bar-label">
              <span>Context Saturation</span>
              <span>${s.context.usedPercentage}% (${s.tokens.totalTokens.toLocaleString()} tok)</span>
            </div>
            <div class="context-bar-bg">
              <div class="context-bar-fill ${ctxClass}" style="width: ${s.context.usedPercentage}%;"></div>
            </div>
          </div>

          <div class="session-stats-row">
            <span>Tokens: <strong>${s.tokens.totalTokens.toLocaleString()}</strong></span>
            <span>Cost: <strong>$${s.cost.totalCostUSD.toFixed(4)}</strong> ${savingsHtml}</span>
            <span>State: <strong style="color: var(--cyan-glow);">${s.state.toUpperCase()}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  function initDraggable(el) {
    if (!el) return;
    let isDragging = false;
    let startX, startY, origX, origY;

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${origX + dx}px`;
      el.style.top = `${origY + dy}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
