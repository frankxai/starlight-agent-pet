// Starlight Agent Pet - High-Performance Canvas Animation & Particle Engine + Web Audio Synth

class WebAudioSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc2.frequency.setValueAtTime(1318.51, now); // E6

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  playLevelUp() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.09, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
  }

  playAlert() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.2);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playPurr() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.15);
    osc.frequency.linearRampToValueAtTime(110, now + 0.3);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }
}

class PetRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Internal resolution for retina display
    this.dpr = window.devicePixelRatio || 1;
    this.width = 140;
    this.height = 140;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.skin = 'stellaris';
    this.state = 'idle';
    this.tokenVelocity = 0; // tokens/sec
    this.subagentCount = 0;
    this.audio = new WebAudioSynth();

    this.time = 0;
    this.particles = [];
    this.pokeAnimation = 0;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;

    this.initEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initEvents() {
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left);
      this.mouseY = (e.clientY - rect.top);
    });

    this.canvas.addEventListener('click', () => {
      this.triggerPoke();
    });
  }

  setSkin(skin) {
    this.skin = skin;
  }

  setState(state) {
    if (this.state !== state) {
      if (state === 'approval_required' || state === 'low_context_alert') {
        this.audio.playAlert();
      } else if (state === 'idle' && this.state === 'coding') {
        this.audio.playChime();
      }
    }
    this.state = state;
  }

  setVelocity(vel) {
    this.tokenVelocity = vel;
  }

  setSubagents(count) {
    this.subagentCount = count;
  }

  triggerPoke() {
    this.pokeAnimation = 1.0;
    this.audio.playPurr();
    // Spawn celebratory particles
    for (let i = 0; i < 16; i++) {
      this.spawnParticle(
        this.width / 2, 
        this.height / 2, 
        (Math.random() - 0.5) * 4, 
        (Math.random() - 0.5) * 4 - 2, 
        Math.random() > 0.5 ? '#00f0ff' : '#a855f7'
      );
    }
  }

  spawnParticle(x, y, vx, vy, color) {
    this.particles.push({
      x, y, vx, vy,
      color,
      alpha: 1.0,
      size: Math.random() * 3 + 1.5,
      life: 1.0
    });
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;
      p.size *= 0.96;
      if (p.alpha <= 0 || p.size <= 0.2) {
        this.particles.splice(i, 1);
      }
    }
  }

  renderParticles() {
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  animate() {
    this.time += 0.03;
    if (this.pokeAnimation > 0) {
      this.pokeAnimation = Math.max(0, this.pokeAnimation - 0.03);
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    // Spawn ambient particle trails based on token velocity
    const spawnChance = Math.min(0.8, 0.05 + (this.tokenVelocity / 100));
    if (Math.random() < spawnChance) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 35;
      const px = this.width / 2 + Math.cos(angle) * radius;
      const py = this.height / 2 + Math.sin(angle) * radius;
      this.spawnParticle(px, py, (Math.random() - 0.5) * 1.5, -Math.random() * 1.5 - 0.5, '#00f0ff');
    }

    // Render active skin
    this.ctx.save();
    
    // Jump / poke bounce
    let bounceY = Math.sin(this.time * 3) * 4;
    if (this.pokeAnimation > 0) {
      bounceY -= Math.sin(this.pokeAnimation * Math.PI) * 18;
    }

    this.ctx.translate(this.width / 2, this.height / 2 + bounceY);

    if (this.skin === 'codex_bot') {
      this.drawCodexBot();
    } else if (this.skin === 'stellaris') {
      this.drawStellaris();
    } else if (this.skin === 'arcanea_luminor') {
      this.drawArcaneaLuminor();
    } else if (this.skin === 'kuro_neko') {
      this.drawKuroNeko();
    } else if (this.skin === 'starlight_queen') {
      this.drawStarlightQueen();
    } else {
      this.drawCyberBot();
    }

    // Render subagent satellites if swarming
    if (this.subagentCount > 0) {
      this.drawSubagentSatellites();
    }

    this.ctx.restore();

    // Render particles overlay
    this.updateParticles();
    this.renderParticles();

    requestAnimationFrame(this.animate);
  }

  drawStellaris() {
    const ctx = this.ctx;
    const isSleeping = this.state === 'sleeping';
    const isCoding = this.state === 'coding';
    const isThinking = this.state === 'thinking';

    const auraColor = isCoding ? '#00f0ff' : isThinking ? '#a855f7' : '#ec4899';
    ctx.save();
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 20 + Math.sin(this.time * 4) * 8;

    // Tail (undulating cosmic sine wave)
    ctx.beginPath();
    ctx.moveTo(18, 12);
    const tailWave = Math.sin(this.time * 4) * 12;
    ctx.quadraticCurveTo(45 + tailWave, 5, 38, -25 + tailWave);
    ctx.quadraticCurveTo(25, -15, 12, 5);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.85)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 8, 22, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0d111a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = auraColor;
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(0, -10, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = auraColor;
    ctx.stroke();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-16, -18);
    ctx.lineTo(-24, -36);
    ctx.lineTo(-6, -26);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = auraColor;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, -18);
    ctx.lineTo(24, -36);
    ctx.lineTo(6, -26);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = auraColor;
    ctx.stroke();

    // Inner ear glow
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.moveTo(-14, -20);
    ctx.lineTo(-20, -32);
    ctx.lineTo(-8, -25);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(14, -20);
    ctx.lineTo(20, -32);
    ctx.lineTo(8, -25);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.shadowBlur = 10;
    if (isSleeping) {
      ctx.beginPath();
      ctx.arc(-7, -10, 4, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(7, -10, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.fillStyle = '#a855f7';
      ctx.font = '11px sans-serif';
      ctx.fillText('z', 22, -20 + Math.sin(this.time * 2) * 4);
    } else {
      const eyeLookX = Math.max(-2, Math.min(2, (this.mouseX - this.width / 2) / 25));
      const eyeLookY = Math.max(-2, Math.min(2, (this.mouseY - this.height / 2) / 25));

      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.arc(-7 + eyeLookX, -10 + eyeLookY, isThinking ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.arc(7 + eyeLookX, -10 + eyeLookY, isThinking ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-6 + eyeLookX, -12 + eyeLookY, 1.2, 0, Math.PI * 2);
      ctx.arc(8 + eyeLookX, -12 + eyeLookY, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Forehead Star
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -19, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawKuroNeko() {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 18;

    // Void Shadow Cat Silhouette
    ctx.beginPath();
    ctx.ellipse(0, 6, 20, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#05070f';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cat Head
    ctx.beginPath();
    ctx.arc(0, -12, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#090d1a';
    ctx.fill();
    ctx.stroke();

    // Cat Ears
    ctx.beginPath();
    ctx.moveTo(-14, -18);
    ctx.lineTo(-20, -34);
    ctx.lineTo(-5, -27);
    ctx.closePath();
    ctx.fillStyle = '#c084fc';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(14, -18);
    ctx.lineTo(20, -34);
    ctx.lineTo(5, -27);
    ctx.closePath();
    ctx.fill();

    // Slit Glowing Eyes
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(-6, -12, 2.5, 4.5, 0.1, 0, Math.PI * 2);
    ctx.ellipse(6, -12, 2.5, 4.5, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Floating Celestial Crescent Moon
    const moonAngle = this.time * 2;
    const mx = Math.cos(moonAngle) * 30;
    const my = Math.sin(moonAngle) * 12 - 20;
    ctx.save();
    ctx.translate(mx, my);
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0.5, Math.PI * 1.5);
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawStarlightQueen() {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 22;

    // Central Geodesic Queen Core
    const rot = this.time * 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Orbiting Constellation Nodes
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI / 3);
      const r = 28 + Math.sin(this.time * 4 + i) * 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    ctx.restore();
  }

  drawArcaneaLuminor() {
    const ctx = this.ctx;
    ctx.save();
    
    const rot = this.time * 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;

    // Central Floating Crystal Octahedron
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 22);
    ctx.lineTo(-16, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00f0ff';
    ctx.stroke();

    // Inner Core
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fill();

    // Orbiting Elemental Shards
    const shards = 4;
    for (let i = 0; i < shards; i++) {
      const angle = rot + (i * (Math.PI * 2 / shards));
      const dist = 32 + Math.sin(this.time * 3 + i) * 4;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist * 0.6;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#ec4899' : '#a855f7';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  drawCyberBot() {
    const ctx = this.ctx;
    ctx.save();

    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 16;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(-18, -14, 36, 28, 6);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -24);
    ctx.strokeStyle = '#00ff88';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -26, 3, 0, Math.PI * 2);
    ctx.fillStyle = Math.sin(this.time * 6) > 0 ? '#00ff88' : '#ef4444';
    ctx.fill();

    ctx.fillStyle = '#022c22';
    ctx.beginPath();
    ctx.roundRect(-14, -8, 28, 14, 3);
    ctx.fill();

    ctx.fillStyle = '#00ff88';
    if (this.state === 'coding') {
      ctx.font = '8px monospace';
      ctx.fillText('01', -10, 2);
      ctx.fillText('10', 2, 2);
    } else if (this.state === 'thinking') {
      ctx.fillText('..', -8, 2);
      ctx.fillText('..', 4, 2);
    } else {
      ctx.fillRect(-10, -3, 6, 4);
      ctx.fillRect(4, -3, 6, 4);
    }

    if (Math.random() < 0.7) {
      this.spawnParticle(
        this.width / 2 + (Math.random() - 0.5) * 12,
        this.height / 2 + 18,
        (Math.random() - 0.5) * 0.8,
        Math.random() * 2 + 1,
        '#00ff88'
      );
    }

    ctx.restore();
  }

  drawCodexBot() {
    const ctx = this.ctx;
    ctx.save();

    // 1. Blue Puffy Cloud Head
    const cloudColor = '#4a72ff';
    const cloudDark = '#2c47c9';
    const cloudOutline = '#152473';

    ctx.save();
    // Cloud Lobes
    ctx.fillStyle = cloudColor;
    ctx.strokeStyle = cloudOutline;
    ctx.lineWidth = 3;

    // Head Base Cloud
    ctx.beginPath();
    ctx.arc(0, -14, 22, 0, Math.PI * 2); // Center
    ctx.arc(-16, -18, 16, 0, Math.PI * 2); // Left top
    ctx.arc(16, -18, 16, 0, Math.PI * 2); // Right top
    ctx.arc(-22, -6, 14, 0, Math.PI * 2); // Left bottom
    ctx.arc(22, -6, 14, 0, Math.PI * 2); // Right bottom
    ctx.arc(0, -28, 15, 0, Math.PI * 2); // Top crown
    ctx.fill();
    ctx.stroke();

    // 2. Robot Torso & Limbs
    // Legs
    ctx.fillStyle = cloudDark;
    ctx.strokeStyle = cloudOutline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-14, 22, 10, 14, 4);
    ctx.roundRect(4, 22, 10, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.fillStyle = cloudColor;
    ctx.beginPath();
    ctx.roundRect(-18, 2, 36, 24, 10);
    ctx.fill();
    ctx.stroke();

    // Arms
    const armWave = Math.sin(this.time * 4) * 3;
    ctx.beginPath();
    ctx.roundRect(-24, 6 + armWave, 8, 16, 4); // Left arm
    ctx.roundRect(16, 6 - armWave, 8, 16, 4);  // Right arm
    ctx.fill();
    ctx.stroke();

    // Chest Terminal Prompt Glyphs: > _
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('> _', -9, 17);

    // 3. Rounded Monitor Face
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = cloudOutline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-20, -22, 40, 26, 8);
    ctx.fill();
    ctx.stroke();

    // 4. Terminal Eyes: > _
    const eyeCyan = '#67e8f9';
    ctx.fillStyle = eyeCyan;
    ctx.shadowColor = eyeCyan;
    ctx.shadowBlur = 8;
    ctx.font = 'bold 14px monospace';

    if (this.state === 'thinking') {
      ctx.fillText('> ..', -14, -4);
    } else if (this.state === 'coding') {
      ctx.fillText('> =', -13, -4);
    } else if (this.state === 'sleeping') {
      ctx.fillText('- -', -11, -4);
    } else {
      // Normal: > _ (blinking cursor)
      const cursor = Math.sin(this.time * 6) > 0 ? '_' : ' ';
      ctx.fillText(`> ${cursor}`, -13, -4);
    }
    ctx.restore();

    // 5. Floating Bottom Indicators (Voice Waveform + Task Badge)
    const badgeY = 46;

    // Waveform Circle
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-14, badgeY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Waveform Bars
    ctx.fillStyle = '#ffffff';
    const waveH = Math.sin(this.time * 8) * 3;
    ctx.fillRect(-18, badgeY - 2 - waveH, 2, 4 + waveH * 2);
    ctx.fillRect(-15, badgeY - 5 + waveH, 2, 10 - waveH * 2);
    ctx.fillRect(-12, badgeY - 3 - waveH, 2, 6 + waveH * 2);
    ctx.restore();

    // Task Count Green Circle (e.g. 16 or subagent count)
    ctx.save();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(14, badgeY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#052e16';
    ctx.font = 'bold 11px sans-serif';
    const taskCount = this.subagentCount > 0 ? this.subagentCount : 16;
    ctx.fillText(taskCount.toString(), taskCount >= 10 ? 8 : 11, badgeY + 4);
    ctx.restore();

    ctx.restore();
  }

  drawSubagentSatellites() {
    const ctx = this.ctx;
    const count = Math.min(6, this.subagentCount);
    for (let i = 0; i < count; i++) {
      const angle = -this.time * 2 + (i * (Math.PI * 2 / count));
      const dist = 42;
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }
  }
}

window.PetRenderer = PetRenderer;
