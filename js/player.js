class Player {
  constructor(x, y) {
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.form = FORM_BOUNCE;
    this.lives = 3;
    this.dead = false;
    this.deathTimer = 0;
    this.score = 0;
    this.eggs = 0;
    this.hasKey = false;
    this.eyeBlink = 0;
    this.squash = 1;
    this.stretch = 1;
    this.flying = false;
    this.wasOnGround = false;
    this.bounceTimer = 0;
    this.flyParticles = 0;
    this.cheatBuffer = [];
    this.invulnerable = false;
    this.invulTimer = 0;
    this.invulCooldown = 0;
    this.fireballCooldown = 0;
    this.flightFuel = FLIGHT_FUEL_MAX;
    this.lastDirection = 1;
    
    // Ultimate Pack additions
    this.sizeMultiplier = 1.0;
    this.speedShoesTimer = 0;
    this.shieldTimer = 0;
    this.inWater = false;
  }

  get config() {
    return FORM_CONFIG[this.form];
  }

  applyForm(form) {
    this.form = form;
    this.radius = this.config.radius;
  }

  enableFly() {
    if (this.flightFuel <= 0 && !this.flying) return;
    this.flying = !this.flying;
    if (this.flying) {
      this.vy = -2;
      this.bounceTimer = 60;
    }
  }

  get drawColor() {
    if (this.invulnerable) return COLORS.invul;
    if (this.flying) return '#00BCD4';
    return this.config.color;
  }

  update(level) {
    if (this.dead) {
      this.deathTimer--;
      if (this.deathTimer <= 0) {
        this.dead = false;
        this.x = level.playerStart.x;
        this.y = level.playerStart.y;
        this.vx = 0;
        this.vy = 0;
      }
      return;
    }

    if (this.invulCooldown > 0) this.invulCooldown--;
    if (this.invulnerable) {
      this.invulTimer--;
      if (this.invulTimer <= 0) {
        this.invulnerable = false;
        this.invulCooldown = INVUL_COOLDOWN;
      }
    }
    if (this.fireballCooldown > 0) this.fireballCooldown--;
    if (this.speedShoesTimer > 0) this.speedShoesTimer--;
    if (this.shieldTimer > 0) this.shieldTimer--;

    // Check if in water
    this.inWater = false;
    if (level.water) {
      for (const w of level.water) {
        if (this.circleRectCollision(this.x, this.y, this.radius, w)) {
          this.inWater = true;
          break;
        }
      }
    }

    const cfg = this.config;
    const moveAccel = cfg.speed;
    this.wasOnGround = this.onGround;

    if (this.bounceTimer > 0) this.bounceTimer--;

    if (this.flying) {
      let flySpeed = 5;
      if (KEYS['ArrowLeft'] || KEYS['KeyA']) { this.vx -= moveAccel * 1.5; this.lastDirection = -1; }
      if (KEYS['ArrowRight'] || KEYS['KeyD']) { this.vx += moveAccel * 1.5; this.lastDirection = 1; }
      if (KEYS['ArrowUp'] || KEYS['KeyW']) this.vy = -flySpeed;
      else if (KEYS['ArrowDown'] || KEYS['KeyS']) this.vy = flySpeed;
      else this.vy *= 0.92;

      this.vx = Math.max(-cfg.maxSpeed * 1.5, Math.min(cfg.maxSpeed * 1.5, this.vx));
      this.vx *= 0.95;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;

      this.x += this.vx;
      this.y += this.vy;
      this.onGround = false;

      this.flightFuel -= FLIGHT_FUEL_DRAIN;
      if (this.flightFuel <= 0) {
        this.flightFuel = 0;
        this.flying = false;
      }
    } else {
      let speedMult = this.speedShoesTimer > 0 ? 1.8 : 1.0;
      let moveAccel = cfg.speed * speedMult;
      let maxSpd = cfg.maxSpeed * speedMult;

      if (this.inWater) {
        moveAccel = cfg.speed * 0.6 * speedMult;
        maxSpd = cfg.maxSpeed * 0.45 * speedMult;
      }

      if (KEYS['ArrowLeft'] || KEYS['KeyA']) { this.vx -= moveAccel; this.lastDirection = -1; }
      if (KEYS['ArrowRight'] || KEYS['KeyD']) { this.vx += moveAccel; this.lastDirection = 1; }

      if (this.inWater) {
        if (KEYS['ArrowUp'] || KEYS['KeyW'] || KEYS['Space']) {
          this.vy = -3.5;
          this.onGround = false;
        }

        let buoyancy = 0;
        if (this.form === FORM_BOUNCE) buoyancy = -0.15;
        else if (this.form === FORM_WOLLY) buoyancy = -0.45;
        else if (this.form === FORM_BUMPY) buoyancy = 0.25;

        this.vy += buoyancy;
        this.vx *= 0.90;
        this.vy *= 0.90;

        if (this.speedShoesTimer > 0 && Math.random() < 0.2) {
          level.addParticles(this.x, this.y, '#FF7043', 2);
        }
      } else {
        if ((KEYS['ArrowUp'] || KEYS['KeyW'] || KEYS['Space']) && this.onGround) {
          this.vy = cfg.jump;
          this.onGround = false;
          AUDIO.jump();
        }

        this.vy = Math.min(15, this.vy + cfg.gravity);

        if (this.onGround) {
          this.vx *= FRICTION;
          if (Math.abs(this.vx) < 0.1) this.vx = 0;
        }

        if (this.speedShoesTimer > 0 && Math.random() < 0.4) {
          level.addParticles(this.x, this.y - this.radius, '#FF7043', 1);
        }
      }

      this.vx = Math.max(-maxSpd, Math.min(maxSpd, this.vx));
      this.vy = Math.max(-15, Math.min(this.vy, 15));

      // Update radius BEFORE collision so size-change doesn't cause 1-frame penetration
      this.radius = this.config.radius * this.sizeMultiplier;

      // Step X, resolve only horizontal contacts
      this.x += this.vx;
      this.resolveCollisionX(level);

      // Step Y, resolve only vertical contacts
      this.y += this.vy;
      this.onGround = false;
      this.resolveCollisionY(level);

      // Landing bounce
      if (this.onGround && !this.wasOnGround && this.vy > 3) {
        this.vy = -this.vy * BOUNCE_FACTOR;
        AUDIO.land();
        if (Math.abs(this.vy) > 1.5) {
          this.onGround = false;
        }
      }

      if (this.onGround) {
        this.flightFuel = Math.min(FLIGHT_FUEL_MAX, this.flightFuel + FLIGHT_FUEL_RECHARGE);
      }

      if (this.y > level.height + 100) {
        this.die();
      }
    }

    if (this.flying && KEYS['ArrowUp'] && KEYS['ArrowDown']) {
      this.enableFly();
    }

    this.checkTrampolines(level);
    this.checkEnemies(level);
    this.checkSkyPortals(level);
    this.checkCollectibles(level);
    this.checkSpikes(level);
    this.checkLava(level);
    this.checkGates(level);
    this.checkExit(level);
    this.checkTransforms(level);
    this.checkSizeGates(level);

    if (KEYS['KeyI'] && !this.invulnerable && this.invulCooldown <= 0) {
      this.invulnerable = true;
      this.invulTimer = INVUL_DURATION;
      AUDIO.invulnerable();
    }

    if (KEYS['KeyE'] && this.fireballCooldown <= 0) {
      this.fireballCooldown = FIREBALL_COOLDOWN;
      AUDIO.fireball();
      level.fireballs.push({
        x: this.x + this.lastDirection * 20,
        y: this.y,
        vx: this.lastDirection * FIREBALL_SPEED,
        vy: 0,
        radius: 8,
        life: 120
      });
    }

    this.squash += (1 - this.squash) * 0.3;
    this.stretch += (1 - this.stretch) * 0.3;

    // drawRadius is purely cosmetic (squash/stretch effect) — physics uses this.radius set above
    this.drawRadius = this.config.radius * this.sizeMultiplier * this.stretch;
    if (this.onGround && !this.flying) {
      this.drawRadius = this.config.radius * this.sizeMultiplier * (1 / (1 + Math.abs(this.vx) * 0.02));
    }

    this.eyeBlink = Math.max(0, this.eyeBlink - 1);
    if (Math.random() < 0.005) this.eyeBlink = 8;
  }

  resolveCollisionX(level) {
    const r = this.radius;
    const _resolveX = (rect) => {
      // Skip slide platforms — their side collisions are handled by slope logic
      if (rect.type === 'slide') return;
      if (!this.circleRectCollision(this.x, this.y, r, rect)) return;
      const topDist = this.y - rect.y;
      const botDist = (rect.y + rect.h) - this.y;
      if (topDist < 1 || botDist < 1) return;
      if (this.vx > 0) { this.x = rect.x - r - 0.01; this.vx = 0; }
      else if (this.vx < 0) { this.x = rect.x + rect.w + r + 0.01; this.vx = 0; }
    };
    for (const p of level.platforms) _resolveX(p);
    for (const mp of level.movingPlatforms) _resolveX(mp);
    for (const w of level.airWalls) { if (w.revealed) _resolveX(w); }

    // Resolve breakable walls (Bumpy smashes them horizontally, others bounce off)
    for (const w of level.breakableWalls) {
      if (w.broken) continue;
      if (!this.circleRectCollision(this.x, this.y, r, w)) continue;
      if (this.form === FORM_BUMPY) {
        w.broken = true;
        level.addParticles(w.x + w.w / 2, w.y + w.h / 2, '#8D6E63', 12);
        AUDIO.transform();
      } else {
        const topDist = this.y - w.y;
        const botDist = (w.y + w.h) - this.y;
        if (topDist < 1 || botDist < 1) continue;
        if (this.vx > 0) { this.x = w.x - r - 0.01; this.vx = 0; }
        else if (this.vx < 0) { this.x = w.x + w.w + r + 0.01; this.vx = 0; }
      }
    }
  }

  // Returns the surface Y of a slide platform at a given world-X.
  // dir=1: slopes down-right (high-left, low-right)
  // dir=-1: slopes down-left (high-right, low-left)
  _slopeSurfaceY(p, worldX) {
    const dir = p.direction || 1;
    // Progress from 0 (left edge) to 1 (right edge)
    const t = (worldX - p.x) / p.w;
    if (dir === 1) {
      // Left top = p.y, right bottom = p.y + p.h
      return p.y + t * p.h;
    } else {
      // Right top = p.y, left bottom = p.y + p.h
      return p.y + (1 - t) * p.h;
    }
  }

  resolveCollisionY(level) {
    const r = this.radius;

    // --- Slope (slide) platforms ---
    for (const p of level.platforms) {
      if (p.type !== 'slide') continue;
      // Only check if ball is horizontally within the ramp
      if (this.x < p.x - r || this.x > p.x + p.w + r) continue;
      const surfaceY = this._slopeSurfaceY(p, this.x);
      // Ball touches the slope surface from above
      if (this.y + r >= surfaceY && this.y + r <= surfaceY + 20 && this.vy >= 0) {
        // Push ball onto surface
        this.y = surfaceY - r - 0.01;
        // Redirect velocity along slope instead of killing it
        const dir = p.direction || 1;
        const slopeAngle = Math.atan2(p.h, p.w * dir); // angle of slope in radians
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        // Project onto slope direction: accelerate downhill, let player roll naturally
        const slopeAccel = 0.3 * Math.sin(Math.atan2(p.h, p.w)); // gravity component along slope
        this.vx += dir * slopeAccel;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // --- Normal flat platforms ---
    const _resolveY = (rect, onMoving) => {
      if (rect.type === 'slide') return; // already handled above
      if (!this.circleRectCollision(this.x, this.y, r, rect)) return;
      if (this.vy >= 0) {
        this.y = rect.y - r - 0.01;
        this.vy = 0;
        this.onGround = true;
        if (onMoving) this.x += onMoving;
      } else {
        this.y = rect.y + rect.h + r + 0.01;
        this.vy = 0;
      }
    };
    for (const p of level.platforms) _resolveY(p, null);
    for (const mp of level.movingPlatforms) _resolveY(mp, mp.dx);
    for (const w of level.airWalls) { if (w.revealed) _resolveY(w, null); }
    // Resolve breakable walls (Bumpy smashes them vertically, others land or bounce)
    for (const w of level.breakableWalls) {
      if (w.broken) continue;
      if (!this.circleRectCollision(this.x, this.y, r, w)) continue;
      if (this.form === FORM_BUMPY) {
        w.broken = true;
        level.addParticles(w.x + w.w / 2, w.y + w.h / 2, '#8D6E63', 12);
        AUDIO.transform();
      } else {
        if (this.vy >= 0) {
          this.y = w.y - r - 0.01;
          this.vy = 0;
          this.onGround = true;
        } else {
          this.y = w.y + w.h + r + 0.01;
          this.vy = 0;
        }
      }
    }
  }

  circleRectCollision(cx, cy, r, rect) {
    const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - nearX;
    const dy = cy - nearY;
    return (dx * dx + dy * dy) < (r * r);
  }

  checkTrampolines(level) {
    const r = this.radius;
    for (const t of level.trampolines) {
      if (this.circleRectCollision(this.x, this.y, r, t)) {
        if (this.vy > 0) {
          this.vy = TRAMPOLINE_BOUNCE;
          this.onGround = false;
          level.addParticles(t.x + t.w / 2, t.y, '#42A5F5', 10);
          AUDIO.trampoline();
        }
      }
    }
  }

  checkEnemies(level) {
    const r = this.radius;
    for (const e of level.enemies) {
      if (e.dead) continue;
      if (this.circleRectCollision(this.x, this.y, r, e)) {
        if (this.form === FORM_BUMPY) {
          e.dead = true;
          level.addParticles(e.x + e.w / 2, e.y + e.h / 2, COLORS.enemy, 15);
          AUDIO.fireballHit();
        } else {
          if (this.invulnerable || this.flying || this.shieldTimer > 0) continue;
          this.die();
          return;
        }
      }
    }
  }

  checkSkyPortals(level) {
    for (const portal of level.skyPortals) {
      if (portal.used) continue;
      const dx = this.x - (portal.x + portal.w / 2);
      const dy = this.y - (portal.y + portal.h / 2);
      if (Math.abs(dx) < portal.w / 2 + this.radius &&
          Math.abs(dy) < portal.h / 2 + this.radius) {
        portal.used = true;
        level.secretWarp = portal.targetLevel;
        return;
      }
    }
  }

  checkCollectibles(level) {
    for (const c of level.collectibles) {
      if (c.collected) continue;
      const dx = this.x - c.x;
      const dy = this.y - c.y;
      if (dx * dx + dy * dy < (this.radius + 12) * (this.radius + 12)) {
        c.collected = true;
        if (c.type === 'egg') {
          this.eggs++;
          this.score += 100;
          level.addParticles(c.x, c.y, COLORS.egg, 8);
          AUDIO.egg();
        } else if (c.type === 'life') {
          this.lives++;
          level.addParticles(c.x, c.y, COLORS.life, 8);
          AUDIO.lifePickup();
        } else if (c.type === 'speedShoes') {
          this.speedShoesTimer = 360; // 6 seconds at 60fps
          level.addParticles(c.x, c.y, '#FF7043', 10);
          AUDIO.speedShoes();
        } else if (c.type === 'shield') {
          this.shieldTimer = 480; // 8 seconds
          level.addParticles(c.x, c.y, '#29B6F6', 10);
          AUDIO.shieldPickup();
        }
      }
    }
    for (const k of level.keys) {
      if (k.collected) continue;
      const dx = this.x - k.x;
      const dy = this.y - k.y;
      if (dx * dx + dy * dy < (this.radius + 12) * (this.radius + 12)) {
        k.collected = true;
        this.hasKey = true;
        level.addParticles(k.x, k.y, COLORS.key, 10);
        AUDIO.key();
      }
    }
  }

  checkSizeGates(level) {
    if (!level.sizeGates) return;
    const r = this.radius;
    for (const g of level.sizeGates) {
      if (this.circleRectCollision(this.x, this.y, r, g)) {
        let targetMultiplier = 1.0;
        if (g.type === 'deflator') targetMultiplier = 0.5;
        else if (g.type === 'inflator') targetMultiplier = 2.0;
        else if (g.type === 'resizer') targetMultiplier = 1.0;

        if (this.sizeMultiplier !== targetMultiplier) {
          this.sizeMultiplier = targetMultiplier;
          level.addParticles(g.x + g.w / 2, g.y + g.h / 2, COLORS.gateSize, 12);
          AUDIO.transform(); // Play transform sound
        }
      }
    }
  }

  checkSpikes(level) {
    const r = this.radius;
    for (const s of level.spikes) {
      if (s.destroyed) continue;
      if (this.circleRectCollision(this.x, this.y, r, s)) {
        if (this.form === FORM_BUMPY) {
          s.destroyed = true;
          level.addParticles(s.x + s.w / 2, s.y + s.h / 2, '#757575', 15);
          AUDIO.fireballHit();
        } else {
          if (this.invulnerable || this.flying || this.shieldTimer > 0) continue;
          this.die();
          return;
        }
      }
    }
  }

  checkLava(level) {
    if (this.invulnerable || this.flying || this.shieldTimer > 0) return;
    const r = this.radius;
    for (const l of level.lava) {
      if (this.circleRectCollision(this.x, this.y, r, l)) {
        this.die();
        return;
      }
    }
  }

  checkGates(level) {
    for (const g of level.gates) {
      if (g.open) continue;
      const r = this.radius;
      if (this.circleRectCollision(this.x, this.y, r, g)) {
        if (this.hasKey) {
          g.open = true;
          this.hasKey = false;
          level.addParticles(g.x + g.w / 2, g.y + g.h / 2, COLORS.gateOpen, 12);
          AUDIO.gateOpen();
        } else if (!this.flying) {
          if (this.vx > 0) { this.x = g.x - r; }
          else if (this.vx < 0) { this.x = g.x + g.w + r; }
          else if (this.vy > 0) { this.y = g.y - r; this.vy = 0; }
          else if (this.vy < 0) { this.y = g.y + g.h + r; this.vy = 0; }
          this.vx = 0;
        }
      }
    }
  }

  checkExit(level) {
    // Exit portal checking is deferred to engine.js checkExit to check locked status!
  }

  checkTransforms(level) {
    for (const t of level.transforms) {
      if (t.collected) continue;
      const dx = this.x - t.x;
      const dy = this.y - t.y;
      if (dx * dx + dy * dy < (this.radius + 14) * (this.radius + 14)) {
        t.collected = true;
        this.applyForm(t.type);
        level.addParticles(t.x, t.y, FORM_CONFIG[t.type].color, 15);
        AUDIO.transform();
      }
    }
  }

  checkLasers(level) {
    if (this.invulnerable || this.flying || this.shieldTimer > 0) return;
    const r = this.radius;
    for (const l of level.lasers) {
      if (!l.active) continue;
      if (this.circleRectCollision(this.x, this.y, r, l)) {
        this.die();
        return;
      }
    }
  }

  die() {
    if (this.dead) return;
    AUDIO.die();
    this.lives--;
    this.dead = true;
    this.deathTimer = 45;
    this.vy = -8;
    this.vx = 0;
    if (this.lives < 0) this.lives = -1;
  }

  draw(ctx) {
    if (this.dead && this.deathTimer % 6 < 3) return;
    // Use visual drawRadius for rendering (squash/stretch), fall back to physics radius
    const sr = this.drawRadius || this.radius;
    if (sr <= 0) return;

    ctx.save();

    if (this.flying) {
      ctx.shadowColor = COLORS.fly;
      ctx.shadowBlur = 20 + Math.sin(Date.now() * 0.01) * 8;
    }
    if (this.invulnerable) {
      ctx.shadowColor = COLORS.invul;
      ctx.shadowBlur = 15 + Math.sin(Date.now() * 0.02) * 10;
    }

    const color = this.drawColor;
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.flying) {
      ctx.shadowBlur = 0;
      const wingFlap = Math.sin(Date.now() * 0.015) * 0.3 + 0.7;
      for (let side = -1; side <= 1; side += 2) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(side * sr * 0.6, -sr * 0.5);
        ctx.quadraticCurveTo(side * sr * (1.8 * wingFlap), -sr * 0.2, side * sr * 0.8, sr * 0.1);
        ctx.quadraticCurveTo(side * sr * (1.2 * wingFlap), -sr * 0.15, side * sr * 0.6, -sr * 0.5);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;

    if (this.invulnerable) {
      const sparkle = Math.sin(Date.now() * 0.01 + this.x) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,255,255,${sparkle * 0.4})`;
      ctx.beginPath();
      ctx.arc(-sr * 0.7, -sr * 0.7, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sr * 0.6, -sr * 0.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const eyeY = -sr * 0.25;
    const eyeSpacing = sr * 0.35;
    const eyeR = sr * 0.18;

    if (this.eyeBlink > 0) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-eyeSpacing - eyeR, eyeY - 1, eyeR * 2, 2);
      ctx.fillRect(eyeSpacing - eyeR, eyeY - 1, eyeR * 2, 2);
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      const lookX = this.vx * 0.05;
      ctx.beginPath();
      ctx.arc(-eyeSpacing + lookX, eyeY, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeSpacing + lookX, eyeY, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    const mouthY = sr * 0.4;
    if (this.vy < -2) {
      ctx.beginPath();
      ctx.arc(0, mouthY, sr * 0.2, Math.PI, 0);
    } else if (this.vy > 2) {
      ctx.beginPath();
      ctx.arc(0, mouthY + sr * 0.1, sr * 0.2, 0, Math.PI);
    } else {
      ctx.beginPath();
      ctx.arc(0, mouthY, sr * 0.15, 0, Math.PI);
    }
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (this.shieldTimer > 0) {
      ctx.strokeStyle = 'rgba(41, 182, 246, 0.82)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#29B6F6';
      ctx.shadowBlur = 12 + Math.sin(Date.now() * 0.02) * 4;
      ctx.beginPath();
      ctx.arc(0, 0, sr + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
