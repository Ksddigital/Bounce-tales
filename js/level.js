class Level {
  constructor(data, index) {
    this.index = index;
    this.name = data.name;
    this.bgColor = data.bgColor;
    this.bgColor2 = data.bgColor2 || data.bgColor;
    this.width = data.width || 2400;
    this.height = data.height || 600;

    // Deep clone data to avoid mutations across level restarts
    this.platforms = JSON.parse(JSON.stringify(data.platforms || []));
    this.spikes = JSON.parse(JSON.stringify(data.spikes || []));
    this.movingPlatforms = JSON.parse(JSON.stringify(data.movingPlatforms || []));
    this.gates = JSON.parse(JSON.stringify(data.gates || []));
    this.keys = JSON.parse(JSON.stringify(data.keys || []));
    this.collectibles = JSON.parse(JSON.stringify(data.collectibles || []));
    this.exit = data.exit ? JSON.parse(JSON.stringify(data.exit)) : null;
    this.playerStart = data.playerStart ? JSON.parse(JSON.stringify(data.playerStart)) : { x: 80, y: 400 };
    this.transforms = JSON.parse(JSON.stringify(data.transforms || []));
    this.breakableWalls = JSON.parse(JSON.stringify(data.breakableWalls || []));
    this.lava = JSON.parse(JSON.stringify(data.lava || []));
    this.skyPortals = JSON.parse(JSON.stringify(data.skyPortals || []));
    this.trampolines = JSON.parse(JSON.stringify(data.trampolines || []));
    this.enemies = JSON.parse(JSON.stringify(data.enemies || []));
    this.lasers = JSON.parse(JSON.stringify(data.lasers || []));
    this.airWalls = JSON.parse(JSON.stringify(data.airWalls || []));
    
    // New mechanics
    this.windColumns = JSON.parse(JSON.stringify(data.windColumns || []));
    this.weightSwitches = JSON.parse(JSON.stringify(data.weightSwitches || []));
    this.dashPads = JSON.parse(JSON.stringify(data.dashPads || []));
    this.water = JSON.parse(JSON.stringify(data.water || []));
    this.sizeGates = JSON.parse(JSON.stringify(data.sizeGates || []));
    
    // Boss Level
    this.boss = data.boss ? JSON.parse(JSON.stringify(data.boss)) : null;
    if (this.boss) {
      this.boss.startX = this.boss.x;
      this.boss.startY = this.boss.y;
      this.boss.active = true;
      this.boss.state = 'idle';
      this.boss.stateTimer = 0;
      this.boss.bombs = [];
      this.boss.flashTimer = 0;
      this.boss.vx = 2.5;
    }

    this.secretWarp = null;
    this.fireballs = [];
    this.complete = false;
    this.particles = [];
    this.clouds = [];
    this.bgElements = JSON.parse(JSON.stringify(data.bgElements || []));
    this.time = 0;
    this.laserTimer = 0;

    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * this.width,
        y: 30 + Math.random() * 120,
        w: 60 + Math.random() * 100,
        speed: 0.2 + Math.random() * 0.4
      });
    }

    for (const mp of this.movingPlatforms) {
      mp.startX = mp.x;
      mp.startY = mp.y;
      mp.currentTarget = 0;
      mp.dx = 0;
      mp.dy = 0;
      mp.waitTimer = 0;
    }
  }

  addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        size: 2 + Math.random() * 4
      });
    }
  }

  update(camera, player) {
    this.time++;
    this.updateMovingPlatforms();
    this.updateEnemies();
    this.updateLasers();
    this.updateFireballs();
    const playerY = player ? player.y : undefined;
    this.updateAirWalls(playerY);
    this.updateParticles();

    if (player) {
      this.updateWindColumns(player);
      this.updateWeightSwitches(player);
      this.updateDashPads(player);
      this.updateBoss(player);
    }
  }

  updateWindColumns(player) {
    const r = player.config.radius;
    for (const w of this.windColumns) {
      const overlapX = player.x + r > w.x && player.x - r < w.x + w.w;
      const overlapY = player.y + r > w.y && player.y - r < w.y + w.h;
      if (overlapX && overlapY) {
        if (player.form === FORM_WOLLY) {
          player.vy = Math.max(-8, player.vy - 0.72);
          if (Math.random() < 0.22) {
            this.particles.push({
              x: w.x + Math.random() * w.w,
              y: w.y + w.h - Math.random() * 20,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -2 - Math.random() * 3,
              life: 40,
              maxLife: 40,
              color: '#00E5FF',
              size: 1 + Math.random() * 2
            });
          }
        }
      }
    }
  }

  updateWeightSwitches(player) {
    const r = player.config.radius;
    for (const s of this.weightSwitches) {
      if (s.pressed) continue;
      const overlapX = player.x + r > s.x && player.x - r < s.x + s.w;
      const overlapY = player.y + r > s.y && player.y - r < s.y + s.h;
      if (overlapX && overlapY && player.form === FORM_BUMPY) {
        s.pressed = true;
        AUDIO.gateOpen();
        const gate = this.gates[s.targetGateIndex];
        if (gate) {
          gate.open = true;
          this.addParticles(gate.x + gate.w/2, gate.y + gate.h/2, COLORS.gateOpen, 15);
        }
      }
    }
  }

  updateDashPads(player) {
    const r = player.config.radius;
    for (const d of this.dashPads) {
      const overlapX = player.x + r > d.x && player.x - r < d.x + d.w;
      const overlapY = player.y + r > d.y && player.y - r < d.y + d.h;
      if (overlapX && overlapY && player.form === FORM_BOUNCE) {
        player.vx = d.direction * 14.5;
        if (Math.abs(player.vy) > 0.1) player.vy = -1.5;
        if (Math.random() < 0.25) {
          this.addParticles(player.x, player.y, COLORS.dashPad, 4);
          AUDIO.bounce();
        }
      }
    }
  }

  updateBoss(player) {
    if (!this.boss || !this.boss.active) return;
    const b = this.boss;
    b.timer = (b.timer || 0) + 1;

    if (b.flashTimer > 0) b.flashTimer--;

    if (b.state === 'stunned') {
      b.stateTimer--;
      if (b.stateTimer <= 0) {
        b.state = 'patrol';
      }
      return;
    }

    b.x += b.vx;
    if (b.x <= b.patrolMin || b.x + b.w >= b.patrolMax) {
      b.vx *= -1;
      b.x = Math.max(b.patrolMin, Math.min(b.patrolMax - b.w, b.x));
    }

    if (b.timer % 110 === 0) {
      b.bombs.push({
        x: b.x + b.w / 2,
        y: b.y + b.h - 10,
        vx: (player.x - (b.x + b.w / 2)) * 0.009,
        vy: 1.5,
        radius: 10,
        life: 200
      });
      AUDIO.fireball();
    }

    for (let i = b.bombs.length - 1; i >= 0; i--) {
      const bomb = b.bombs[i];
      bomb.y += bomb.vy;
      bomb.x += bomb.vx;
      bomb.vy += 0.2;
      bomb.life--;

      const dx = player.x - bomb.x;
      const dy = player.y - bomb.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bomb.radius + player.config.radius && !player.invulnerable && !player.flying && !player.dead) {
        player.die();
        b.bombs.splice(i, 1);
        continue;
      }

      let hitPlatform = false;
      for (const p of this.platforms) {
        if (bomb.x + bomb.radius > p.x && bomb.x - bomb.radius < p.x + p.w &&
            bomb.y + bomb.radius > p.y && bomb.y - bomb.radius < p.y + p.h) {
          hitPlatform = true;
          break;
        }
      }

      if (hitPlatform || bomb.life <= 0 || bomb.y > this.height) {
        this.addParticles(bomb.x, bomb.y, COLORS.bossBomb, 10);
        b.bombs.splice(i, 1);
      }
    }

    const r = player.config.radius;
    if (player.x + r > b.x && player.x - r < b.x + b.w &&
        player.y + r > b.y && player.y - r < b.y + b.h) {
      if (!player.invulnerable && !player.flying && !player.dead) {
        player.die();
      }
    }
  }

  updateEnemies() {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.x += e.vx * ENEMY_SPEED;
      if (e.x <= e.patrolMin || e.x + e.w >= e.patrolMax) {
        e.vx *= -1;
      }
    }
  }

  updateLasers() {
    this.laserTimer++;
    if (this.laserTimer >= LASER_TOGGLE_INTERVAL) {
      this.laserTimer = 0;
      for (const l of this.lasers) {
        l.active = !l.active;
      }
    }
  }

  updateFireballs() {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      f.x += f.vx;
      f.y += f.vy;
      f.life--;
      let hit = false;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = f.x - (e.x + e.w / 2);
        const dy = f.y - (e.y + e.h / 2);
        if (Math.abs(dx) < e.w / 2 + f.radius && Math.abs(dy) < e.h / 2 + f.radius) {
          e.dead = true;
          this.addParticles(e.x + e.w / 2, e.y + e.h / 2, COLORS.enemy, 15);
          AUDIO.fireballHit();
          hit = true;
          break;
        }
      }

      if (!hit && this.boss && this.boss.active && this.boss.state !== 'stunned') {
        const b = this.boss;
        const dx = f.x - (b.x + b.w / 2);
        const dy = f.y - (b.y + b.h / 2);
        if (Math.abs(dx) < b.w / 2 + f.radius && Math.abs(dy) < b.h / 2 + f.radius) {
          b.health--;
          b.state = 'stunned';
          b.stateTimer = 50;
          b.flashTimer = 50;
          this.addParticles(f.x, f.y, COLORS.boss, 25);
          AUDIO.fireballHit();
          if (b.health <= 0) {
            b.health = 0;
            b.active = false;
            this.addParticles(b.x + b.w/2, b.y + b.h/2, COLORS.boss, 60);
            AUDIO.die();
            if (this.exit) {
              this.exit.x = b.x + b.w/2 - 20;
              this.exit.y = b.y + b.h/2 - 30;
            }
          }
          hit = true;
        }
      }

      if (hit || f.life <= 0 || f.x < -50 || f.x > this.width + 50) {
        this.fireballs.splice(i, 1);
      }
    }
  }

  updateAirWalls(playerY) {
    if (playerY === undefined) return;
    for (const w of this.airWalls) {
      if (!w.revealed && playerY < AIR_MAZE_REVEAL_Y) {
        w.revealed = true;
      }
    }
  }

  updateMovingPlatforms() {
    for (const mp of this.movingPlatforms) {
      if (mp.waitTimer > 0) {
        mp.waitTimer--;
        mp.dx = 0;
        mp.dy = 0;
        continue;
      }
      const target = mp.path[mp.currentTarget];
      const dx = target.x - mp.x;
      const dy = target.y - mp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) {
        mp.currentTarget = (mp.currentTarget + 1) % mp.path.length;
        mp.waitTimer = mp.delay || 30;
        mp.dx = 0;
        mp.dy = 0;
      } else {
        const step = mp.speed || 1.5;
        mp.dx = (dx / dist) * step;
        mp.dy = (dy / dist) * step;
        mp.x += mp.dx;
        mp.y += mp.dy;
      }
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawBackground(ctx, camera) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, this.bgColor);
    grad.addColorStop(1, this.bgColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (this.index === 0 || this.index === 1 || this.index === 5) {
      for (let i = 0; i < 3; i++) {
        const mx = 150 + i * 500 - camera.x * 0.1;
        const my = 120 + Math.sin(this.time * 0.01 + i) * 20;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(((mx % 2000) + 2000) % 2000, my, 80 + i * 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPlatforms(ctx, camera) {
    for (const p of this.platforms) {
      if (!this.isVisible(p, camera)) continue;
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;

      if (p.type === 'stone') {
        ctx.fillStyle = COLORS.stone;
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.strokeStyle = '#607D8B';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, p.w, p.h);
        for (let i = 0; i < p.w; i += 20) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.beginPath();
          ctx.moveTo(sx + i, sy);
          ctx.lineTo(sx + i, sy + p.h);
          ctx.stroke();
        }
        // Draw a glowing hint sign if this is a size-gate ceiling
        if (p.hint) {
          const pulse = Math.sin(this.time * 0.08) * 0.2 + 0.8;
          ctx.save();
          ctx.font = 'bold 11px Orbitron, Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = `rgba(255,255,180,${pulse})`;
          ctx.shadowColor = '#FFD600';
          ctx.shadowBlur = 8 * pulse;
          ctx.fillText(p.hint, sx + p.w / 2, sy - 4);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      } else if (p.type === 'cloud') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(sx + p.w / 2, sy + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(sx + p.w / 2 - 10, sy + p.h / 2 - 5, p.w / 3, p.h / 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'lava') {
        ctx.fillStyle = COLORS.lava;
        ctx.fillRect(sx, sy, p.w, p.h);
        const wave = Math.sin(this.time * 0.05) * 3;
        ctx.fillStyle = '#FF8A65';
        ctx.fillRect(sx, sy - 2 + wave, p.w, 4);
      } else if (p.type === 'slide') {
        const dir = p.direction || 1;
        ctx.save();
        ctx.fillStyle = '#1e1136'; // deep dark violet base
        ctx.strokeStyle = '#E040FB'; // glowing neon purple
        ctx.lineWidth = 3;
        ctx.shadowColor = '#E040FB';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        if (dir === 1) {
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + p.w, sy + p.h - 10);
          ctx.lineTo(sx + p.w, sy + p.h);
          ctx.lineTo(sx, sy + p.h);
        } else {
          ctx.moveTo(sx + p.w, sy);
          ctx.lineTo(sx, sy + p.h - 10);
          ctx.lineTo(sx, sy + p.h);
          ctx.lineTo(sx + p.w, sy + p.h);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        if (dir === 1) {
          ctx.moveTo(sx + 10, sy + 5);
          ctx.lineTo(sx + p.w - 10, sy + p.h - 5);
        } else {
          ctx.moveTo(sx + p.w - 10, sy + 5);
          ctx.lineTo(sx + 10, sy + p.h - 5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else {
        ctx.fillStyle = COLORS.platform;
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.fillStyle = COLORS.groundDark;
        ctx.fillRect(sx, sy, p.w, 4);
      }
    }
  }

  drawBreakableWalls(ctx, camera) {
    for (const w of this.breakableWalls) {
      if (w.broken || !this.isVisible(w, camera)) continue;
      const sx = w.x - camera.x;
      const sy = w.y - camera.y;
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(sx, sy, w.w, w.h);
      ctx.strokeStyle = '#6D4C41';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, w.w, w.h);
      for (let i = 0; i < w.w; i += 15) {
        for (let j = 0; j < w.h; j += 15) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.strokeRect(sx + i, sy + j, 15, 15);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(sx + 4, sy + 4, 4, 4);
    }
  }

  drawSpikes(ctx, camera) {
    for (const s of this.spikes) {
      if (s.destroyed) continue;
      if (!this.isVisible(s, camera)) continue;
      const sx = s.x - camera.x;
      const sy = s.y - camera.y;
      ctx.fillStyle = COLORS.spike;
      const count = Math.floor(s.w / 16);
      for (let i = 0; i < count; i++) {
        const px = sx + i * 16;
        ctx.beginPath();
        ctx.moveTo(px, sy + s.h);
        ctx.lineTo(px + 8, sy);
        ctx.lineTo(px + 16, sy + s.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#D32F2F';
      for (let i = 0; i < count; i++) {
        const px = sx + i * 16;
        ctx.beginPath();
        ctx.moveTo(px + 4, sy + s.h);
        ctx.lineTo(px + 8, sy + 4);
        ctx.lineTo(px + 12, sy + s.h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawLava(ctx, camera) {
    for (const l of this.lava) {
      if (!this.isVisible(l, camera)) continue;
      const sx = l.x - camera.x;
      const sy = l.y - camera.y;
      ctx.fillStyle = COLORS.lava;
      ctx.fillRect(sx, sy, l.w, l.h);
      ctx.fillStyle = '#FF8A65';
      const wave1 = Math.sin(this.time * 0.04) * 3;
      const wave2 = Math.sin(this.time * 0.04 + 2) * 2;
      for (let i = 0; i < l.w; i += 4) {
        const wy = sy + 4 + Math.sin(this.time * 0.05 + i * 0.05) * 3;
        ctx.fillRect(sx + i, wy, 4, 2);
      }
      ctx.fillStyle = 'rgba(255,200,100,0.3)';
      ctx.fillRect(sx, sy + 2, l.w, 3);
    }
  }

  drawMovingPlatforms(ctx, camera) {
    for (const mp of this.movingPlatforms) {
      if (!this.isVisible(mp, camera)) continue;
      const sx = mp.x - camera.x;
      const sy = mp.y - camera.y;
      ctx.fillStyle = '#FF8F00';
      ctx.fillRect(sx, sy, mp.w, mp.h);
      ctx.fillStyle = '#FFA726';
      ctx.fillRect(sx, sy, mp.w, 3);

      const totalDist = mp.path.reduce((sum, _, i) => {
        const next = mp.path[(i + 1) % mp.path.length];
        const curr = mp.path[i];
        return sum + Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);
      }, 0);
      if (totalDist > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let i = 0; i < mp.path.length; i++) {
          const next = mp.path[(i + 1) % mp.path.length];
          const curr = mp.path[i];
          ctx.beginPath();
          ctx.moveTo(curr.x - camera.x, curr.y - camera.y);
          ctx.lineTo(next.x - camera.x, next.y - camera.y);
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  drawGates(ctx, camera) {
    for (const g of this.gates) {
      if (!this.isVisible(g, camera)) continue;
      const sx = g.x - camera.x;
      const sy = g.y - camera.y;
      if (g.open) {
        ctx.fillStyle = 'rgba(84, 110, 122, 0.4)';
        ctx.fillRect(sx, sy, g.w, g.h);
        ctx.strokeStyle = 'rgba(84, 110, 122, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, sy, g.w, g.h);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = COLORS.gate;
        ctx.fillRect(sx, sy, g.w, g.h);
        ctx.fillStyle = '#6D4C41';
        ctx.fillRect(sx, sy, g.w, 6);
        ctx.fillRect(sx, sy + g.h - 6, g.w, 6);
        ctx.fillRect(sx, sy, 6, g.h);
        ctx.fillRect(sx + g.w - 6, sy, 6, g.h);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(sx + 10, sy + 10, g.w - 20, g.h - 20);
        ctx.fillStyle = '#FFD600';
        ctx.beginPath();
        ctx.arc(sx + g.w / 2, sy + g.h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(sx + g.w / 2, sy + g.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawKeys(ctx, camera) {
    for (const k of this.keys) {
      if (k.collected || !this.isVisible({ x: k.x - 8, y: k.y - 8, w: 16, h: 16 }, camera)) continue;
      const sx = k.x - camera.x;
      const sy = k.y - camera.y + Math.sin(this.time * 0.04) * 3;
      ctx.fillStyle = COLORS.key;
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFAB00';
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(sx - 2, sy - 2, 4, 8);
      ctx.fillRect(sx - 4, sy - 4, 8, 4);
      ctx.fillStyle = COLORS.key;
      ctx.fillRect(sx - 1, sy - 8, 2, 6);
      ctx.shadowColor = 'rgba(255,214,0,0.4)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.key;
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawExit(ctx, camera) {
    const e = this.exit;
    if (!this.isVisible(e, camera)) return;
    const sx = e.x - camera.x;
    const sy = e.y - camera.y;
    
    const locked = this.collectibles.some(c => c.type === 'egg' && !c.collected);

    if (locked) {
      const pulse = Math.sin(this.time * 0.08) * 0.2 + 0.8;
      ctx.fillStyle = 'rgba(244, 67, 54, 0.2)';
      ctx.fillRect(sx - 10, sy - 10, e.w + 20, e.h + 20);
      
      ctx.fillStyle = '#E53935';
      ctx.shadowColor = '#E53935';
      ctx.shadowBlur = 12 * pulse;
      ctx.fillRect(sx, sy, e.w, e.h);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#B71C1C';
      ctx.fillRect(sx + 4, sy + 4, e.w - 8, e.h - 8);
      
      // Padlock icon
      ctx.save();
      ctx.translate(sx + e.w / 2, sy + e.h / 2);
      ctx.strokeStyle = '#FFD600';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -6, 6, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#FFD600';
      ctx.fillRect(-8, -5, 16, 12);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const pulse = Math.sin(this.time * 0.05) * 0.15 + 1;
      ctx.fillStyle = 'rgba(0, 230, 118, 0.2)';
      ctx.fillRect(sx - 10, sy - 10, e.w + 20, e.h + 20);
      ctx.fillStyle = COLORS.exit;
      ctx.shadowColor = COLORS.exit;
      ctx.shadowBlur = 12 * pulse;
      ctx.fillRect(sx, sy, e.w, e.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#00C853';
      ctx.fillRect(sx + 4, sy + 4, e.w - 8, e.h - 8);
      ctx.fillStyle = '#69F0AE';
      ctx.fillRect(sx + e.w / 2 - 10, sy + e.h / 2 - 10, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶', sx + e.w / 2, sy + e.h / 2 + 1);
    }
  }

  drawCollectibles(ctx, camera) {
    for (const c of this.collectibles) {
      if (c.collected || !this.isVisible({ x: c.x - 10, y: c.y - 10, w: 20, h: 20 }, camera)) continue;
      const sx = c.x - camera.x;
      const sy = c.y - camera.y + Math.sin(this.time * 0.05 + c.x) * 4;

      if (c.type === 'egg') {
        ctx.fillStyle = COLORS.egg;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.ellipse(sx - 2, sy - 2, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx - 4, sy - 5, 2, 3, 0, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.type === 'life') {
        ctx.fillStyle = COLORS.life;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5);
        ctx.bezierCurveTo(sx + 8, sy - 12, sx + 16, sy - 3, sx, sy + 8);
        ctx.bezierCurveTo(sx - 16, sy - 3, sx - 8, sy - 12, sx, sy - 5);
        ctx.fill();
      } else if (c.type === 'speedShoes') {
        ctx.save();
        ctx.shadowColor = '#FF7043';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FF7043';
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.moveTo(sx + 2, sy - 4);
        ctx.lineTo(sx - 2, sy + 1);
        ctx.lineTo(sx + 1, sy + 1);
        ctx.lineTo(sx - 1, sy + 5);
        ctx.lineTo(sx + 3, sy);
        ctx.lineTo(sx, sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (c.type === 'shield') {
        ctx.save();
        ctx.shadowColor = '#29B6F6';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(41, 182, 246, 0.4)';
        ctx.strokeStyle = '#29B6F6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawTransforms(ctx, camera) {
    for (const t of this.transforms) {
      if (t.collected || !this.isVisible({ x: t.x - 14, y: t.y - 14, w: 28, h: 28 }, camera)) continue;
      const sx = t.x - camera.x;
      const sy = t.y - camera.y + Math.sin(this.time * 0.06 + t.x) * 4;
      const glow = Math.sin(this.time * 0.08) * 0.2 + 0.8;

      ctx.shadowColor = FORM_CONFIG[t.type].color;
      ctx.shadowBlur = 20 * glow;
      ctx.fillStyle = FORM_CONFIG[t.type].color;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.type === FORM_BUMPY ? 'B' : 'W', sx, sy + 1);

      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(sx - 4, sy - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSkyPortals(ctx, camera) {
    for (const p of this.skyPortals) {
      if (p.used || !this.isVisible(p, camera)) continue;
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const pulse = Math.sin(this.time * 0.06) * 0.3 + 0.7;
      ctx.shadowColor = COLORS.fly;
      ctx.shadowBlur = 25 * pulse;
      const grad = ctx.createRadialGradient(sx + p.w/2, sy + p.h/2, 0, sx + p.w/2, sy + p.h/2, p.w/2);
      grad.addColorStop(0, `rgba(0, 229, 255, ${0.4 * pulse})`);
      grad.addColorStop(0.5, `rgba(0, 229, 255, ${0.15 * pulse})`);
      grad.addColorStop(1, `rgba(0, 229, 255, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,255,255,${0.2 * pulse})`;
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + p.w / 2, sy + p.h / 2);

      const label = p.targetLevel.replace('secret-', 'S-').toUpperCase();
      ctx.fillStyle = `rgba(0, 229, 255, ${0.6 * pulse})`;
      ctx.font = '10px Arial';
      ctx.fillText(label, sx + p.w / 2, sy + p.h + 16);
    }
  }

  drawParticles(ctx, camera) {
    for (const p of this.particles) {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawTrampolines(ctx, camera) {
    for (const t of this.trampolines) {
      if (!this.isVisible(t, camera)) continue;
      const sx = t.x - camera.x;
      const sy = t.y - camera.y;
      ctx.fillStyle = COLORS.trampoline;
      ctx.fillRect(sx, sy, t.w, t.h);
      ctx.fillStyle = '#64B5F6';
      ctx.fillRect(sx + 4, sy, t.w - 8, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(sx + 8, sy + 6, t.w - 16, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < t.w; i += 12) {
        ctx.fillRect(sx + i, sy + 12, 6, t.h - 12);
      }
    }
  }

  drawEnemies(ctx, camera) {
    for (const e of this.enemies) {
      if (e.dead || !this.isVisible(e, camera)) continue;
      const sx = e.x - camera.x;
      const sy = e.y - camera.y;
      ctx.fillStyle = COLORS.enemy;
      ctx.fillRect(sx, sy, e.w, e.h);
      ctx.fillStyle = '#9C27B0';
      ctx.fillRect(sx + 4, sy + 4, e.w - 8, e.h - 8);
      ctx.fillStyle = '#CE93D8';
      ctx.fillRect(sx + 6, sy + 6, 4, 4);
      ctx.fillRect(sx + e.w - 10, sy + 6, 4, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 8, sy + e.h - 8, e.w - 16, 3);

      const patrolRange = e.patrolMax - e.patrolMin;
      if (patrolRange > 0) {
        const progress = (e.x - e.patrolMin) / patrolRange;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(e.patrolMin - camera.x, sy + e.h + 4, patrolRange, 3);
        ctx.fillStyle = 'rgba(206,147,216,0.4)';
        ctx.fillRect(e.patrolMin - camera.x + progress * (patrolRange - 8), sy + e.h + 4, 8, 3);
      }
    }
  }

  drawLasers(ctx, camera) {
    for (const l of this.lasers) {
      if (!this.isVisible(l, camera)) continue;
      const sx = l.x - camera.x;
      const sy = l.y - camera.y;
      if (l.active) {
        ctx.fillStyle = COLORS.laser;
        ctx.fillRect(sx, sy, l.w, l.h);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(sx + 2, sy, l.w - 4, l.h);
        const glow = Math.sin(this.time * 0.1) * 0.3 + 0.7;
        ctx.shadowColor = COLORS.laser;
        ctx.shadowBlur = 20 * glow;
        ctx.fillStyle = `rgba(255,255,255,${0.2 * glow})`;
        ctx.fillRect(sx, sy, l.w, l.h);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = COLORS.laserInactive;
        ctx.fillRect(sx, sy, l.w, l.h);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(sx + 2, sy, l.w - 4, l.h);
        const pulse = Math.sin(this.time * 0.05) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(244,67,54,${0.08 * pulse})`;
        ctx.fillRect(sx, sy, l.w, 3);
        ctx.fillRect(sx, sy + l.h - 3, l.w, 3);
      }
    }
  }

  drawAirWalls(ctx, camera) {
    for (const w of this.airWalls) {
      if (!this.isVisible(w, camera)) continue;
      const sx = w.x - camera.x;
      const sy = w.y - camera.y;
      if (w.revealed) {
        ctx.fillStyle = 'rgba(176,190,197,0.4)';
        ctx.fillRect(sx, sy, w.w, w.h);
        ctx.strokeStyle = 'rgba(176,190,197,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(sx, sy, w.w, w.h);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(sx + 4, sy + 4, w.w - 8, w.h - 8);
      } else {
        ctx.fillStyle = 'rgba(176,190,197,0.04)';
        ctx.fillRect(sx, sy, w.w, w.h);
        ctx.strokeStyle = 'rgba(176,190,197,0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, w.w, w.h);
      }
    }
  }

  drawFireballs(ctx, camera) {
    for (const f of this.fireballs) {
      const sx = f.x - camera.x;
      const sy = f.y - camera.y;
      ctx.shadowColor = COLORS.fireball;
      ctx.shadowBlur = 15;
      ctx.fillStyle = COLORS.fireball;
      ctx.beginPath();
      ctx.arc(sx, sy, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFAB00';
      ctx.beginPath();
      ctx.arc(sx - 2, sy - 2, f.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      const tailX = sx - f.vx * 0.4;
      const tailY = sy - f.vy * 0.4;
      ctx.fillStyle = 'rgba(255,109,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arcTo(tailX, tailY, tailX - 5, tailY - 5, 10);
      ctx.fill();
    }
  }

  drawWindColumns(ctx, camera) {
    for (const w of this.windColumns) {
      if (!this.isVisible(w, camera)) continue;
      const sx = w.x - camera.x;
      const sy = w.y - camera.y;

      const grad = ctx.createLinearGradient(sx, sy, sx, sy + w.h);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.12)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.01)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, w.w, w.h);

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 12]);
      ctx.strokeRect(sx, sy, w.w, w.h);
      ctx.setLineDash([]);
    }
  }

  drawWeightSwitches(ctx, camera) {
    for (const s of this.weightSwitches) {
      if (!this.isVisible(s, camera)) continue;
      const sx = s.x - camera.x;
      const sy = s.y - camera.y;

      ctx.fillStyle = '#424242';
      ctx.fillRect(sx - 2, sy + s.h - 4, s.w + 4, 6);

      ctx.fillStyle = s.pressed ? COLORS.weightSwitchPressed : COLORS.weightSwitch;
      const capH = s.pressed ? 4 : 10;
      const capY = s.pressed ? sy + s.h - 4 : sy + s.h - 10;
      ctx.fillRect(sx + 2, capY, s.w - 4, capH);

      if (!s.pressed) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px Orbitron, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HEAVY', sx + s.w / 2, capY + capH / 2);
      }
    }
  }

  drawDashPads(ctx, camera) {
    for (const d of this.dashPads) {
      if (!this.isVisible(d, camera)) continue;
      const sx = d.x - camera.x;
      const sy = d.y - camera.y;

      ctx.fillStyle = COLORS.dashPad;
      ctx.shadowColor = COLORS.dashPad;
      ctx.shadowBlur = 10;
      ctx.fillRect(sx, sy, d.w, d.h);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#111';
      ctx.beginPath();
      const midY = sy + d.h / 2;
      const spacing = 12;
      for (let offset = -8; offset <= 8; offset += spacing) {
        const cx = sx + d.w / 2 + offset;
        ctx.moveTo(cx - 3 * d.direction, midY - 4);
        ctx.lineTo(cx + 3 * d.direction, midY);
        ctx.lineTo(cx - 3 * d.direction, midY + 4);
      }
      ctx.fill();
    }
  }

  drawBoss(ctx, camera) {
    if (!this.boss || !this.boss.active) return;
    const b = this.boss;
    const sx = b.x - camera.x;
    const sy = b.y - camera.y;

    ctx.save();
    if (b.flashTimer > 0 && Math.floor(b.flashTimer / 3) % 2 === 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#FFFFFF';
    } else {
      ctx.fillStyle = COLORS.boss;
      ctx.shadowColor = COLORS.boss;
    }

    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.arc(sx + b.w / 2, sy + b.h / 2, b.w / 2 - 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx + b.w / 2, sy + b.h / 2, b.w / 3, 0, Math.PI * 2);
    ctx.stroke();

    const timeFactor = this.time * 0.05;
    for (let i = 0; i < 4; i++) {
      const angle = timeFactor + i * (Math.PI / 2);
      const orbX = sx + b.w / 2 + Math.cos(angle) * (b.w / 2);
      const orbY = sy + b.h / 2 + Math.sin(angle) * (b.h / 2);
      ctx.fillStyle = '#FF007F';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(sx + b.w / 2 - 16, sy + b.h / 2 - 8, 8, 0, Math.PI * 2);
    ctx.arc(sx + b.w / 2 + 16, sy + b.h / 2 - 8, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.arc(sx + b.w / 2 - 16, sy + b.h / 2 - 8, 3, 0, Math.PI * 2);
    ctx.arc(sx + b.w / 2 + 16, sy + b.h / 2 - 8, 3, 0, Math.PI * 2);
    ctx.fill();

    if (b.state === 'stunned') {
      ctx.strokeStyle = '#FFFF00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx + b.w / 2, sy + b.h / 2 - 25, 12, this.time * 0.1, this.time * 0.1 + Math.PI);
      ctx.stroke();
    }

    ctx.restore();

    for (const bomb of b.bombs) {
      const bsx = bomb.x - camera.x;
      const bsy = bomb.y - camera.y;

      const pulse = Math.sin(this.time * 0.2) * 0.3 + 0.7;
      ctx.fillStyle = COLORS.bossBomb;
      ctx.shadowColor = COLORS.bossBomb;
      ctx.shadowBlur = 15 * pulse;
      ctx.beginPath();
      ctx.arc(bsx, bsy, bomb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath();
      ctx.arc(bsx - 2, bsy - 2, bomb.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWater(ctx, camera) {
    if (!this.water) return;
    for (const w of this.water) {
      if (!this.isVisible(w, camera)) continue;
      const sx = w.x - camera.x;
      const sy = w.y - camera.y;

      ctx.save();
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(sx, sy, w.w, w.h);

      ctx.strokeStyle = '#00B8D4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let xOffset = 0; xOffset <= w.w; xOffset += 10) {
        const waveY = Math.sin(this.time * 0.05 + (w.x + xOffset) * 0.03) * 4;
        if (xOffset === 0) {
          ctx.moveTo(sx + xOffset, sy + waveY);
        } else {
          ctx.lineTo(sx + xOffset, sy + waveY);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSizeGates(ctx, camera) {
    if (!this.sizeGates) return;
    for (const g of this.sizeGates) {
      if (!this.isVisible(g, camera)) continue;
      const sx = g.x - camera.x + g.w / 2;
      const sy = g.y - camera.y + g.h / 2;

      ctx.save();
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 0.08);
      ctx.strokeStyle = COLORS.gateSize;
      ctx.shadowColor = COLORS.gateSize;
      ctx.shadowBlur = 12 * pulse;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, g.w / 2, g.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px Orbitron, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let label = 'SIZE';
      if (g.type === 'deflator') label = 'TINY';
      else if (g.type === 'inflator') label = 'GIANT';
      else if (g.type === 'resizer') label = 'NORM';
      ctx.fillText(label, sx, sy);
      ctx.restore();
    }
  }

  isVisible(rect, camera) {
    return rect.x + rect.w > camera.x - 50 &&
      rect.x < camera.x + CANVAS_W + 50 &&
      rect.y + rect.h > camera.y - 50 &&
      rect.y < camera.y + CANVAS_H + 50;
  }
}


const LEVEL_DATA = [
  {
    name: 'Green Meadows',
    bgColor: '#87CEEB',
    bgColor2: '#B3E5FC',
    width: 2400, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      // Ground sections
      { x: 0,    y: 480, w: 400,  h: 120 },
      { x: 490,  y: 480, w: 290,  h: 120 },
      { x: 880,  y: 480, w: 480,  h: 120 },
      { x: 1460, y: 480, w: 940,  h: 120 },
      // Raised ledge 1 (accessible by jumping from ground)
      { x: 200,  y: 340, w: 140,  h: 20  },
      // Ramp: connects ledge-1 (y=340) to next ground section
      { x: 340,  y: 340, w: 150,  h: 140, type: 'slide', direction: 1 },
      // Raised ledge 2 (reachable after ramp launches you right)
      { x: 760,  y: 360, w: 120,  h: 20  },
      // Upper shelf (reachable by trampoline)
      { x: 1200, y: 300, w: 180,  h: 20  },
      // Staircase to exit
      { x: 1700, y: 380, w: 120,  h: 20  },
      { x: 1880, y: 300, w: 120,  h: 20  },
      { x: 2060, y: 220, w: 140,  h: 20  },
      // === TINY-ONLY TUNNEL ===
      // Ceiling — bottom at 454 (gap of 26px to ground at y=480). Tiny (16px dia) fits; normal (32px dia) blocked.
      { x: 1000, y: 438, w: 200,  h: 16, type: 'stone', hint: '🔵 TINY ONLY' },
    ],
    spikes: [
      { x: 400,  y: 456, w: 90,  h: 24 },
      { x: 1360, y: 456, w: 100, h: 24 },
    ],
    trampolines: [
      { x: 1080, y: 464, w: 60, h: 16 },
    ],
    movingPlatforms: [
      { x: 620, y: 340, w: 80, h: 16, speed: 1.5, delay: 10,
        path: [{ x: 620, y: 340 }, { x: 780, y: 340 }] },
    ],
    collectibles: [
      // Egg 1: on starting ledge (y=340), easy to reach
      { x: 270,  y: 310, type: 'egg' },
      // Egg 2: on raised ledge 2 after ramp (y=360)
      { x: 820,  y: 330, type: 'egg' },
      // Egg 3: on ground mid-section
      { x: 1050, y: 468, type: 'egg' },
      // Egg 4: INSIDE tiny-only tunnel — MUST shrink to collect!
      { x: 1100, y: 468, type: 'egg' },
      // Egg 5: on upper shelf, reached by trampoline
      { x: 1290, y: 268, type: 'egg' },
      // Egg 6: on staircase step 2
      { x: 1940, y: 265, type: 'egg' },
      // Powerups
      { x: 230,  y: 300, type: 'speedShoes' },
      { x: 900,  y: 440, type: 'shield' },
    ],
    water: [
      { x: 780, y: 480, w: 100, h: 120 }
    ],
    sizeGates: [
      // Deflator pad — walk through this BEFORE the tiny tunnel
      { x: 940, y: 440, w: 20, h: 40, type: 'deflator' },
      // Resizer pad — return to normal after tunnel
      { x: 1220, y: 440, w: 20, h: 40, type: 'resizer' },
    ],
    exit: { x: 2070, y: 180, w: 40, h: 40 }
  },
  {
    name: 'Rolling Hills',
    bgColor: '#81C784',
    bgColor2: '#A5D6A7',
    width: 3000, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 480, w: 400, h: 120 },
      { x: 300, y: 380, w: 100, h: 20 },
      { x: 520, y: 420, w: 120, h: 20 },
      { x: 720, y: 480, w: 300, h: 120 },
      { x: 1100, y: 480, w: 200, h: 120 },
      { x: 1000, y: 320, w: 120, h: 20 },
      { x: 1400, y: 420, w: 120, h: 20 },
      { x: 1600, y: 480, w: 480, h: 120 }, // Extended to x=2080
      { x: 1550, y: 320, w: 100, h: 20 },
      { x: 2100, y: 480, w: 250, h: 120 }, // Extended to x=2350
      { x: 2420, y: 480, w: 580, h: 120 }, // Starts at x=2420, ends at x=3000
      // Narrow pipe
      { x: 1000, y: 260, w: 100, h: 20 },
      { x: 1000, y: 200, w: 100, h: 20 },
      // Ramp: bridges high ledge (y=320) down to ground (y=480) going left
      { x: 1450, y: 320, w: 150, h: 160, type: 'slide', direction: -1 },
      // === GIANT-ONLY TUNNEL ===
      // Ceiling — bottom at 412 (gap of 68px to ground at y=480). Giant (64px dia) fits.
      { x: 2100, y: 396, w: 200, h: 16, type: 'stone', hint: '🔴 GIANT ONLY' },
    ],
    spikes: [
      { x: 380, y: 456, w: 80, h: 24 },
      { x: 800, y: 456, w: 120, h: 24 },
      { x: 1650, y: 456, w: 80, h: 24 },
    ],
    movingPlatforms: [
      { x: 460, y: 300, w: 80, h: 16, speed: 1.8, delay: 15,
        path: [{ x: 460, y: 300 }, { x: 620, y: 300 }, { x: 620, y: 360 }, { x: 460, y: 360 }] },
      { x: 1900, y: 300, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 1900, y: 300 }, { x: 2050, y: 300 }] },
    ],
    collectibles: [
      { x: 360, y: 350, type: 'egg' },
      { x: 560, y: 390, type: 'egg' },
      { x: 1060, y: 296, type: 'egg' },
      { x: 1600, y: 290, type: 'egg' },
      // Egg inside the giant-only tunnel - now at y=445 so it is not hidden in the ceiling!
      { x: 2200, y: 445, type: 'egg' },
      { x: 2600, y: 440, type: 'egg' },
      // Egg floating nicely above the slide/ramp slope!
      { x: 1510, y: 360, type: 'egg' },
      { x: 1050, y: 235, type: 'speedShoes' },
    ],
    keys: [
      { x: 560, y: 350 },
    ],
    gates: [
      { x: 1350, y: 420, w: 30, h: 60 },
    ],
    water: [
      { x: 2000, y: 480, w: 100, h: 120 }
    ],
    sizeGates: [
      { x: 960, y: 280, w: 20, h: 40, type: 'deflator' },
      { x: 1120, y: 280, w: 20, h: 40, type: 'resizer' },
      // Inflator before the tunnel — force giant to enter
      { x: 2040, y: 440, w: 20, h: 40, type: 'inflator' },
      // Resizer after the tunnel
      { x: 2310, y: 440, w: 20, h: 40, type: 'resizer' },
    ],
    exit: { x: 2800, y: 420, w: 40, h: 60 }
  },
  {
    name: 'The Cavern',
    bgColor: '#37474F',
    bgColor2: '#263238',
    width: 3200, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 500, w: 350, h: 100 },
      { x: 440, y: 500, w: 200, h: 100 },
      { x: 750, y: 460, w: 100, h: 20 },
      { x: 950, y: 500, w: 250, h: 100 },
      { x: 1300, y: 500, w: 200, h: 100 },
      { x: 1200, y: 340, w: 120, h: 20 },
      { x: 1600, y: 500, w: 300, h: 100 },
      { x: 2000, y: 500, w: 200, h: 100 },
      { x: 2300, y: 500, w: 300, h: 100 },
      { x: 2700, y: 500, w: 500, h: 100 },
      // === GIANT-ONLY CHAMBER (tiny & normal physically can't reach egg inside) ===
      // Wide floor for giant ball (64px dia fits easily)
      { x: 2000, y: 440, w: 200, h: 20 }, // raised floor inside chamber
      { x: 2000, y: 350, w: 200, h: 16, type: 'stone', hint: '🔴 GIANT ONLY' }, // ceiling
    ],
    spikes: [
      { x: 330, y: 476, w: 80, h: 24 },
      { x: 1000, y: 476, w: 80, h: 24 },
      { x: 1650, y: 476, w: 100, h: 24 },
      { x: 2020, y: 476, w: 60, h: 24 },
    ],
    movingPlatforms: [
      { x: 400, y: 350, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 400, y: 350 }, { x: 560, y: 350 }, { x: 560, y: 420 }, { x: 400, y: 420 }] },
      { x: 1800, y: 300, w: 80, h: 16, speed: 1.5, delay: 20,
        path: [{ x: 1800, y: 300 }, { x: 1950, y: 300 }, { x: 1950, y: 400 }, { x: 1800, y: 400 }] },
    ],
    collectibles: [
      { x: 150, y: 460, type: 'egg' },
      { x: 800, y: 430, type: 'egg' },
      { x: 1260, y: 310, type: 'egg' },
      { x: 1700, y: 410, type: 'egg' }, // Raised to float safely above spikes at x=1650
      { x: 2400, y: 460, type: 'egg' },
      { x: 2800, y: 460, type: 'egg' },
      // Egg inside the GIANT-ONLY chamber — must inflate to squeeze under ceiling!
      { x: 2090, y: 403, type: 'egg' },
      { x: 500, y: 350, type: 'speedShoes' },
      { x: 2350, y: 440, type: 'shield' },
    ],
    keys: [
      { x: 1260, y: 280 },
    ],
    gates: [
      { x: 2250, y: 440, w: 30, h: 60 },
    ],
    trampolines: [
      { x: 1500, y: 470, w: 60, h: 16 },
    ],
    enemies: [
      { x: 1700, y: 472, w: 28, h: 28, vx: -1, patrolMin: 1620, patrolMax: 1880 },
      { x: 2400, y: 472, w: 28, h: 28, vx: 1, patrolMin: 2320, patrolMax: 2580 },
    ],
    airWalls: [
      { x: 2450, y: -120, w: 60, h: 20, revealed: false },
      { x: 2510, y: -180, w: 60, h: 20, revealed: false },
      { x: 2570, y: -120, w: 60, h: 20, revealed: false },
      { x: 2630, y: -60, w: 60, h: 20, revealed: false },
    ],
    skyPortals: [
      { x: 2600, y: -60, w: 80, h: 80, targetLevel: 'secret-1', used: false },
    ],
    water: [
      { x: 350, y: 500, w: 90, h: 100 },
      { x: 2200, y: 500, w: 100, h: 100 }
    ],
    sizeGates: [
      { x: 770, y: 380, w: 20, h: 40, type: 'deflator' },
      { x: 1250, y: 440, w: 20, h: 40, type: 'resizer' },
      // Inflator before the giant-only chamber
      { x: 1950, y: 460, w: 20, h: 40, type: 'inflator' },
      // Resizer after the chamber
      { x: 2210, y: 460, w: 20, h: 40, type: 'resizer' },
    ],
    exit: { x: 2900, y: 440, w: 40, h: 60 }
  },
  {
    name: 'Ancient Ruins',
    bgColor: '#FFF8E1',
    bgColor2: '#FFECB3',
    width: 3500, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 480, w: 300, h: 120, type: 'stone' },
      { x: 400, y: 480, w: 150, h: 120, type: 'stone' },
      { x: 650, y: 400, w: 120, h: 20 },
      { x: 850, y: 350, w: 120, h: 20 },
      { x: 1050, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 1350, y: 480, w: 150, h: 120, type: 'stone' },
      { x: 1200, y: 320, w: 100, h: 20 },
      { x: 1600, y: 480, w: 300, h: 120, type: 'stone' },
      { x: 2000, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 2300, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 2600, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 2900, y: 480, w: 600, h: 120, type: 'stone' },
      // Tiny tunnel ceiling
      { x: 2350, y: 438, w: 100, h: 16, type: 'stone', hint: '🔵 TINY ONLY' },
    ],
    spikes: [
      { x: 280, y: 456, w: 80, h: 24 },
      { x: 1100, y: 456, w: 80, h: 24 },
      { x: 1630, y: 456, w: 80, h: 24 },
      { x: 2050, y: 456, w: 60, h: 24 },
    ],
    movingPlatforms: [
      { x: 350, y: 300, w: 80, h: 16, speed: 2.2, delay: 8,
        path: [{ x: 350, y: 300 }, { x: 520, y: 300 }] },
      { x: 1500, y: 300, w: 80, h: 16, speed: 1.8, delay: 12,
        path: [{ x: 1500, y: 300 }, { x: 1650, y: 300 }, { x: 1650, y: 380 }, { x: 1500, y: 380 }] },
      { x: 2500, y: 320, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 2500, y: 320 }, { x: 2650, y: 320 }, { x: 2650, y: 400 }, { x: 2500, y: 400 }] },
    ],
    collectibles: [
      { x: 100, y: 440, type: 'egg' },
      { x: 700, y: 370, type: 'egg' },
      { x: 900, y: 320, type: 'egg' },
      { x: 1250, y: 290, type: 'egg' },
      { x: 1670, y: 380, type: 'egg' }, // Relocated to float safely above spikes at x=1630
      { x: 2080, y: 380, type: 'egg' }, // Relocated to float safely above spikes at x=2050
      { x: 3000, y: 440, type: 'egg' },
      // Egg inside tiny tunnel
      { x: 2400, y: 465, type: 'egg' },
    ],
    keys: [
      { x: 900, y: 290 },
      { x: 2100, y: 400 },
    ],
    gates: [
      { x: 1300, y: 420, w: 30, h: 60 },
      { x: 2550, y: 420, w: 30, h: 60 },
    ],
    trampolines: [
      { x: 500, y: 450, w: 60, h: 16 },
    ],
    sizeGates: [
      { x: 2320, y: 440, w: 20, h: 40, type: 'deflator' },
      { x: 2470, y: 440, w: 20, h: 40, type: 'resizer' },
    ],
    exit: { x: 3100, y: 420, w: 40, h: 60 }
  },
  {
    name: 'Crystal Caves',
    bgColor: '#1A237E',
    bgColor2: '#283593',
    width: 3600, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 480, w: 300, h: 120, type: 'stone' },
      { x: 400, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 700, y: 420, w: 100, h: 20 },
      { x: 900, y: 480, w: 250, h: 120, type: 'stone' },
      { x: 1250, y: 480, w: 150, h: 120, type: 'stone' },
      { x: 1150, y: 320, w: 100, h: 20 },
      { x: 1500, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 1800, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 2100, y: 480, w: 300, h: 120, type: 'stone' },
      { x: 2500, y: 480, w: 200, h: 120, type: 'stone' },
      { x: 2800, y: 480, w: 300, h: 120, type: 'stone' },
      { x: 3200, y: 480, w: 400, h: 120, type: 'stone' },
      // Tiny tunnel ceiling
      { x: 1850, y: 438, w: 100, h: 16, type: 'stone', hint: '🔵 TINY ONLY' },
    ],
    spikes: [
      { x: 280, y: 456, w: 80, h: 24 },
      { x: 950, y: 456, w: 80, h: 24 },
      { x: 1320, y: 456, w: 60, h: 24 }, // Moved to right to prevent overlap with trampoline
      { x: 1550, y: 456, w: 80, h: 24 },
      { x: 2150, y: 456, w: 80, h: 24 },
    ],
    breakableWalls: [
      { x: 1080, y: 460, w: 40, h: 20, broken: false },
      { x: 1400, y: 460, w: 40, h: 20, broken: false },
      { x: 2000, y: 460, w: 60, h: 20, broken: false },
    ],
    movingPlatforms: [
      { x: 350, y: 320, w: 80, h: 16, speed: 2.5, delay: 5,
        path: [{ x: 350, y: 320 }, { x: 520, y: 320 }] },
      { x: 1600, y: 320, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 1600, y: 320 }, { x: 1750, y: 320 }, { x: 1750, y: 400 }, { x: 1600, y: 400 }] },
      { x: 2300, y: 300, w: 80, h: 16, speed: 1.8, delay: 15,
        path: [{ x: 2300, y: 300 }, { x: 2450, y: 300 }, { x: 2450, y: 380 }, { x: 2300, y: 380 }] },
    ],
    collectibles: [
      { x: 450, y: 440, type: 'egg' },
      { x: 750, y: 390, type: 'egg' },
      { x: 1200, y: 290, type: 'egg' },
      { x: 1700, y: 440, type: 'egg' },
      { x: 1900, y: 468, type: 'egg' }, // placed inside the tiny tunnel
      { x: 2600, y: 440, type: 'egg' },
      { x: 3000, y: 440, type: 'egg' },
      { x: 3400, y: 440, type: 'egg' },
    ],
    keys: [
      { x: 1200, y: 260 },
    ],
    gates: [
      { x: 1850, y: 420, w: 30, h: 60 },
    ],
    transforms: [
      { x: 450, y: 440, type: FORM_BUMPY },
    ],
    enemies: [
      { x: 1400, y: 452, w: 28, h: 28, vx: -1, patrolMin: 1300, patrolMax: 1540 },
      { x: 2100, y: 452, w: 28, h: 28, vx: 1, patrolMin: 2050, patrolMax: 2250 },
    ],
    trampolines: [
      { x: 1250, y: 464, w: 50, h: 16 }, // Width and position adjusted to prevent overlap with spikes
    ],
    sizeGates: [
      { x: 1820, y: 440, w: 20, h: 40, type: 'deflator' },
      { x: 1960, y: 440, w: 20, h: 40, type: 'resizer' },
    ],
    airWalls: [
      { x: 2950, y: -120, w: 60, h: 20, revealed: false },
      { x: 3010, y: -180, w: 60, h: 20, revealed: false },
      { x: 3070, y: -120, w: 60, h: 20, revealed: false },
      { x: 3130, y: -60, w: 60, h: 20, revealed: false },
    ],
    skyPortals: [
      { x: 3100, y: -60, w: 80, h: 80, targetLevel: 'secret-2', used: false },
    ],
    exit: { x: 3400, y: 420, w: 40, h: 60 }
  },
  {
    name: 'Cloud Kingdom',
    bgColor: '#E3F2FD',
    bgColor2: '#BBDEFB',
    width: 3800, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 460, w: 250, h: 140 },
      { x: 350, y: 400, w: 100, h: 20, type: 'cloud' },
      { x: 550, y: 460, w: 200, h: 140 },
      { x: 850, y: 350, w: 100, h: 20, type: 'cloud' },
      { x: 1050, y: 460, w: 200, h: 140 },
      { x: 1350, y: 300, w: 100, h: 20, type: 'cloud' },
      { x: 1550, y: 460, w: 200, h: 140 },
      { x: 1850, y: 350, w: 100, h: 20, type: 'cloud' },
      { x: 2050, y: 460, w: 250, h: 140 },
      { x: 2400, y: 400, w: 100, h: 20, type: 'cloud' },
      { x: 2600, y: 460, w: 200, h: 140 },
      { x: 2900, y: 350, w: 100, h: 20, type: 'cloud' },
      { x: 3100, y: 460, w: 250, h: 140 },
      { x: 3450, y: 460, w: 350, h: 140 },
      // Tiny tunnel ceiling
      { x: 2110, y: 418, w: 100, h: 16, type: 'stone', hint: '🔵 TINY ONLY' },
    ],
    spikes: [
      { x: 230, y: 436, w: 80, h: 24 },
      { x: 600, y: 436, w: 80, h: 24 },
      { x: 1100, y: 436, w: 80, h: 24 },
      { x: 1600, y: 436, w: 80, h: 24 },
    ],
    movingPlatforms: [
      { x: 2200, y: 300, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 2200, y: 300 }, { x: 2350, y: 300 }] },
      { x: 2700, y: 320, w: 80, h: 16, speed: 2.2, delay: 8,
        path: [{ x: 2700, y: 320 }, { x: 2850, y: 320 }, { x: 2850, y: 400 }, { x: 2700, y: 400 }] },
    ],
    collectibles: [
      { x: 400, y: 370, type: 'egg' },
      { x: 900, y: 320, type: 'egg' },
      { x: 1400, y: 270, type: 'egg' },
      { x: 1900, y: 320, type: 'egg' },
      { x: 2450, y: 370, type: 'egg' },
      { x: 2950, y: 320, type: 'egg' },
      { x: 3300, y: 420, type: 'egg' },
      // Egg inside tiny tunnel
      { x: 2160, y: 448, type: 'egg' },
    ],
    keys: [
      { x: 1400, y: 240 },
    ],
    gates: [
      { x: 2500, y: 400, w: 30, h: 60 },
    ],
    sizeGates: [
      { x: 2070, y: 420, w: 20, h: 40, type: 'deflator' },
      { x: 2220, y: 420, w: 20, h: 40, type: 'resizer' },
    ],
    transforms: [
      { x: 800, y: 300, type: FORM_WOLLY },
    ],
    lasers: [
      { x: 2200, y: 380, w: 100, h: 12, active: false },
      { x: 2700, y: 380, w: 100, h: 12, active: false },
    ],
    exit: { x: 3600, y: 400, w: 40, h: 60 }
  },
  {
    name: 'Lava Land',
    bgColor: '#BF360C',
    bgColor2: '#E65100',
    width: 4000, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 460, w: 200, h: 140 },
      { x: 300, y: 460, w: 150, h: 140 },
      { x: 550, y: 380, w: 100, h: 20 },
      { x: 750, y: 460, w: 200, h: 140 },
      { x: 1050, y: 460, w: 150, h: 140 },
      { x: 1300, y: 460, w: 200, h: 140 },
      { x: 1600, y: 460, w: 150, h: 140 },
      { x: 1850, y: 460, w: 200, h: 140 },
      { x: 2150, y: 460, w: 200, h: 140 },
      { x: 2450, y: 460, w: 200, h: 140 },
      { x: 2750, y: 460, w: 200, h: 140 },
      { x: 3050, y: 460, w: 200, h: 140 },
      { x: 3350, y: 460, w: 200, h: 140 },
      { x: 3650, y: 460, w: 350, h: 140 },
      // Giant tunnel ceiling
      { x: 1350, y: 358, w: 100, h: 16, type: 'stone', hint: '🔴 GIANT ONLY' },
    ],
    lava: [
      { x: 200, y: 484, w: 100, h: 16 },
      { x: 450, y: 484, w: 100, h: 16 },
      { x: 700, y: 484, w: 50, h: 16 },
      { x: 950, y: 484, w: 100, h: 16 },
      { x: 1200, y: 484, w: 100, h: 16 },
      { x: 1500, y: 484, w: 100, h: 16 },
      { x: 1750, y: 484, w: 100, h: 16 },
      { x: 2050, y: 484, w: 100, h: 16 },
      { x: 2350, y: 484, w: 100, h: 16 },
      { x: 2650, y: 484, w: 100, h: 16 },
      { x: 2950, y: 484, w: 100, h: 16 },
      { x: 3250, y: 484, w: 100, h: 16 },
    ],
    spikes: [
      { x: 800, y: 436, w: 60, h: 24 },
      { x: 1100, y: 436, w: 60, h: 24 },
      { x: 1650, y: 436, w: 60, h: 24 },
      { x: 2200, y: 436, w: 60, h: 24 },
      { x: 2800, y: 436, w: 60, h: 24 },
    ],
    movingPlatforms: [
      { x: 350, y: 320, w: 80, h: 16, speed: 2.5, delay: 5,
        path: [{ x: 350, y: 320 }, { x: 500, y: 320 }, { x: 500, y: 400 }, { x: 350, y: 400 }] },
      { x: 1400, y: 320, w: 80, h: 16, speed: 3, delay: 5,
        path: [{ x: 1400, y: 320 }, { x: 1550, y: 320 }] },
      { x: 2500, y: 300, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 2500, y: 300 }, { x: 2650, y: 300 }, { x: 2650, y: 380 }, { x: 2500, y: 380 }] },
      { x: 3200, y: 320, w: 80, h: 16, speed: 2.5, delay: 8,
        path: [{ x: 3200, y: 320 }, { x: 3350, y: 320 }] },
    ],
    collectibles: [
      { x: 400, y: 420, type: 'egg' },
      { x: 600, y: 350, type: 'egg' },
      { x: 900, y: 420, type: 'egg' },
      { x: 1400, y: 424, type: 'egg' }, // inside giant tunnel
      { x: 1900, y: 420, type: 'egg' },
      { x: 2500, y: 420, type: 'egg' },
      { x: 3100, y: 420, type: 'egg' },
      { x: 3700, y: 420, type: 'egg' },
      { x: 1800, y: 300, type: 'life' },
    ],
    keys: [
      { x: 1900, y: 380 },
    ],
    gates: [
      { x: 2250, y: 400, w: 30, h: 60 },
    ],
    sizeGates: [
      { x: 1320, y: 420, w: 20, h: 40, type: 'inflator' },
      { x: 1480, y: 420, w: 20, h: 40, type: 'resizer' },
    ],
    transforms: [
      { x: 350, y: 420, type: FORM_BUMPY },
      { x: 1900, y: 250, type: FORM_WOLLY },
    ],
    breakableWalls: [
      { x: 600, y: 440, w: 40, h: 20, broken: false },
    ],
    enemies: [
      { x: 1450, y: 432, w: 28, h: 28, vx: -1, patrolMin: 1380, patrolMax: 1520 },
      { x: 2300, y: 432, w: 28, h: 28, vx: 1, patrolMin: 2200, patrolMax: 2400 },
      { x: 3100, y: 432, w: 28, h: 28, vx: 1, patrolMin: 3000, patrolMax: 3200 },
    ],
    lasers: [
      { x: 1400, y: 400, w: 120, h: 12, active: false },
      { x: 2200, y: 380, w: 120, h: 12, active: false },
      { x: 2900, y: 400, w: 120, h: 12, active: false },
    ],
    trampolines: [
      { x: 800, y: 430, w: 60, h: 16 },
      { x: 2500, y: 430, w: 60, h: 16 },
    ],
    airWalls: [
      { x: 3350, y: -120, w: 60, h: 20, revealed: false },
      { x: 3410, y: -180, w: 60, h: 20, revealed: false },
      { x: 3470, y: -120, w: 60, h: 20, revealed: false },
      { x: 3530, y: -60, w: 60, h: 20, revealed: false },
    ],
    skyPortals: [
      { x: 3500, y: -60, w: 80, h: 80, targetLevel: 'secret-3', used: false },
    ],
    exit: { x: 3800, y: 400, w: 40, h: 60 }
  },
  {
    name: "The Hypno Cube's Lair",
    bgColor: '#1A0033',
    bgColor2: '#2D0050',
    width: 5000, height: 600,
    playerStart: { x: 80, y: 400 },
    platforms: [
      { x: 0, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 300, y: 460, w: 150, h: 140, type: 'stone' },
      { x: 550, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 850, y: 460, w: 150, h: 140, type: 'stone' },
      { x: 800, y: 320, w: 100, h: 20 },
      { x: 1100, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 1400, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 1700, y: 460, w: 250, h: 140, type: 'stone' },
      { x: 2050, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 2000, y: 300, w: 100, h: 20 },
      { x: 2350, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 2650, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 2950, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 3250, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 3550, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 3850, y: 460, w: 250, h: 140, type: 'stone' },
      { x: 4200, y: 460, w: 200, h: 140, type: 'stone' },
      { x: 4500, y: 460, w: 500, h: 140, type: 'stone' },
    ],
    lava: [
      { x: 150, y: 484, w: 100, h: 16 },
      { x: 450, y: 484, w: 100, h: 16 },
      { x: 750, y: 484, w: 100, h: 16 },
      { x: 1050, y: 484, w: 50, h: 16 },
      { x: 1300, y: 484, w: 100, h: 16 },
      { x: 1600, y: 484, w: 100, h: 16 },
      { x: 1950, y: 484, w: 100, h: 16 },
      { x: 2250, y: 484, w: 100, h: 16 },
      { x: 2550, y: 484, w: 100, h: 16 },
      { x: 2850, y: 484, w: 100, h: 16 },
      { x: 3150, y: 484, w: 100, h: 16 },
      { x: 3450, y: 484, w: 100, h: 16 },
      { x: 3750, y: 484, w: 100, h: 16 },
      { x: 4100, y: 484, w: 100, h: 16 },
    ],
    spikes: [
      { x: 350, y: 436, w: 60, h: 24 },
      { x: 600, y: 436, w: 60, h: 24 },
      { x: 900, y: 436, w: 60, h: 24 },
      { x: 1150, y: 436, w: 60, h: 24 },
      { x: 1450, y: 436, w: 60, h: 24 },
      { x: 1750, y: 436, w: 60, h: 24 },
      { x: 2100, y: 436, w: 60, h: 24 },
      { x: 2400, y: 436, w: 60, h: 24 },
      { x: 2700, y: 436, w: 60, h: 24 },
      { x: 3000, y: 436, w: 60, h: 24 },
      { x: 3300, y: 436, w: 60, h: 24 },
      { x: 3600, y: 436, w: 60, h: 24 },
    ],
    breakableWalls: [
      { x: 520, y: 440, w: 40, h: 20, broken: false },
      { x: 1700, y: 440, w: 60, h: 20, broken: false },
      { x: 3000, y: 440, w: 40, h: 20, broken: false },
      { x: 4000, y: 440, w: 60, h: 20, broken: false },
    ],
    movingPlatforms: [
      { x: 250, y: 300, w: 80, h: 16, speed: 3, delay: 5,
        path: [{ x: 250, y: 300 }, { x: 420, y: 300 }, { x: 420, y: 380 }, { x: 250, y: 380 }] },
      { x: 1200, y: 300, w: 80, h: 16, speed: 2.5, delay: 8,
        path: [{ x: 1200, y: 300 }, { x: 1350, y: 300 }] },
      { x: 1800, y: 300, w: 80, h: 16, speed: 2.8, delay: 5,
        path: [{ x: 1800, y: 300 }, { x: 1950, y: 300 }, { x: 1950, y: 380 }, { x: 1800, y: 380 }] },
      { x: 2500, y: 320, w: 80, h: 16, speed: 3, delay: 5,
        path: [{ x: 2500, y: 320 }, { x: 2650, y: 320 }, { x: 2650, y: 400 }, { x: 2500, y: 400 }] },
      { x: 3100, y: 300, w: 80, h: 16, speed: 2.5, delay: 8,
        path: [{ x: 3100, y: 300 }, { x: 3250, y: 300 }] },
      { x: 3700, y: 320, w: 80, h: 16, speed: 3, delay: 5,
        path: [{ x: 3700, y: 320 }, { x: 3850, y: 320 }, { x: 3850, y: 400 }, { x: 3700, y: 400 }] },
    ],
    collectibles: [
      { x: 850, y: 290, type: 'egg' },
      { x: 1180, y: 350, type: 'egg' }, // Raised to float safely above spikes at x=1150
      { x: 1480, y: 350, type: 'egg' }, // Raised to float safely above spikes at x=1450
      { x: 2050, y: 270, type: 'egg' },
      { x: 2430, y: 350, type: 'egg' }, // Raised to float safely above spikes at x=2400
      { x: 2730, y: 350, type: 'egg' }, // Raised to float safely above spikes at x=2700
      { x: 3400, y: 420, type: 'egg' },
      { x: 3900, y: 420, type: 'egg' },
      { x: 4300, y: 420, type: 'egg' },
      { x: 4600, y: 420, type: 'egg' },
      { x: 1000, y: 420, type: 'life' },
      { x: 3500, y: 420, type: 'life' },
    ],
    keys: [
      { x: 1500, y: 380 },
      { x: 2700, y: 380 },
      { x: 3900, y: 380 },
    ],
    gates: [
      { x: 1100, y: 400, w: 30, h: 60 },
      { x: 2300, y: 400, w: 30, h: 60 },
      { x: 3550, y: 400, w: 30, h: 60 },
      { x: 4150, y: 400, w: 30, h: 60 },
    ],
    transforms: [
      { x: 300, y: 420, type: FORM_WOLLY },
      { x: 2000, y: 250, type: FORM_BUMPY },
    ],
    exit: { x: 4700, y: 400, w: 40, h: 60 }
  },
  // ─── LEVEL 9: Neon City ───────────────────────────────────────────
  {
    name: 'Neon City',
    bgColor: '#0a001a',
    bgColor2: '#120030',
    width: 3200, height: 600,
    playerStart: { x: 80, y: 440 },
    platforms: [
      { x: 0,    y: 520, w: 340,  h: 80  },
      { x: 420,  y: 520, w: 220,  h: 80  },
      { x: 740,  y: 520, w: 200,  h: 80  },
      { x: 1040, y: 520, w: 300,  h: 80  },
      { x: 1460, y: 520, w: 280,  h: 80  },
      { x: 1860, y: 520, w: 260,  h: 80  },
      { x: 2260, y: 520, w: 300,  h: 80  },
      { x: 2700, y: 520, w: 500,  h: 80  },
      { x: 200,  y: 380, w: 100,  h: 18  },
      { x: 460,  y: 320, w: 100,  h: 18  },
      { x: 720,  y: 260, w: 100,  h: 18  },
      { x: 980,  y: 340, w: 100,  h: 18  },
      { x: 1200, y: 400, w: 120,  h: 18  },
      { x: 1560, y: 340, w: 100,  h: 18  },
      { x: 1740, y: 270, w: 100,  h: 18  },
      { x: 2060, y: 360, w: 120,  h: 18  },
      { x: 2380, y: 300, w: 100,  h: 18  },
      { x: 2560, y: 390, w: 100,  h: 18  },
    ],
    movingPlatforms: [
      { x: 340, y: 400, w: 80, h: 16, speed: 2.5, delay: 0,
        path: [{ x: 340, y: 400 }, { x: 420, y: 400 }] },
      { x: 1100, y: 360, w: 80, h: 16, speed: 3, delay: 0,
        path: [{ x: 1100, y: 360 }, { x: 1300, y: 360 }] },
      { x: 1960, y: 300, w: 80, h: 16, speed: 3.5, delay: 0,
        path: [{ x: 1960, y: 300 }, { x: 2100, y: 300 }, { x: 2100, y: 380 }, { x: 1960, y: 380 }] },
      { x: 2650, y: 340, w: 80, h: 16, speed: 2.8, delay: 0,
        path: [{ x: 2650, y: 340 }, { x: 2750, y: 340 }] },
    ],
    lasers: [
      { x: 640,  y: 500, w: 16, h: 100, period: 120, offset: 0   },
      { x: 1360, y: 460, w: 16, h: 140, period: 100, offset: 30  },
      { x: 1800, y: 480, w: 16, h: 120, period: 80,  offset: 60  },
      { x: 2200, y: 460, w: 16, h: 140, period: 90,  offset: 20  },
      { x: 2630, y: 480, w: 16, h: 120, period: 70,  offset: 45  },
    ],
    enemies: [
      { x: 800,  y: 486, w: 32, h: 32, vx: 1.5, patrolMin: 740,  patrolMax: 940  },
      { x: 1500, y: 486, w: 32, h: 32, vx: 2,   patrolMin: 1460, patrolMax: 1740 },
      { x: 2300, y: 486, w: 32, h: 32, vx: 2.2, patrolMin: 2260, patrolMax: 2560 },
    ],
    spikes: [
      { x: 340,  y: 496, w: 80,  h: 24 },
      { x: 940,  y: 496, w: 100, h: 24 },
      { x: 2700, y: 496, w: 60,  h: 24 },
    ],
    collectibles: [
      { x: 220,  y: 350, type: 'egg'  },
      { x: 480,  y: 290, type: 'egg'  },
      { x: 740,  y: 230, type: 'egg'  },
      { x: 1000, y: 310, type: 'egg'  },
      { x: 1580, y: 310, type: 'egg'  },
      { x: 1760, y: 240, type: 'egg'  },
      { x: 2400, y: 270, type: 'egg'  },
      { x: 2580, y: 360, type: 'egg'  },
      { x: 1200, y: 370, type: 'life' },
    ],
    keys: [{ x: 1760, y: 240 }],
    gates: [{ x: 2650, y: 460, w: 30, h: 60 }],
    transforms: [
      { x: 200, y: 480, type: FORM_WOLLY }
    ],
    windColumns: [
      { x: 800, y: 100, w: 80, h: 420 }
    ],
    dashPads: [
      { x: 500, y: 502, w: 40, h: 18, direction: 1 },
      { x: 1500, y: 502, w: 40, h: 18, direction: 1 }
    ],
    exit: { x: 2900, y: 460, w: 40, h: 60 }
  },

  // ─── LEVEL 10: Crystal Caves ──────────────────────────────────────
  {
    name: 'Prism Caves',
    bgColor: '#0d1b2a',
    bgColor2: '#162032',
    width: 2800, height: 600,
    playerStart: { x: 80, y: 460 },
    platforms: [
      { x: 0,    y: 520, w: 280, h: 80  },
      { x: 380,  y: 520, w: 180, h: 80  },
      { x: 660,  y: 460, w: 160, h: 20  },
      { x: 880,  y: 400, w: 140, h: 20  },
      { x: 1080, y: 340, w: 160, h: 20  },
      { x: 1300, y: 280, w: 140, h: 20  },
      { x: 1500, y: 340, w: 140, h: 20  },
      { x: 1700, y: 400, w: 160, h: 20  },
      { x: 1920, y: 440, w: 300, h: 80  },
      { x: 2280, y: 380, w: 120, h: 20  },
      { x: 2460, y: 320, w: 120, h: 20  },
      { x: 2640, y: 440, w: 160, h: 80  },
      // walls
      { x: 560,  y: 400, w: 20,  h: 200 },
      { x: 1440, y: 200, w: 20,  h: 160 },
      { x: 2220, y: 300, w: 20,  h: 300 },
    ],
    trampolines: [
      { x: 380,  y: 498, w: 80, h: 16 },
      { x: 1200, y: 498, w: 80, h: 16 },
      { x: 2000, y: 408, w: 80, h: 16 },
    ],
    enemies: [
      { x: 700,  y: 425, w: 30, h: 30, vx: 1.5, patrolMin: 660,  patrolMax: 820  },
      { x: 1300, y: 245, w: 30, h: 30, vx: 1.8, patrolMin: 1300, patrolMax: 1440 },
      { x: 1720, y: 365, w: 30, h: 30, vx: 2,   patrolMin: 1700, patrolMax: 1860 },
      { x: 2290, y: 345, w: 30, h: 30, vx: 2.2, patrolMin: 2280, patrolMax: 2380 },
    ],
    spikes: [
      { x: 280,  y: 496, w: 100, h: 24 },
      { x: 820,  y: 376, w: 60,  h: 24 },
      { x: 1920, y: 416, w: 80,  h: 24 },
      { x: 2560, y: 296, w: 80,  h: 24 },
    ],
    collectibles: [
      { x: 150,  y: 490, type: 'egg'  },
      { x: 430,  y: 490, type: 'egg'  },
      { x: 700,  y: 430, type: 'egg'  },
      { x: 920,  y: 370, type: 'egg'  },
      { x: 1120, y: 310, type: 'egg'  },
      { x: 1340, y: 250, type: 'egg'  },
      { x: 1540, y: 310, type: 'egg'  },
      { x: 2300, y: 350, type: 'egg'  },
      { x: 2480, y: 290, type: 'egg'  },
      { x: 950,  y: 370, type: 'life' },
    ],
    keys: [],
    gates: [{ x: 2400, y: 260, w: 30, h: 60 }],
    transforms: [
      { x: 200, y: 480, type: FORM_BUMPY }
    ],
    weightSwitches: [
      { x: 1080, y: 330, w: 40, h: 10, pressed: false, targetGateIndex: 0 }
    ],
    exit: { x: 2700, y: 380, w: 40, h: 60 }
  },

  // ─── LEVEL 11: Volcano Summit ─────────────────────────────────────
  {
    name: 'Volcano Summit',
    bgColor: '#1a0000',
    bgColor2: '#2d0500',
    width: 3400, height: 600,
    playerStart: { x: 80, y: 440 },
    platforms: [
      { x: 0,    y: 520, w: 300,  h: 80  },
      { x: 400,  y: 520, w: 200,  h: 80  },
      { x: 700,  y: 480, w: 160,  h: 20  },
      { x: 960,  y: 420, w: 160,  h: 20  },
      { x: 1200, y: 360, w: 140,  h: 20  },
      { x: 1440, y: 300, w: 160,  h: 20  },
      { x: 1700, y: 360, w: 140,  h: 20  },
      { x: 1940, y: 420, w: 200,  h: 80  },
      { x: 2220, y: 360, w: 160,  h: 20  },
      { x: 2480, y: 300, w: 140,  h: 20  },
      { x: 2720, y: 360, w: 160,  h: 20  },
      { x: 2980, y: 430, w: 420,  h: 80  },
      // Lava floors (spikes will cover these gaps)
      { x: 300,  y: 540, w: 100,  h: 60  },
      { x: 600,  y: 540, w: 100,  h: 60  },
    ],
    movingPlatforms: [
      { x: 300,  y: 460, w: 100, h: 16, speed: 3,   delay: 0,
        path: [{ x: 300, y: 460 }, { x: 400, y: 460 }] },
      { x: 860,  y: 360, w: 100, h: 16, speed: 2.5, delay: 0,
        path: [{ x: 860, y: 360 }, { x: 1060, y: 360 }] },
      { x: 1600, y: 260, w: 100, h: 16, speed: 3.5, delay: 0,
        path: [{ x: 1600, y: 260 }, { x: 1760, y: 260 }] },
      { x: 2140, y: 300, w: 100, h: 16, speed: 3,   delay: 0,
        path: [{ x: 2140, y: 300 }, { x: 2380, y: 300 }] },
      { x: 2640, y: 240, w: 100, h: 16, speed: 4,   delay: 0,
        path: [{ x: 2640, y: 240 }, { x: 2860, y: 240 }] },
    ],
    enemies: [
      { x: 450,  y: 486, w: 34, h: 34, vx: 2,   patrolMin: 400,  patrolMax: 600  },
      { x: 1000, y: 386, w: 34, h: 34, vx: 2.5, patrolMin: 960,  patrolMax: 1120 },
      { x: 1460, y: 266, w: 34, h: 34, vx: 3,   patrolMin: 1440, patrolMax: 1600 },
      { x: 1960, y: 386, w: 34, h: 34, vx: 2.5, patrolMin: 1940, patrolMax: 2140 },
      { x: 2500, y: 266, w: 34, h: 34, vx: 3.5, patrolMin: 2480, patrolMax: 2620 },
      { x: 3050, y: 396, w: 34, h: 34, vx: 2,   patrolMin: 2980, patrolMax: 3200 },
    ],
    lasers: [
      { x: 880,  y: 400, w: 16, h: 200, period: 110, offset: 0  },
      { x: 1640, y: 340, w: 16, h: 260, period: 90,  offset: 55 },
      { x: 2400, y: 280, w: 16, h: 320, period: 75,  offset: 30 },
      { x: 2860, y: 340, w: 16, h: 260, period: 100, offset: 15 },
    ],
    spikes: [
      { x: 300,  y: 496, w: 100, h: 24 },
      { x: 600,  y: 496, w: 100, h: 24 },
      { x: 1120, y: 396, w: 80,  h: 24 },
      { x: 1340, y: 336, w: 100, h: 24 },
      { x: 1840, y: 396, w: 100, h: 24 },
      { x: 2620, y: 336, w: 100, h: 24 },
      { x: 2860, y: 336, w: 120, h: 24 },
    ],
    collectibles: [
      { x: 450,  y: 490, type: 'egg'  },
      { x: 730,  y: 450, type: 'egg'  },
      { x: 990,  y: 390, type: 'egg'  },
      { x: 1230, y: 330, type: 'egg'  },
      { x: 1470, y: 270, type: 'egg'  },
      { x: 1730, y: 330, type: 'egg'  },
      { x: 2010, y: 390, type: 'egg'  },
      { x: 2510, y: 270, type: 'egg'  },
      { x: 3050, y: 400, type: 'egg'  },
      { x: 3200, y: 400, type: 'egg'  },
      { x: 1200, y: 330, type: 'life' },
    ],
    keys: [{ x: 1470, y: 268 }],
    gates: [{ x: 2980, y: 368, w: 30, h: 60 }],
    transforms: [
      { x: 730, y: 448, type: 'bumpy' }
    ],
    exit: { x: 3300, y: 370, w: 40, h: 60 }
  },

  // ─── LEVEL 12: Hypnotoid Core ──────────────────────────────────────
  {
    name: 'Hypnotoid Core',
    bgColor: '#08000d',
    bgColor2: '#10001a',
    width: 2000, height: 600,
    playerStart: { x: 120, y: 440 },
    platforms: [
      { x: 0,    y: 520, w: 2000, h: 80 },
      { x: 350,  y: 360, w: 200, h: 20 },
      { x: 750,  y: 280, w: 500, h: 20 },
      { x: 1450, y: 360, w: 200, h: 20 },
    ],
    collectibles: [
      { x: 450, y: 320, type: 'egg' },
      { x: 1000, y: 240, type: 'egg' },
      { x: 1550, y: 320, type: 'egg' },
      { x: 150, y: 300, type: 'speedShoes' },
      { x: 1850, y: 300, type: 'shield' },
    ],
    transforms: [
      { x: 150, y: 460, type: FORM_BOUNCE }
    ],
    boss: {
      x: 900, y: 140, w: 120, h: 120,
      health: 5, maxHealth: 5,
      patrolMin: 400, patrolMax: 1600,
      active: true
    },
    exit: { x: 1750, y: 460, w: 40, h: 60 }
  }
];

const SECRET_LEVEL_DATA = [
  {
    name: 'Sky Paradise',
    bgColor: '#80DEEA',
    bgColor2: '#B2EBF2',
    width: 1600, height: 600,
    playerStart: { x: 80, y: 300 },
    platforms: [
      { x: 0, y: 380, w: 200, h: 220, type: 'cloud' },
      { x: 300, y: 320, w: 100, h: 20, type: 'cloud' },
      { x: 500, y: 380, w: 200, h: 220, type: 'cloud' },
      { x: 800, y: 300, w: 100, h: 20, type: 'cloud' },
      { x: 1000, y: 380, w: 200, h: 220, type: 'cloud' },
      { x: 1300, y: 380, w: 280, h: 220, type: 'cloud' },
    ],
    collectibles: [
      { x: 350, y: 290, type: 'egg' },
      { x: 850, y: 270, type: 'egg' },
      { x: 1100, y: 340, type: 'egg' },
      { x: 1400, y: 340, type: 'egg' },
    ],
    exit: { x: 1500, y: 320, w: 40, h: 60 },
    isSecret: true,
    returnLevel: 2
  },
  {
    name: 'Starry Sky',
    bgColor: '#1A237E',
    bgColor2: '#283593',
    width: 2000, height: 600,
    playerStart: { x: 80, y: 300 },
    platforms: [
      { x: 0, y: 400, w: 150, h: 200 },
      { x: 250, y: 340, w: 100, h: 20 },
      { x: 450, y: 400, w: 150, h: 200 },
      { x: 700, y: 320, w: 100, h: 20 },
      { x: 900, y: 400, w: 200, h: 200 },
      { x: 1200, y: 400, w: 200, h: 200 },
      { x: 1500, y: 400, w: 200, h: 200 },
      { x: 1800, y: 400, w: 200, h: 200 },
    ],
    movingPlatforms: [
      { x: 200, y: 260, w: 80, h: 16, speed: 2.5, delay: 5,
        path: [{ x: 200, y: 260 }, { x: 350, y: 260 }] },
      { x: 1100, y: 280, w: 80, h: 16, speed: 2, delay: 10,
        path: [{ x: 1100, y: 280 }, { x: 1250, y: 280 }, { x: 1250, y: 340 }, { x: 1100, y: 340 }] },
    ],
    collectibles: [
      { x: 300, y: 310, type: 'egg' },
      { x: 750, y: 290, type: 'egg' },
      { x: 1000, y: 360, type: 'egg' },
      { x: 1300, y: 360, type: 'egg' },
      { x: 1600, y: 360, type: 'egg' },
      { x: 1900, y: 360, type: 'egg' },
      { x: 500, y: 360, type: 'life' },
    ],
    spikes: [
      { x: 950, y: 376, w: 60, h: 24 },
      { x: 1850, y: 376, w: 60, h: 24 },
    ],
    exit: { x: 1900, y: 340, w: 40, h: 60 },
    isSecret: true,
    returnLevel: 4
  },
  {
    name: 'Rainbow Summit',
    bgColor: '#FF80AB',
    bgColor2: '#B388FF',
    width: 2400, height: 600,
    playerStart: { x: 80, y: 300 },
    platforms: [
      { x: 0, y: 400, w: 150, h: 200 },
      { x: 250, y: 350, w: 100, h: 20 },
      { x: 450, y: 400, w: 150, h: 200 },
      { x: 700, y: 320, w: 80, h: 20 },
      { x: 900, y: 400, w: 200, h: 200 },
      { x: 1200, y: 400, w: 200, h: 200 },
      { x: 1500, y: 400, w: 200, h: 200 },
      { x: 1800, y: 400, w: 200, h: 200 },
      { x: 2100, y: 400, w: 300, h: 200 },
    ],
    movingPlatforms: [
      { x: 200, y: 260, w: 80, h: 16, speed: 2.8, delay: 5,
        path: [{ x: 200, y: 260 }, { x: 370, y: 260 }, { x: 370, y: 320 }, { x: 200, y: 320 }] },
      { x: 800, y: 240, w: 80, h: 16, speed: 3, delay: 3,
        path: [{ x: 800, y: 240 }, { x: 950, y: 240 }] },
      { x: 1600, y: 280, w: 80, h: 16, speed: 2.5, delay: 8,
        path: [{ x: 1600, y: 280 }, { x: 1750, y: 280 }, { x: 1750, y: 350 }, { x: 1600, y: 350 }] },
    ],
    collectibles: [
      { x: 300, y: 320, type: 'egg' },
      { x: 750, y: 290, type: 'egg' },
      { x: 1000, y: 360, type: 'egg' },
      { x: 1300, y: 360, type: 'egg' },
      { x: 1700, y: 360, type: 'egg' },
      { x: 2200, y: 360, type: 'egg' },
      { x: 500, y: 360, type: 'life' },
    ],
    spikes: [
      { x: 500, y: 376, w: 60, h: 24 },
      { x: 1250, y: 376, w: 80, h: 24 },
      { x: 1650, y: 376, w: 60, h: 24 },
    ],
    gates: [
      { x: 1300, y: 340, w: 30, h: 60 },
    ],
    keys: [
      { x: 750, y: 260 },
    ],
    exit: { x: 2300, y: 340, w: 40, h: 60 },
    isSecret: true,
    returnLevel: 6
  },

];
