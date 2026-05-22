// ─── Utilities ────────────────────────────────────────────────────────────────

function pseudoRandom(seed) {
  let s = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return s / 0x7fffffff;
}

function lightenColor(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + Math.round(amt*255));
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + Math.round(amt*255));
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + Math.round(amt*255));
  return `rgb(${r},${g},${b})`;
}
function darkenColor(hex, amt) { return lightenColor(hex, -amt); }

const BOX_PALETTE = [
  '#E84855','#F4A259','#F9DC5C','#5BC0EB','#9BC53D','#C3423F',
  '#6B4226','#7B2D8B','#2EC4B6','#E8C1A0','#FF6B6B','#4ECDC4',
  '#D4A017','#6C5CE7','#00B894','#E17055','#74B9FF','#A29BFE',
];
const boxColor = (num) => BOX_PALETTE[Math.abs(num) % BOX_PALETTE.length];

// ─── BoxRenderer ──────────────────────────────────────────────────────────────

class BoxRenderer {
  static drawBox(ctx, x, y, w, h, options = {}) {
    const { color = '#6B4226', label = '', worn = 0, hasTapeStripe = false,
            shadow = true, glow = false } = options;
    const dark = darkenColor(color, 0.25);
    const top  = lightenColor(color, 0.18);
    const sideW = Math.max(6, w * 0.1);
    const topH  = Math.max(4, h * 0.08);

    if (glow) {
      ctx.save();
      ctx.shadowBlur = 28;
      ctx.shadowColor = '#FFD700';
    }

    if (shadow && !glow) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + w/2 + sideW/2, y + h + 3, w*0.42, 5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // Front face
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    // Right side
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x+w,   y);
    ctx.lineTo(x+w+sideW, y-topH);
    ctx.lineTo(x+w+sideW, y+h-topH);
    ctx.lineTo(x+w,   y+h);
    ctx.fill();

    // Top face
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(x,       y);
    ctx.lineTo(x+w,     y);
    ctx.lineTo(x+w+sideW, y-topH);
    ctx.lineTo(x+sideW,   y-topH);
    ctx.fill();

    // Tape stripe
    if (hasTapeStripe) {
      ctx.fillStyle = 'rgba(220,200,160,0.55)';
      ctx.fillRect(x, y + h*0.38, w, h*0.22);
      ctx.fillStyle = 'rgba(220,200,160,0.25)';
      ctx.fillRect(x, y + h*0.38, w, 2);
      ctx.fillRect(x, y + h*0.38 + h*0.22 - 2, w, 2);
    }

    // Label (white card with number)
    if (label && w > 28 && h > 22) {
      const lx = x + w*0.12, ly = y + h*0.18;
      const lw = w*0.76,     lh = h*0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(lx, ly, lw, lh);
      ctx.fillStyle = '#222';
      const fs = Math.max(7, Math.min(lh * 0.55, lw * 0.35));
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('#' + label, lx + lw/2, ly + lh/2);
    }

    // Wear marks
    if (worn > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 1;
      const seed = label ? parseInt(label) || 0 : 0;
      for (let i = 0; i < Math.floor(worn * 6); i++) {
        const rx = x + pseudoRandom(seed + i*3 + 1) * w;
        const ry = y + pseudoRandom(seed + i*3 + 2) * h;
        const rw = 5 + pseudoRandom(seed + i*3 + 3) * 22;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw, ry + pseudoRandom(seed+i)*4 - 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (glow) ctx.restore();
  }

  static generateWall(ctx, startX, startY, totalW, totalH, seedOffset = 0) {
    let x = startX;
    let num = Math.floor(pseudoRandom(seedOffset) * 8000) + 200;
    while (x < startX + totalW) {
      const colW = 44 + Math.floor(pseudoRandom(x + seedOffset) * 52);
      let y = startY + totalH;
      let localNum = num;
      while (y > startY) {
        const bh = 36 + Math.floor(pseudoRandom(y + x + seedOffset) * 44);
        y -= bh + 1;
        if (y < startY - bh) break;
        const drawY = Math.max(startY, y);
        const drawH = bh - Math.max(0, startY - y);
        BoxRenderer.drawBox(ctx, x, drawY, colW, drawH, {
          color: boxColor(localNum),
          label: String(localNum),
          worn: pseudoRandom(localNum + 7) * 0.7,
          hasTapeStripe: pseudoRandom(localNum * 3 + 5) > 0.65,
          shadow: false,
        });
        localNum++;
      }
      x += colW + 2;
      num += 20;
    }
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────

class Player {
  constructor(engine) {
    this.engine = engine;
    this.x = 400; this.y = 530;
    this.targetX = null; this.targetY = null;
    this.speed = 160;
    this.facing = 'right';
    this.isWalking = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.onArrival = null;
  }

  walkTo(x, y, callback) {
    this.targetX = x;
    this.targetY = y || this.engine.sceneManager.currentScene.playerFloorY;
    this.facing = x > this.x ? 'right' : 'left';
    this.isWalking = true;
    this.onArrival = callback || null;
  }

  update() {
    if (!this.isWalking || this.targetX === null) return;
    const dt = this.engine.dt;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 3) {
      this.x = this.targetX; this.y = this.targetY;
      this.isWalking = false;
      if (this.onArrival) { this.onArrival(); this.onArrival = null; }
      return;
    }
    const step = Math.min(this.speed * dt, dist);
    this.x += (dx/dist)*step;
    this.y += (dy/dist)*step;
    this.animTimer += dt;
    if (this.animTimer > 0.12) { this.animFrame = (this.animFrame+1)%4; this.animTimer=0; }
  }

  render(ctx) {
    const scale = 0.45 + (this.y / this.engine.canvas.height) * 0.5;
    const flip = this.facing === 'left';
    ctx.save();
    ctx.translate(this.x, this.y);
    if (flip) ctx.scale(-1, 1);
    drawCharacter(ctx, scale, this.animFrame, this.isWalking);
    ctx.restore();
  }
}

function drawCharacter(ctx, scale, frame, walking) {
  const s = scale;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18*s, 5*s, 0, 0, Math.PI*2);
  ctx.fill();

  const legAngle = walking ? Math.sin(frame * Math.PI/2) * 0.35 : 0;

  // Legs
  ctx.save();
  ctx.translate(0, -22*s);
  // Left leg
  ctx.save();
  ctx.rotate(legAngle);
  ctx.fillStyle = '#4a2e8a';
  ctx.fillRect(-10*s, 0, 8*s, 26*s);
  ctx.fillStyle = '#2a1a00';
  ctx.fillRect(-10*s, 22*s, 8*s, 6*s);
  ctx.restore();
  // Right leg
  ctx.save();
  ctx.rotate(-legAngle);
  ctx.fillStyle = '#4a2e8a';
  ctx.fillRect(2*s, 0, 8*s, 26*s);
  ctx.fillStyle = '#2a1a00';
  ctx.fillRect(2*s, 22*s, 8*s, 6*s);
  ctx.restore();
  ctx.restore();

  // Body (jacket)
  ctx.fillStyle = '#c04000';
  roundRect(ctx, -14*s, -58*s, 28*s, 40*s, 4*s);
  ctx.fill();
  // Jacket lapels
  ctx.fillStyle = '#8B2500';
  ctx.beginPath();
  ctx.moveTo(-14*s, -58*s);
  ctx.lineTo(-5*s, -42*s);
  ctx.lineTo(-14*s, -38*s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14*s, -58*s);
  ctx.lineTo(5*s, -42*s);
  ctx.lineTo(14*s, -38*s);
  ctx.fill();
  // Shirt
  ctx.fillStyle = '#f0e8c0';
  ctx.fillRect(-4*s, -57*s, 8*s, 16*s);

  // Arms
  const armSwing = walking ? Math.sin(frame * Math.PI/2 + Math.PI) * 0.4 : 0;
  ctx.save();
  ctx.translate(-14*s, -50*s);
  ctx.rotate(-armSwing - 0.1);
  ctx.fillStyle = '#c04000';
  roundRect(ctx, -6*s, 0, 10*s, 28*s, 3*s);
  ctx.fill();
  ctx.fillStyle = '#d4a470';
  ctx.beginPath();
  ctx.ellipse(-1*s, 28*s, 5*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(14*s, -50*s);
  ctx.rotate(armSwing + 0.1);
  ctx.fillStyle = '#c04000';
  roundRect(ctx, -4*s, 0, 10*s, 28*s, 3*s);
  ctx.fill();
  ctx.fillStyle = '#d4a470';
  ctx.beginPath();
  ctx.ellipse(1*s, 28*s, 5*s, 6*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Head
  ctx.fillStyle = '#d4a470';
  ctx.beginPath();
  ctx.ellipse(0, -72*s, 14*s, 16*s, 0, 0, Math.PI*2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#1a0a00';
  ctx.beginPath();
  ctx.ellipse(-5*s, -75*s, 2.5*s, 2.5*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5*s, -75*s, 2.5*s, 2.5*s, 0, 0, Math.PI*2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = '#1a0a00';
  ctx.lineWidth = 1.5*s;
  ctx.beginPath();
  ctx.arc(0, -68*s, 5*s, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Pirate hat brim
  ctx.fillStyle = '#1a0a00';
  roundRect(ctx, -18*s, -88*s, 36*s, 6*s, 2*s);
  ctx.fill();
  // Hat crown
  ctx.fillStyle = '#111';
  roundRect(ctx, -12*s, -112*s, 24*s, 26*s, 3*s);
  ctx.fill();
  // Hat skull badge
  ctx.fillStyle = '#e0d080';
  ctx.font = `${Math.round(10*s)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☠', 0, -100*s);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

// ─── Dialog System ────────────────────────────────────────────────────────────

class DialogSystem {
  constructor(engine) {
    this.engine = engine;
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.el = document.getElementById('dialog-bubble');
  }

  say(text, duration) {
    const dur = duration || Math.max(2200, text.length * 65);
    this.queue.push({ text, duration: dur });
    if (!this.current) this.next();
  }

  next() {
    if (!this.queue.length) { this.current = null; this.el.style.display='none'; return; }
    this.current = this.queue.shift();
    this.timer = this.current.duration;
    this.el.textContent = this.current.text;
    this.el.style.display = 'block';
    this.positionBubble();
  }

  update() {
    if (!this.current) return;
    this.timer -= this.engine.dt * 1000;
    if (this.timer <= 0) { this.next(); return; }
    this.positionBubble();
  }

  positionBubble() {
    const p = this.engine.player;
    const rect = this.engine.canvas.getBoundingClientRect();
    const sx = rect.width  / this.engine.canvas.width;
    const sy = rect.height / this.engine.canvas.height;
    const px = rect.left + p.x * sx;
    const py = rect.top  + p.y * sy;
    const bw = 220;
    let left = px - bw/2;
    left = Math.max(8, Math.min(window.innerWidth - bw - 8, left));
    const top = Math.max(8, py - 130 * sy);
    this.el.style.left = left + 'px';
    this.el.style.top  = top  + 'px';
  }

  clear() { this.queue = []; this.current = null; this.el.style.display='none'; }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

const ITEM_DEFS = {
  candle: {
    id: 'candle', label: 'Old Candle',
    draw(ctx, cx, cy, size) {
      const s = size/60;
      ctx.fillStyle = '#f0e8c0';
      ctx.fillRect(cx-6*s, cy-14*s, 12*s, 28*s);
      ctx.fillStyle = '#c0a040';
      ctx.fillRect(cx-8*s, cy+10*s, 16*s, 6*s);
      // Flame
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.ellipse(cx, cy-18*s, 5*s, 9*s, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(cx, cy-18*s, 3*s, 6*s, 0, 0, Math.PI*2);
      ctx.fill();
      // Wick
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1.5*s;
      ctx.beginPath(); ctx.moveTo(cx, cy-14*s); ctx.lineTo(cx, cy-12*s); ctx.stroke();
    }
  },
  box_label: {
    id: 'box_label', label: 'Box Label',
    draw(ctx, cx, cy, size) {
      const s = size/60;
      ctx.fillStyle = '#d4a86a';
      roundRect(ctx, cx-18*s, cy-12*s, 36*s, 24*s, 3*s);
      ctx.fill();
      ctx.strokeStyle = '#8B6030';
      ctx.lineWidth = 1*s;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx-14*s, cy-8*s, 28*s, 16*s);
      ctx.fillStyle = '#333';
      ctx.font = `bold ${Math.round(9*s)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BOX #41', cx, cy);
    }
  },
  attic_map: {
    id: 'attic_map', label: 'Attic Map',
    draw(ctx, cx, cy, size) {
      const s = size/60;
      ctx.fillStyle = '#e8d098';
      roundRect(ctx, cx-20*s, cy-16*s, 40*s, 32*s, 2*s);
      ctx.fill();
      ctx.strokeStyle = '#8B6030';
      ctx.lineWidth = 1*s;
      ctx.stroke();
      // Map lines
      ctx.strokeStyle = '#8B6030';
      ctx.lineWidth = 0.8*s;
      ctx.beginPath(); ctx.moveTo(cx-15*s, cy-8*s); ctx.lineTo(cx+5*s, cy-8*s);
      ctx.lineTo(cx+5*s, cy+5*s); ctx.lineTo(cx+12*s, cy+5*s); ctx.stroke();
      // X mark
      ctx.strokeStyle = '#c00';
      ctx.lineWidth = 2*s;
      ctx.beginPath(); ctx.moveTo(cx-4*s, cy-4*s); ctx.lineTo(cx+4*s, cy+4*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+4*s, cy-4*s); ctx.lineTo(cx-4*s, cy+4*s); ctx.stroke();
    }
  },
  rope_coil: {
    id: 'rope_coil', label: 'Rope Coil',
    draw(ctx, cx, cy, size) {
      const s = size/60;
      ctx.strokeStyle = '#8B5E3C';
      ctx.lineWidth = 3*s;
      for (let i = 0; i < 3; i++) {
        const r = (8 - i*2.5)*s;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6B3E1C';
      ctx.lineWidth = 2*s;
      ctx.beginPath();
      ctx.moveTo(cx+8*s, cy);
      ctx.lineTo(cx+16*s, cy-8*s);
      ctx.stroke();
    }
  },
  box_0000: {
    id: 'box_0000', label: 'Box #0000',
    draw(ctx, cx, cy, size) {
      const s = size/60;
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = '#FFD700';
      BoxRenderer.drawBox(ctx, cx-16*s, cy-14*s, 32*s, 28*s, {
        color: '#FFD700', label: '0000', shadow: false
      });
      ctx.restore();
    }
  },
};

class InventorySystem {
  constructor(engine) {
    this.engine = engine;
    this.items = [];
    this.selectedItem = null;
    this.bar = document.getElementById('inventory-bar');
    this.container = document.getElementById('inventory-items');
    this.useHint = document.getElementById('use-with-hint');
    this.bar.style.display = 'flex';
  }

  addItem(id) {
    if (this.items.find(i => i.id === id)) return;
    const def = ITEM_DEFS[id];
    if (!def) return;
    this.items.push(def);
    this.renderBar();
    this.engine.dialog.say(`Got ${def.label}!`);
  }

  removeItem(id) {
    this.items = this.items.filter(i => i.id !== id);
    if (this.selectedItem?.id === id) this.deselectItem();
    this.renderBar();
  }

  hasItem(id) { return !!this.items.find(i => i.id === id); }

  selectItem(id) {
    this.selectedItem = this.items.find(i => i.id === id) || null;
    if (this.selectedItem) this.useHint.style.display = 'block';
    this.renderBar();
  }

  deselectItem() {
    this.selectedItem = null;
    this.useHint.style.display = 'none';
    this.renderBar();
  }

  renderBar() {
    this.container.innerHTML = '';
    for (const item of this.items) {
      const div = document.createElement('div');
      div.className = 'inv-item' + (this.selectedItem?.id === item.id ? ' selected' : '');
      div.title = item.label;
      const cnv = document.createElement('canvas');
      cnv.width = 52; cnv.height = 52;
      const ctx2 = cnv.getContext('2d');
      item.draw(ctx2, 26, 26, 52);
      div.appendChild(cnv);
      const tip = document.createElement('div');
      tip.className = 'inv-tooltip';
      tip.textContent = item.label;
      div.appendChild(tip);
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedItem) {
          if (this.selectedItem.id === item.id) { this.deselectItem(); return; }
          this.engine.puzzle.tryItemCombine(this.selectedItem.id, item.id);
          this.deselectItem();
        } else {
          this.selectItem(item.id);
        }
      });
      this.container.appendChild(div);
    }
  }
}

// ─── Hotspot / VerbCoin ───────────────────────────────────────────────────────

class Hotspot {
  constructor(def) {
    this.id = def.id;
    this.label = def.label;
    this.region = def.region; // {x,y,w,h}
    this.cursor = def.cursor || 'pointer';
    this.actions = def.actions || {};
    this.condition = def.condition || null;
  }
  contains(px, py) {
    const r = this.region;
    return px >= r.x && px <= r.x+r.w && py >= r.y && py <= r.y+r.h;
  }
}

class HotspotManager {
  constructor(engine) {
    this.engine = engine;
    this.hotspots = [];
  }
  load(defs) { this.hotspots = defs.map(d => new Hotspot(d)); }
  getAt(x, y) {
    const flags = this.engine.puzzle.flags;
    for (let i = this.hotspots.length-1; i >= 0; i--) {
      const h = this.hotspots[i];
      if (h.condition && !h.condition(flags)) continue;
      if (h.contains(x, y)) return h;
    }
    return null;
  }
}

class VerbCoin {
  constructor(engine) {
    this.engine = engine;
    this.el = document.getElementById('verb-coin');
    this.visible = false;
    this.target = null;
    document.getElementById('vb-look').onclick = () => this.select('lookAt');
    document.getElementById('vb-pick').onclick = () => this.select('pickUp');
    document.getElementById('vb-use').onclick  = () => this.select('use');
    document.getElementById('vb-talk').onclick = () => this.select('talk');
  }

  show(x, y, hotspot) {
    this.target = hotspot;
    this.visible = true;
    const cw = window.innerWidth, ch = window.innerHeight;
    const ex = Math.max(80, Math.min(cw-80, x));
    const ey = Math.max(80, Math.min(ch-80, y));
    this.el.style.left = (ex-80) + 'px';
    this.el.style.top  = (ey-80) + 'px';
    this.el.style.display = 'block';
    // Grey out unavailable verbs
    ['lookAt','pickUp','use','talk'].forEach((v, i) => {
      const btn = this.el.children[i];
      btn.classList.toggle('disabled', !hotspot.actions[v]);
    });
  }

  hide() { this.visible = false; this.el.style.display = 'none'; this.target = null; }

  select(verb) {
    if (!this.target) { this.hide(); return; }
    const h = this.target;
    this.hide();
    if (!h.actions[verb]) {
      this.engine.dialog.say("I can't do that.");
      return;
    }
    const cx = h.region.x + h.region.w/2;
    const cy = this.engine.sceneManager.currentScene.playerFloorY;
    this.engine.player.walkTo(cx, cy, () => {
      if (h.actions[verb]) h.actions[verb](this.engine);
    });
  }
}

// ─── Puzzle State ─────────────────────────────────────────────────────────────

class PuzzleState {
  constructor(engine) {
    this.engine = engine;
    this.flags = {
      clue_box_7_seen:   false,
      clue_box_23_seen:  false,
      clue_box_41_seen:  false,
      has_candle:        false,
      has_box_label:     false,
      has_attic_map:     false,
      combo_lock_open:   false,
      has_rope:          false,
      box_A_roped:       false,
      box_B_roped:       false,
      staircase_built:   false,
      shelf_visited:     false,
      game_won:          false,
    };
  }

  set(flag, value = true) {
    this.flags[flag] = value;
    if (flag === 'staircase_built' && value) {
      this.engine.sceneManager.invalidateCache();
    }
    if (flag === 'has_attic_map' && value) {
      this.engine.sceneManager.invalidateCache();
    }
    if (flag === 'combo_lock_open' && value) {
      this.engine.sceneManager.invalidateCache();
    }
    if (flag === 'game_won' && value) this.triggerEnding();
  }

  tryItemCombine(idA, idB) {
    const inv = this.engine.inventory;
    const pair = [idA, idB].sort().join('+');
    if (pair === 'box_label+candle') {
      inv.removeItem('candle');
      inv.removeItem('box_label');
      inv.addItem('attic_map');
      this.set('has_attic_map');
      this.engine.dialog.say("I hold the candle under the label — invisible ink appears! It's a map! Box #23 is buried behind the east stack!");
    } else {
      this.engine.dialog.say("Those two don't seem to go together.");
    }
  }

  triggerEnding() {
    const eng = this.engine;
    eng.dialog.clear();
    eng.dialog.say("You found it! Box #0000 — the legendary NFT! It actually EXISTS!");
    setTimeout(() => {
      eng.dialog.say("...and you're holding it. In a dusty attic. Alone. Classic.");
    }, 3500);
    setTimeout(() => {
      eng.sceneManager.loadScene('ending');
    }, 7500);
  }
}

// ─── Scene Backgrounds ────────────────────────────────────────────────────────

function drawAtticBg(ctx, w, h, flags) {
  // Dark raftered ceiling
  const sky = ctx.createLinearGradient(0, 0, 0, h*0.55);
  sky.addColorStop(0, '#0d0800');
  sky.addColorStop(1, '#2a1808');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h*0.55);

  // Rafters
  ctx.strokeStyle = '#4a2e10';
  ctx.lineWidth = 18;
  for (let i = 0; i < 4; i++) {
    const rx = w * 0.1 + i * w * 0.27;
    ctx.beginPath();
    ctx.moveTo(rx, 0); ctx.lineTo(rx + 40, h*0.55);
    ctx.stroke();
  }
  ctx.strokeStyle = '#3a2008';
  ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(0, h*0.18); ctx.lineTo(w, h*0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h*0.32); ctx.lineTo(w, h*0.32); ctx.stroke();

  // Floor
  const floor = ctx.createLinearGradient(0, h*0.64, 0, h);
  floor.addColorStop(0, '#8B5E1A');
  floor.addColorStop(1, '#4a2e08');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(w*0.08, h*0.64);
  ctx.lineTo(w*0.92, h*0.64);
  ctx.lineTo(w, h); ctx.lineTo(0, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let i=1; i<5; i++) {
    const py = h*0.64 + (h - h*0.64) * i/5;
    ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(w,py); ctx.stroke();
  }
  for (let i=0; i<7; i++) {
    const px = w*i/6;
    ctx.beginPath(); ctx.moveTo(px, h*0.64); ctx.lineTo(px, h); ctx.stroke();
  }

  // High shelf
  ctx.fillStyle = '#5a3510';
  ctx.fillRect(w*0.3, h*0.28, w*0.4, 10);
  ctx.fillStyle = '#7a4a18';
  ctx.fillRect(w*0.3, h*0.28-2, w*0.4, 6);
  // Shelf supports
  ctx.fillStyle = '#4a2a08';
  ctx.fillRect(w*0.31, h*0.28, 8, 30);
  ctx.fillRect(w*0.68, h*0.28, 8, 30);
  // Hint of glowing item on shelf
  if (!flags.shelf_visited) {
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = '#FFD700';
    ctx.fillStyle = 'rgba(255,215,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(w*0.5, h*0.26, 18, 12, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // Decorative wall boxes left
  BoxRenderer.generateWall(ctx, 0, 0, w*0.18, h*0.64 + 2, 1000);
  // Decorative wall boxes right
  BoxRenderer.generateWall(ctx, w*0.82, 0, w*0.18 + 10, h*0.64 + 2, 2000);

  // Door (right area)
  ctx.fillStyle = '#4a2a08';
  ctx.fillRect(w*0.77, h*0.34, w*0.12, h*0.3);
  ctx.fillStyle = '#3a1e06';
  ctx.fillRect(w*0.78, h*0.36, w*0.10, h*0.28);
  // Door panels
  ctx.fillStyle = '#5a3514';
  ctx.fillRect(w*0.79, h*0.37, w*0.038, h*0.115);
  ctx.fillRect(w*0.828, h*0.37, w*0.038, h*0.115);
  ctx.fillRect(w*0.79, h*0.505, w*0.076, h*0.115);

  // Cabinet/chest below door area
  ctx.fillStyle = flags.combo_lock_open ? '#6a4020' : '#3a2208';
  ctx.fillRect(w*0.77, h*0.64, w*0.12, h*0.06);
  ctx.fillStyle = '#2a1606';
  ctx.strokeStyle = '#5a3510';
  ctx.lineWidth = 2;
  ctx.strokeRect(w*0.78, h*0.645, w*0.10, h*0.05);

  // Padlock on cabinet
  if (!flags.combo_lock_open) {
    drawPadlock(ctx, w*0.83, h*0.64, 24, false);
  } else {
    drawPadlock(ctx, w*0.83, h*0.64, 24, true);
    // Rope coil visible inside cabinet
    ITEM_DEFS.rope_coil.draw(ctx, w*0.84, h*0.655, 30);
  }

  // Interactive floor boxes
  // Box #7
  BoxRenderer.drawBox(ctx, w*0.22, h*0.54, 75, 65, {
    color: boxColor(7), label:'7', worn:0.4, hasTapeStripe:true
  });
  // Box #41
  BoxRenderer.drawBox(ctx, w*0.43, h*0.55, 82, 58, {
    color: boxColor(41), label:'41', worn:0.5
  });
  // Box #23 (only if map found)
  if (flags.has_attic_map) {
    BoxRenderer.drawBox(ctx, w*0.58, h*0.53, 70, 62, {
      color: boxColor(23), label:'23', worn:0.6, hasTapeStripe:true
    });
  }
  // Stack boxes for staircase puzzle
  if (flags.staircase_built) {
    // Staircase arrangement
    BoxRenderer.drawBox(ctx, w*0.34, h*0.58, 90, 40, {color:boxColor(105),label:'105',worn:0.3});
    BoxRenderer.drawBox(ctx, w*0.34, h*0.54, 90, 40, {color:boxColor(88),label:'88',worn:0.3});
    BoxRenderer.drawBox(ctx, w*0.36, h*0.46, 72, 40, {color:boxColor(72),label:'72',worn:0.2});
    BoxRenderer.drawBox(ctx, w*0.38, h*0.38, 55, 38, {color:boxColor(56),label:'56',worn:0.2});
  } else {
    BoxRenderer.drawBox(ctx, w*0.30, h*0.56, 90, 68, {color:boxColor(105),label:'105',worn:0.3,hasTapeStripe:true});
    BoxRenderer.drawBox(ctx, w*0.37, h*0.60, 78, 40, {color:boxColor(88),label:'88',worn:0.3});
  }

  // Candle on a small box
  ITEM_DEFS.candle.draw(ctx, w*0.62, h*0.60, 36);
}

function drawPadlock(ctx, cx, cy, size, open) {
  const s = size/24;
  ctx.fillStyle = open ? '#8a7040' : '#c0c0c0';
  ctx.fillRect(cx-10*s, cy, 20*s, 16*s);
  ctx.fillStyle = open ? '#aaa030' : '#a0a0a0';
  ctx.strokeStyle = open ? '#aaa030' : '#a0a0a0';
  ctx.lineWidth = 3*s;
  ctx.beginPath();
  if (open) {
    // Shackle open (rotated up)
    ctx.arc(cx, cy, 8*s, Math.PI, Math.PI*1.5);
    ctx.stroke();
  } else {
    ctx.arc(cx, cy, 8*s, Math.PI, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(cx, cy+8*s, 3*s, 0, Math.PI*2);
  ctx.fill();
}

function drawDoorCloseBg(ctx, w, h, dialState) {
  // Dark background
  ctx.fillStyle = '#1a0e05';
  ctx.fillRect(0, 0, w, h);

  // Wood door fills most of screen
  const dg = ctx.createLinearGradient(w*0.1, 0, w*0.9, 0);
  dg.addColorStop(0, '#5a3214');
  dg.addColorStop(0.5, '#7a4a1e');
  dg.addColorStop(1, '#5a3214');
  ctx.fillStyle = dg;
  ctx.fillRect(w*0.1, h*0.05, w*0.8, h*0.88);

  // Door panels
  ctx.fillStyle = '#6a3e18';
  ctx.strokeStyle = '#4a2a08'; ctx.lineWidth = 3;
  const panels = [{x:0.14,y:0.1,w:0.32,h:0.35},{x:0.54,y:0.1,w:0.32,h:0.35},
                  {x:0.14,y:0.5,w:0.32,h:0.35},{x:0.54,y:0.5,w:0.32,h:0.35}];
  for (const p of panels) {
    ctx.fillRect(w*p.x, h*p.y, w*p.w, h*p.h);
    ctx.strokeRect(w*p.x, h*p.y, w*p.w, h*p.h);
  }

  // Wall of boxes flanking
  BoxRenderer.generateWall(ctx, 0, 0, w*0.12, h, 3000);
  BoxRenderer.generateWall(ctx, w*0.88, 0, w*0.12+10, h, 4000);

  // Padlock detail - large, center
  const lx = w*0.5, ly = h*0.45;
  // Lock body
  ctx.fillStyle = '#888';
  roundRect(ctx, lx-45, ly-30, 90, 70, 8);
  ctx.fill();
  ctx.fillStyle = '#666';
  roundRect(ctx, lx-42, ly-27, 84, 64, 6);
  ctx.fill();
  // Shackle
  ctx.strokeStyle = '#777'; ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(lx, ly-30, 32, Math.PI, 0);
  ctx.stroke();
  // Dials
  const dialX = [lx-28, lx, lx+28];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#555';
    roundRect(ctx, dialX[i]-18, ly-20, 36, 40, 5);
    ctx.fill();
    ctx.fillStyle = '#333';
    roundRect(ctx, dialX[i]-14, ly-15, 28, 30, 3);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(dialState[i]), dialX[i], ly);
    // Up/down arrows hint
    ctx.fillStyle = 'rgba(255,215,0,0.5)';
    ctx.font = '10px sans-serif';
    ctx.fillText('▲', dialX[i], ly-22);
    ctx.fillText('▼', dialX[i], ly+22);
  }

  // Try button
  ctx.fillStyle = '#8B6020';
  roundRect(ctx, lx-60, ly+55, 120, 38, 8);
  ctx.fill();
  ctx.fillStyle = '#c0902a';
  roundRect(ctx, lx-58, ly+57, 116, 34, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Georgia';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Try Combination', lx, ly+74);

  // Back arrow
  ctx.fillStyle = 'rgba(50,30,10,0.8)';
  roundRect(ctx, 14, h-54, 100, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#c0902a';
  ctx.font = '14px Georgia';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('← Go Back', 64, h-37);
}

function drawShelfBg(ctx, w, h) {
  ctx.fillStyle = '#0d0800';
  ctx.fillRect(0, 0, w, h);

  // Shelf plank
  const sg = ctx.createLinearGradient(0, h*0.3, 0, h*0.45);
  sg.addColorStop(0,'#8B5E1A'); sg.addColorStop(1,'#5a3a0a');
  ctx.fillStyle = sg;
  ctx.fillRect(0, h*0.3, w, h*0.15);
  ctx.strokeStyle='#3a2008'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,h*0.3); ctx.lineTo(w,h*0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,h*0.45); ctx.lineTo(w,h*0.45); ctx.stroke();

  // Wood grain
  ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1;
  for(let i=0;i<6;i++){
    ctx.beginPath(); ctx.moveTo(i*w/5,h*0.3); ctx.lineTo(i*w/5+20,h*0.45); ctx.stroke();
  }

  // Scattered regular boxes on shelf
  BoxRenderer.drawBox(ctx, w*0.05, h*0.1, 70, 60, {color:boxColor(301),label:'301',worn:0.5});
  BoxRenderer.drawBox(ctx, w*0.18, h*0.15, 55, 55, {color:boxColor(444),label:'444',worn:0.3,hasTapeStripe:true});
  BoxRenderer.drawBox(ctx, w*0.72, h*0.12, 75, 58, {color:boxColor(77),label:'77',worn:0.4});
  BoxRenderer.drawBox(ctx, w*0.84, h*0.16, 60, 50, {color:boxColor(555),label:'555',worn:0.6});

  // The legendary Box #0000 - center, glowing
  ctx.save();
  ctx.shadowBlur = 40; ctx.shadowColor = '#FFD700';
  BoxRenderer.drawBox(ctx, w*0.37, h*0.05, 130, 115, {
    color:'#FFD700', label:'0000', shadow:false, glow:false
  });
  // Extra glow rings
  ctx.strokeStyle='rgba(255,215,0,0.3)'; ctx.lineWidth=6;
  ctx.beginPath(); ctx.ellipse(w*0.435, h*0.175, 80, 70, 0, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,215,0,0.15)'; ctx.lineWidth=10;
  ctx.beginPath(); ctx.ellipse(w*0.435, h*0.175, 100, 88, 0, 0, Math.PI*2); ctx.stroke();
  ctx.restore();

  // Floor below shelf
  const fg = ctx.createLinearGradient(0,h*0.45,0,h);
  fg.addColorStop(0,'#3a2008'); fg.addColorStop(1,'#1a0e04');
  ctx.fillStyle=fg; ctx.fillRect(0,h*0.45,w,h);

  // Back arrow
  ctx.fillStyle='rgba(50,30,10,0.8)';
  roundRect(ctx,14,h-54,120,34,8); ctx.fill();
  ctx.fillStyle='#c0902a'; ctx.font='14px Georgia';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('↓ Climb Down',74,h-37);
}

function drawEndingBg(ctx, w, h) {
  const g = ctx.createRadialGradient(w/2,h/2,10,w/2,h/2,w*0.7);
  g.addColorStop(0,'#FFD700'); g.addColorStop(0.5,'#c07000'); g.addColorStop(1,'#1a0a00');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  // Sparkles
  for(let i=0;i<30;i++){
    const sx=pseudoRandom(i*7)*w, sy=pseudoRandom(i*7+1)*h;
    ctx.fillStyle=`rgba(255,255,200,${0.4+pseudoRandom(i*3)*0.6})`;
    ctx.beginPath(); ctx.arc(sx,sy,1+pseudoRandom(i*5)*3,0,Math.PI*2); ctx.fill();
  }
}

// ─── Scene Manager ────────────────────────────────────────────────────────────

class SceneManager {
  constructor(engine) {
    this.engine = engine;
    this.currentScene = null;
    this.bgCache = null;
    this.dialState = [0, 0, 0];
  }

  invalidateCache() { this.bgCache = null; }

  loadScene(id) {
    const eng = this.engine;
    this.fade(() => {
      this.currentScene = this.buildScene(id, eng);
      eng.hotspots.load(this.currentScene.hotspots);
      eng.player.x = this.currentScene.playerSpawnX;
      eng.player.y = this.currentScene.playerFloorY;
      eng.player.isWalking = false;
      eng.verbCoin.hide();
      this.bgCache = null;
    });
  }

  fade(callback) {
    const ov = document.getElementById('fade-overlay');
    ov.style.transition = 'opacity 0.3s';
    ov.style.opacity = '1';
    setTimeout(() => {
      callback();
      ov.style.opacity = '0';
    }, 320);
  }

  buildScene(id, eng) {
    const w = eng.canvas.width, h = eng.canvas.height;
    if (id === 'attic_main') return this.buildAtticMain(eng, w, h);
    if (id === 'door_close')  return this.buildDoorClose(eng, w, h);
    if (id === 'shelf_close') return this.buildShelfClose(eng, w, h);
    if (id === 'ending')      return this.buildEnding(eng, w, h);
    return this.buildAtticMain(eng, w, h);
  }

  buildAtticMain(eng, w, h) {
    const f = () => eng.puzzle.flags;
    return {
      id: 'attic_main',
      playerSpawnX: w*0.45,
      playerFloorY: h*0.74,
      drawBg: (ctx) => drawAtticBg(ctx, w, h, eng.puzzle.flags),
      hotspots: [
        {
          id:'box_7', label:'Box #7', cursor:'pointer',
          region:{x:w*0.22, y:h*0.54, w:75, h:65},
          actions:{
            lookAt(e){ e.puzzle.set('clue_box_7_seen'); e.dialog.say("Box #7. Scrawled on the side in black marker: '7'. Part of something?"); },
          }
        },
        {
          id:'box_41', label:'Box #41', cursor:'pointer',
          region:{x:w*0.43, y:h*0.55, w:82, h:58},
          actions:{
            lookAt(e){ e.puzzle.set('clue_box_41_seen'); e.dialog.say("Box #41. The shipping label is peeling and waxy-looking. A partial combo: '4'. Intriguing."); },
            pickUp(e){
              if(e.inventory.hasItem('box_label')){ e.dialog.say("I already took the label."); return; }
              e.puzzle.set('has_box_label');
              e.inventory.addItem('box_label');
              e.puzzle.set('clue_box_41_seen');
            }
          }
        },
        {
          id:'box_23', label:'Box #23', cursor:'pointer',
          region:{x:w*0.58, y:h*0.53, w:70, h:62},
          condition:(fl) => fl.has_attic_map,
          actions:{
            lookAt(e){ e.puzzle.set('clue_box_23_seen'); e.dialog.say("Box #23! Just as the map said. Scratched on the bottom: '2'. That's all three clues!"); }
          }
        },
        {
          id:'candle', label:'Old Candle', cursor:'pointer',
          region:{x:w*0.60, y:h*0.56, w:28, h:42},
          actions:{
            lookAt(e){ e.dialog.say("A taper candle. Smells faintly of vanilla and regret."); },
            pickUp(e){
              if(e.inventory.hasItem('candle')){ e.dialog.say("I've already got the candle."); return; }
              e.puzzle.set('has_candle');
              e.inventory.addItem('candle');
            }
          }
        },
        {
          id:'padlock', label:'Cabinet Padlock', cursor:'pointer',
          region:{x:w*0.80, y:h*0.59, w:50, h:50},
          condition:(fl) => !fl.combo_lock_open,
          actions:{
            lookAt(e){ e.dialog.say("A three-dial combination padlock. Who puts a padlock on a cabinet in their own attic?"); },
            use(e){ e.sceneManager.loadScene('door_close'); }
          }
        },
        {
          id:'cabinet_open', label:'Open Cabinet', cursor:'pointer',
          region:{x:w*0.77, y:h*0.62, w:w*0.12, h:h*0.07},
          condition:(fl) => fl.combo_lock_open && !fl.has_rope,
          actions:{
            lookAt(e){ e.dialog.say("The cabinet is open. Inside: a neatly coiled rope. Someone was prepared for something."); },
            pickUp(e){
              e.puzzle.set('has_rope');
              e.inventory.addItem('rope_coil');
              e.sceneManager.invalidateCache();
            }
          }
        },
        {
          id:'stack_box_A', label:'Heavy Crate', cursor:'pointer',
          region:{x:w*0.30, y:h*0.56, w:90, h:68},
          condition:(fl) => !fl.staircase_built,
          actions:{
            lookAt(e){ e.dialog.say("A heavy crate. If I could get some leverage, maybe stack it differently..."); },
            use(e){
              if(!e.inventory.hasItem('rope_coil')){ e.dialog.say("I need something to lash these boxes together."); return; }
              if(e.puzzle.flags.box_A_roped){ e.dialog.say("Already tied that one."); return; }
              e.puzzle.set('box_A_roped');
              e.dialog.say("I tie the rope around the crate. One down.");
              if(e.puzzle.flags.box_B_roped){ e.puzzle.set('staircase_built'); e.dialog.say("The boxes shift into a perfect staircase! Lucky."); }
            }
          }
        },
        {
          id:'stack_box_B', label:'Flat Box', cursor:'pointer',
          region:{x:w*0.37, y:h*0.60, w:78, h:40},
          condition:(fl) => !fl.staircase_built,
          actions:{
            lookAt(e){ e.dialog.say("A flat box. Could be useful as a step if I could move it."); },
            use(e){
              if(!e.inventory.hasItem('rope_coil')){ e.dialog.say("I need something to lash these boxes together."); return; }
              if(e.puzzle.flags.box_B_roped){ e.dialog.say("Already tied that one."); return; }
              e.puzzle.set('box_B_roped');
              e.dialog.say("Rope around the flat box. Getting somewhere.");
              if(e.puzzle.flags.box_A_roped){ e.puzzle.set('staircase_built'); e.dialog.say("They lock together into a makeshift staircase! I'm a genius."); }
            }
          }
        },
        {
          id:'high_shelf', label:'High Shelf', cursor:'pointer',
          region:{x:w*0.3, y:h*0.24, w:w*0.4, h:h*0.07},
          actions:{
            lookAt(e){ e.dialog.say(e.puzzle.flags.staircase_built ? "The staircase reaches it! I can see a glowing box up there." : "Way too high. I'd need something to climb."); },
            use(e){
              if(!e.puzzle.flags.staircase_built){ e.dialog.say("I can't reach up there. I need something to climb."); return; }
              e.sceneManager.loadScene('shelf_close');
            }
          }
        },
        {
          id:'door', label:'Attic Door', cursor:'pointer',
          region:{x:w*0.77, y:h*0.34, w:w*0.12, h:h*0.30},
          actions:{
            lookAt(e){ e.dialog.say("A solid wooden door. Very locked. Very dramatic."); },
            use(e){ e.dialog.say("The door won't budge. And I'm not sure I want to leave without finding what I came here for."); }
          }
        },
      ]
    };
  }

  buildDoorClose(eng, w, h) {
    const ds = this.dialState;
    const lx = w*0.5, ly = h*0.45;
    const dialX = [lx-28, lx, lx+28];
    return {
      id: 'door_close',
      playerSpawnX: w*0.5,
      playerFloorY: h*0.85,
      drawBg: (ctx) => drawDoorCloseBg(ctx, w, h, ds),
      hotspots: [
        {
          id:'dial_0', label:'Left Dial', cursor:'pointer',
          region:{x:dialX[0]-18, y:ly-20, w:36, h:40},
          actions:{
            use(e){ e.sceneManager.dialState[0]=(ds[0]+1)%10; e.sceneManager.invalidateCache(); e.dialog.say(`Left dial: ${e.sceneManager.dialState[0]}`); }
          }
        },
        {
          id:'dial_1', label:'Middle Dial', cursor:'pointer',
          region:{x:dialX[1]-18, y:ly-20, w:36, h:40},
          actions:{
            use(e){ e.sceneManager.dialState[1]=(ds[1]+1)%10; e.sceneManager.invalidateCache(); e.dialog.say(`Middle dial: ${e.sceneManager.dialState[1]}`); }
          }
        },
        {
          id:'dial_2', label:'Right Dial', cursor:'pointer',
          region:{x:dialX[2]-18, y:ly-20, w:36, h:40},
          actions:{
            use(e){ e.sceneManager.dialState[2]=(ds[2]+1)%10; e.sceneManager.invalidateCache(); e.dialog.say(`Right dial: ${e.sceneManager.dialState[2]}`); }
          }
        },
        {
          id:'try_btn', label:'Try Combination', cursor:'pointer',
          region:{x:lx-60, y:ly+55, w:120, h:38},
          actions:{
            use(e){
              const d=e.sceneManager.dialState;
              if(d[0]===7&&d[1]===4&&d[2]===2){
                e.puzzle.set('combo_lock_open');
                e.dialog.say("CLICK! The lock springs open! I'm a genius. A grimy, attic-smelling genius.");
                setTimeout(()=>e.sceneManager.loadScene('attic_main'),2500);
              } else {
                e.dialog.say(`${d[0]}-${d[1]}-${d[2]}... Nope. The lock stares back at me, unimpressed.`);
              }
            }
          }
        },
        {
          id:'back', label:'Go Back', cursor:'pointer',
          region:{x:14, y:h-54, w:100, h:34},
          actions:{
            use(e){ e.sceneManager.loadScene('attic_main'); }
          }
        },
      ]
    };
  }

  buildShelfClose(eng, w, h) {
    return {
      id: 'shelf_close',
      playerSpawnX: w*0.5,
      playerFloorY: h*0.85,
      drawBg: (ctx) => drawShelfBg(ctx, w, h),
      hotspots: [
        {
          id:'box_0000', label:'Box #0000', cursor:'pointer',
          region:{x:w*0.37, y:h*0.05, w:130, h:115},
          actions:{
            lookAt(e){ e.dialog.say("Box #0000. The holiest grail of the Box Horde collection. It shimmers. I can feel its rarity from here."); },
            pickUp(e){
              e.dialog.say("I reach out... and grasp it. It's warm. It hums slightly. Or maybe that's the dust.");
              setTimeout(()=>{
                e.inventory.addItem('box_0000');
                e.puzzle.set('game_won');
              },2000);
            }
          }
        },
        {
          id:'other_boxes', label:'Other Boxes', cursor:'pointer',
          region:{x:0, y:h*0.05, w:w*0.37, h:h*0.35},
          actions:{
            lookAt(e){ e.dialog.say("Regular boxes. Numbered in the thousands. Common. Abundant. Not what I'm here for."); }
          }
        },
        {
          id:'back', label:'Climb Down', cursor:'pointer',
          region:{x:14, y:h-54, w:120, h:34},
          actions:{
            use(e){ e.sceneManager.loadScene('attic_main'); }
          }
        },
      ]
    };
  }

  buildEnding(eng, w, h) {
    return {
      id: 'ending',
      playerSpawnX: w*0.5,
      playerFloorY: h*0.75,
      drawBg: (ctx) => {
        drawEndingBg(ctx, w, h);
        // Big Box #0000
        ctx.save();
        ctx.shadowBlur=50; ctx.shadowColor='#FFD700';
        BoxRenderer.drawBox(ctx, w/2-110, h*0.08, 220, 195, {color:'#FFD700',label:'0000',shadow:false});
        ctx.restore();
        // Victory text
        ctx.fillStyle='#fff';
        ctx.font=`bold ${Math.round(w*0.042)}px Georgia`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowBlur=12; ctx.shadowColor='rgba(0,0,0,0.6)';
        ctx.fillText('YOU FOUND IT!', w/2, h*0.62);
        ctx.font=`${Math.round(w*0.022)}px Georgia`;
        ctx.fillText('Box #0000 — The Rarest NFT in the Attic', w/2, h*0.70);
        ctx.fillStyle='rgba(139,105,20,0.9)';
        roundRect(ctx, w/2-80, h*0.80, 160, 42, 10); ctx.fill();
        ctx.fillStyle='#fff';
        ctx.font=`bold ${Math.round(w*0.022)}px Georgia`;
        ctx.fillText('Play Again', w/2, h*0.821);
        ctx.shadowBlur=0;
      },
      hotspots:[
        {
          id:'restart', label:'Play Again', cursor:'pointer',
          region:{x:w/2-80, y:h*0.80, w:160, h:42},
          actions:{
            use(e){ location.reload(); }
          }
        }
      ]
    };
  }

  render(ctx) {
    const scene = this.currentScene;
    if (!scene) return;
    if (!this.bgCache) {
      const oc = document.createElement('canvas');
      oc.width = this.engine.canvas.width;
      oc.height = this.engine.canvas.height;
      scene.drawBg(oc.getContext('2d'));
      this.bgCache = oc;
    }
    ctx.drawImage(this.bgCache, 0, 0);
  }
}

// ─── Particles (ambient dust) ─────────────────────────────────────────────────

class Particles {
  constructor(engine) {
    this.engine = engine;
    this.particles = Array.from({length:12}, (_,i) => ({
      x: pseudoRandom(i*17) * 1000,
      y: pseudoRandom(i*17+1) * 600,
      vy: -(0.1 + pseudoRandom(i*7) * 0.4),
      vx: (pseudoRandom(i*13) - 0.5) * 0.3,
      size: 1 + pseudoRandom(i*9) * 2,
      alpha: 0.1 + pseudoRandom(i*5) * 0.3,
    }));
  }
  update() {
    const w = this.engine.canvas.width, h = this.engine.canvas.height;
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -5) { p.y = h + 5; p.x = pseudoRandom(p.x) * w; }
    }
  }
  render(ctx) {
    for (const p of this.particles) {
      ctx.fillStyle = `rgba(220,200,160,${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

// ─── Game Engine ──────────────────────────────────────────────────────────────

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.dt = 0;
    this.lastTime = 0;
    this.sceneManager = new SceneManager(this);
    this.player = new Player(this);
    this.hotspots = new HotspotManager(this);
    this.inventory = new InventorySystem(this);
    this.dialog = new DialogSystem(this);
    this.verbCoin = new VerbCoin(this);
    this.puzzle = new PuzzleState(this);
    this.particles = new Particles(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight - 80; // leave room for inventory
    this.sceneManager.invalidateCache();
  }

  bindInput() {
    this.canvas.addEventListener('click', (e) => {
      if (this.verbCoin.visible) { this.verbCoin.hide(); return; }
      const {x, y} = this.canvasPos(e);

      // If inventory item selected, use it on clicked hotspot
      const sel = this.inventory.selectedItem;
      const hot = this.hotspots.getAt(x, y);
      if (sel && hot && hot.actions.use) {
        this.inventory.deselectItem();
        const cx = hot.region.x + hot.region.w/2;
        this.player.walkTo(cx, this.sceneManager.currentScene.playerFloorY, () => {
          hot.actions.use(this);
        });
        return;
      }
      if (sel) { this.inventory.deselectItem(); return; }

      if (hot) {
        // Single-click: walkAt and show verb coin
        this.verbCoin.show(e.clientX, e.clientY, hot);
        return;
      }
      // Walk to click
      this.player.walkTo(x, this.sceneManager.currentScene.playerFloorY);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const {x, y} = this.canvasPos(e);
      const h = this.hotspots.getAt(x, y);
      this.canvas.style.cursor = h ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const {x, y} = this.canvasPos(e);
      const h = this.hotspots.getAt(x, y);
      if (h) this.verbCoin.show(e.clientX, e.clientY, h);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.verbCoin.hide(); this.inventory.deselectItem(); }
    });

    // Click anywhere on canvas to dismiss verb coin
    document.addEventListener('click', (e) => {
      if (e.target !== this.canvas && !e.target.closest('#verb-coin')) {
        // don't hide if clicking inventory — that's handled by InventorySystem
      }
    });
  }

  canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (this.canvas.height / rect.height),
    };
  }

  start() {
    this.sceneManager.loadScene('attic_main');
    // Opening narration
    setTimeout(() => {
      this.dialog.say("How did I end up here? Thousands of boxes, and somewhere among them...");
      setTimeout(() => this.dialog.say("...the legendary Box #0000. It has to be here."), 3200);
    }, 600);
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(timestamp) {
    this.dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.player.update();
    this.dialog.update();
    this.particles.update();

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.sceneManager.render(ctx);
    this.particles.render(ctx);
    this.player.render(ctx);

    requestAnimationFrame((t) => this.loop(t));
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const game = new GameEngine();
game.start();
