class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!SHADOWS_ENABLED) {
      Object.defineProperty(this.ctx, 'shadowBlur', {
        get: () => 0,
        set: () => {},
        configurable: true
      });
    }
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    this.state = STATE_MENU;
    this.currentLevelIndex = 0;
    this.secretLevelStack = [];
    this.level = null;
    this.player = null;
    this.camera = { x: 0, y: 0 };
    this.totalScore = 0;
    this.totalEggs = 0;
    this.frameCount = 0;
    this.transitionTimer = 0;
    this.menuBlink = 0;
    this.cheatInput = [];
    this.cheatMessage = '';
    this.cheatMessageTimer = 0;
    this.flyUnlockedMessage = false;
    this.tutorialHints = new Set();
    this.tutorialEggHintShown = false;
    this.titleHue = 0;
    this.menuBallAngle = 0;
    this.menuOrbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      r: 28 + Math.random() * 38,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.3,
      hue: [0, 200, 280, 45, 160][i]
    }));
    this.stars = Array.from({ length: 110 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      r: Math.random() * 1.6 + 0.2,
      speed: Math.random() * 0.18 + 0.04,
      phase: Math.random() * Math.PI * 2
    }));
    this.winFireworks = [];

    this.setupInput();
    this.setupTouch();
    this.setupResize();
    this.resizeCanvas();
    this.loadLevel(0);
    this.state = STATE_MENU;
    this.setupUIOverlay();
  }

  setupResize() {
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const ratio = CANVAS_W / CANVAS_H;
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (w / h > ratio) {
      w = h * ratio;
    } else {
      h = w / ratio;
    }
    this.canvas.style.width = Math.floor(w) + 'px';
    this.canvas.style.height = Math.floor(h) + 'px';
  }

  startNewGame() {
    this.currentLevelIndex = 0;
    this.totalScore = 0;
    this.totalEggs = 0;
    this.secretLevelStack = [];
    this.winFireworks = [];
    this.loadLevel(0);
  }

  loadLevel(index) {
    if (index >= LEVEL_DATA.length) {
      this.state = STATE_WIN;
      AUDIO.win();
      this.saveHighScore(this.totalScore + (this.player ? this.player.score : 0));
      document.getElementById('statWinName').textContent = (localStorage.getItem('bt_nickname') || 'BounceBaller').toUpperCase();
      document.getElementById('statWinScore').textContent = this.totalScore + (this.player ? this.player.score : 0);
      document.getElementById('statWinEggs').textContent = this.totalEggs + (this.player ? this.player.eggs : 0);
      this.showScreen(document.getElementById('screenGameWin'));
      return;
    }
    const data = LEVEL_DATA[index];
    this.level = new Level(data, index);
    this.player = new Player(data.playerStart.x, data.playerStart.y);
    this.camera.x = 0;
    this.camera.y = 0;
    this.state = STATE_PLAYING;
    this.transitionTimer = 30;
  }

  loadSecretLevel(secretId) {
    const parts = secretId.split('-');
    const idx = parseInt(parts[1]) - 1;
    if (idx < 0 || idx >= SECRET_LEVEL_DATA.length) return;
    const data = SECRET_LEVEL_DATA[idx];
    this.secretLevelStack.push(this.currentLevelIndex);
    this.level = new Level(data, -1);
    this.level.isSecret = true;
    this.level.returnLevel = data.returnLevel;

    const keys = Object.keys(LEVEL_DATA).length;
    this.player = new Player(data.playerStart.x, data.playerStart.y);
    this.camera.x = 0;
    this.camera.y = 0;
    this.state = STATE_PLAYING;
    this.transitionTimer = 30;
  }

  advanceState() {
    AUDIO.resume();
    if (this.state === STATE_MENU) {
      AUDIO.menuStart();
      if (this.hideOverlay) this.hideOverlay();
      this.startNewGame();
    } else if (this.state === STATE_GAME_OVER) {
      if (this.hideOverlay) this.hideOverlay();
      this.loadLevel(this.currentLevelIndex);
    } else if (this.state === STATE_LEVEL_COMPLETE) {
      if (this.hideOverlay) this.hideOverlay();
      if (this.level && this.level.isSecret) {
        const returnTo = this.level.returnLevel || 0;
        this.currentLevelIndex = returnTo;
        this.loadLevel(returnTo);
      } else {
        this.currentLevelIndex++;
        this.loadLevel(this.currentLevelIndex);
      }
    } else if (this.state === STATE_WIN) {
      this.state = STATE_MENU;
      if (this.showScreen) this.showScreen(document.getElementById('screenMainMenu'));
    }
  }

  checkExit() {
    if (!this.level || !this.level.exit || !this.player) return;
    const e = this.level.exit;
    
    const r = this.player.radius;
    const nearX = Math.max(e.x, Math.min(this.player.x, e.x + e.w));
    const nearY = Math.max(e.y, Math.min(this.player.y, e.y + e.h));
    const dx = this.player.x - nearX;
    const dy = this.player.y - nearY;
    const isColliding = (dx * dx + dy * dy) < (r * r);

    if (isColliding) {
      const remainingEggs = this.level.collectibles.filter(c => c.type === 'egg' && !c.collected).length;
      if (remainingEggs === 0) {
        this.level.complete = true;
      } else {
        if (this.frameCount % 45 === 0 || this.cheatMessageTimer <= 0) {
          AUDIO.toggle(); // buzz sound
          this.cheatMessage = `PORTAL LOCKED: COLLECT ALL EGGS (${remainingEggs} REMAINING!)`;
          this.cheatMessageTimer = 90;
        }
        const bounceDir = this.player.x < e.x + e.w / 2 ? -1 : 1;
        this.player.vx = bounceDir * 4;
        this.player.vy = -3;
      }
    }
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      AUDIO.resume();
      KEYS[e.code] = true;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
      }

      if (e.code === 'Escape' && this.state === STATE_PLAYING) {
        this.state = STATE_PAUSED;
        this.showScreen(document.getElementById('screenPause'));
      } else if (e.code === 'Escape' && this.state === STATE_PAUSED) {
        this.state = STATE_PLAYING;
        this.hideOverlay();
      }

      if (e.code === 'Space' && (this.state === STATE_MENU || this.state === STATE_LEVEL_COMPLETE || this.state === STATE_GAME_OVER || this.state === STATE_WIN)) {
        this.advanceState();
      }

      if (e.code === 'KeyF' && this.state === STATE_PLAYING) {
        this.player.enableFly();
        this.cheatMessage = this.player.flying ? 'FLY MODE ON' : 'FLY MODE OFF';
        this.cheatMessageTimer = 90;
      }

      if (e.code === 'KeyM') {
        const muted = AUDIO.toggle();
        this.cheatMessage = muted ? 'SOUND: OFF' : 'SOUND: ON';
        this.cheatMessageTimer = 90;
      }

      this.cheatInput.push(e.code);
      if (this.cheatInput.length > MAX_CHEAT_BUFFER) {
        this.cheatInput.shift();
      }

      if (this.cheatInput.length >= KONAMI_CODE.length) {
        const startIdx = this.cheatInput.length - KONAMI_CODE.length;
        let match = true;
        for (let i = 0; i < KONAMI_CODE.length; i++) {
          if (this.cheatInput[startIdx + i] !== KONAMI_CODE[i]) {
            match = false;
            break;
          }
        }
        if (match && this.state === STATE_PLAYING) {
          this.cheatInput = [];
          this.player.enableFly();
          if (this.player.flying) {
            this.cheatMessage = 'KONAMI CODE: FLY MODE ON!';
            this.cheatMessageTimer = 150;
            FLY_CHEAT_UNLOCKED = true;
            localStorage.setItem('bt_fly_unlocked', 'true');
            this.flyUnlockedMessage = true;
          }
        }
      }

      if (this.cheatInput.length >= MILKYWAY_CODE.length) {
        const startIdx = this.cheatInput.length - MILKYWAY_CODE.length;
        let match = true;
        for (let i = 0; i < MILKYWAY_CODE.length; i++) {
          if (this.cheatInput[startIdx + i] !== MILKYWAY_CODE[i]) {
            match = false;
            break;
          }
        }
        if (match && this.state === STATE_PLAYING) {
          this.cheatInput = [];
          if (!this.player.flying) {
            this.player.enableFly();
          }
          FLY_CHEAT_UNLOCKED = true;
          localStorage.setItem('bt_fly_unlocked', 'true');
          this.flyUnlockedMessage = true;

          if (this.level.skyPortals && this.level.skyPortals.length > 0) {
            const portal = this.level.skyPortals[0];
            this.player.x = portal.x;
            this.player.y = portal.y + 120;
            this.cheatMessage = 'MILKY WAY: WARPING TO SKY PORTAL!';
          } else {
            this.player.y = -50;
            this.cheatMessage = 'MILKY WAY: FLYING TO THE STARS!';
          }
          this.cheatMessageTimer = 180;
          AUDIO.invulnerable();
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      KEYS[e.code] = false;
    });
  }

  setupTouch() {
    const btnLeft = document.getElementById('btnDpadLeft');
    const btnRight = document.getElementById('btnDpadRight');
    const btnUp = document.getElementById('btnDpadUp');
    const btnDown = document.getElementById('btnDpadDown');
    const btnJump = document.getElementById('btnJump');
    const btnFire = document.getElementById('btnFire');
    const btnShield = document.getElementById('btnShield');
    const btnFly = document.getElementById('btnFly');

    const onTouch = (btn, code, isDown) => {
      if (!btn) return;
      btn.addEventListener(isDown ? 'touchstart' : 'touchend', (e) => {
        e.preventDefault();
        KEYS[code] = isDown;
        if (isDown) btn.classList.add('active');
        else btn.classList.remove('active');
      });
      btn.addEventListener(isDown ? 'mousedown' : 'mouseup', (e) => {
        e.preventDefault();
        KEYS[code] = isDown;
        if (isDown) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    };

    const onTouchPress = (btn, code) => {
      if (!btn) return;
      const press = (e) => {
        e.preventDefault();
        KEYS[code] = true;
        btn.classList.add('active');
      };
      const release = (e) => {
        e.preventDefault();
        KEYS[code] = false;
        btn.classList.remove('active');
      };
      btn.addEventListener('touchstart', press);
      btn.addEventListener('touchend', release);
      btn.addEventListener('touchcancel', release);
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    };

    onTouch(btnLeft, 'ArrowLeft', true);
    onTouch(btnLeft, 'ArrowLeft', false);
    onTouch(btnRight, 'ArrowRight', true);
    onTouch(btnRight, 'ArrowRight', false);
    onTouch(btnUp, 'ArrowUp', true);
    onTouch(btnUp, 'ArrowUp', false);
    onTouch(btnDown, 'ArrowDown', true);
    onTouch(btnDown, 'ArrowDown', false);
    onTouch(btnJump, 'Space', true);
    onTouch(btnJump, 'Space', false);
    onTouchPress(btnFire, 'KeyE');
    onTouchPress(btnShield, 'KeyI');
    onTouchPress(btnFly, 'KeyF');

    // === MOBILE CHEAT GESTURES ===

    // Triple-tap Jump button = Konami Code (unlock permanent fly)
    let jumpTapCount = 0;
    let jumpTapTimer = null;
    if (btnJump) {
      btnJump.addEventListener('touchstart', () => {
        jumpTapCount++;
        clearTimeout(jumpTapTimer);
        jumpTapTimer = setTimeout(() => { jumpTapCount = 0; }, 800);
        if (jumpTapCount >= 3 && this.state === STATE_PLAYING) {
          jumpTapCount = 0;
          this.player.enableFly();
          FLY_CHEAT_UNLOCKED = true;
          localStorage.setItem('bt_fly_unlocked', 'true');
          this.flyUnlockedMessage = true;
          if (this.player.flying) {
            this.cheatMessage = 'KONAMI CODE: FLY MODE ON!';
          } else {
            this.cheatMessage = 'KONAMI CODE: FLY MODE OFF';
          }
          this.cheatMessageTimer = 150;
          AUDIO.invulnerable();
        }
      });
    }

    // Long-press Fly button (2s) = Milky Way warp to sky portal
    let flyHoldTimer = null;
    if (btnFly) {
      const startHold = () => {
        clearTimeout(flyHoldTimer);
        flyHoldTimer = setTimeout(() => {
          if (this.state !== STATE_PLAYING) return;
          if (!this.player.flying) {
            this.player.enableFly();
          }
          FLY_CHEAT_UNLOCKED = true;
          localStorage.setItem('bt_fly_unlocked', 'true');
          this.flyUnlockedMessage = true;

          if (this.level.skyPortals && this.level.skyPortals.length > 0) {
            const portal = this.level.skyPortals[0];
            this.player.x = portal.x;
            this.player.y = portal.y + 120;
            this.cheatMessage = 'MILKY WAY: WARPING TO SKY PORTAL!';
          } else {
            this.player.y = -50;
            this.cheatMessage = 'MILKY WAY: FLYING TO THE STARS!';
          }
          this.cheatMessageTimer = 180;
          AUDIO.invulnerable();
        }, 2000);
      };
      const cancelHold = () => { clearTimeout(flyHoldTimer); };
      btnFly.addEventListener('touchstart', startHold);
      btnFly.addEventListener('touchend', cancelHold);
      btnFly.addEventListener('touchcancel', cancelHold);
    }

    document.addEventListener('touchstart', (e) => {
      AUDIO.resume();
      if (this.state === STATE_MENU || this.state === STATE_LEVEL_COMPLETE || this.state === STATE_GAME_OVER || this.state === STATE_WIN) {
        if (!e.target.closest('.touch-btn')) {
          e.preventDefault();
          this.advanceState();
        }
      }
    }, { passive: false });
  }

  showTutorial(id, msg, duration) {
    if (this.tutorialHints.has(id)) return;
    this.tutorialHints.add(id);
    this.cheatMessage = msg;
    this.cheatMessageTimer = duration || 150;
  }

  updateTutorial() {
    const p = this.player;
    const l = this.level;
    if (!p || !l) return;

    // Controls hint 1.5s after level starts
    if (this.frameCount < 120 && !this.tutorialHints.has('controls')) {
      this.showTutorial('controls', 'Arrow Keys to move  |  Space to jump  |  E / I / F for skills', 200);
    }

    // Locked gate hint
    if (!this.tutorialHints.has('keygate') && l.gates && l.gates.length > 0) {
      for (const g of l.gates) {
        if (!g.open && Math.abs(p.x - (g.x + g.w / 2)) < 120 && Math.abs(p.y - (g.y + g.h / 2)) < 80) {
          this.showTutorial('keygate', 'Find the key to open locked gates!', 160);
          break;
        }
      }
    }

    // Exit hint
    const totalEggs = l.collectibles.filter(c => c.type === 'egg').length;
    if (!this.tutorialHints.has('exit') && l.exit && p.eggs < totalEggs) {
      const ex = l.exit.x + l.exit.w / 2;
      const ey = l.exit.y + l.exit.h / 2;
      if (Math.abs(p.x - ex) < 100 && Math.abs(p.y - ey) < 80) {
        this.showTutorial('exit', 'Collect all eggs to open the exit!', 160);
      }
    }

    // Trampoline hint
    if (!this.tutorialHints.has('trampoline') && l.trampolines) {
      for (const t of l.trampolines) {
        if (p.x > t.x - 10 && p.x < t.x + t.w + 10 && Math.abs(p.y - (t.y + t.h)) < 25) {
          this.showTutorial('trampoline', 'Trampolines give a big bounce!', 120);
          break;
        }
      }
    }

    // Size gate hint
    if (!this.tutorialHints.has('sizegate') && l.sizeGates && l.sizeGates.length > 0) {
      for (const sg of l.sizeGates) {
        if (p.x > sg.x - 10 && p.x < sg.x + sg.w + 10 && p.y > sg.y - 10 && p.y < sg.y + sg.h + 10) {
          const tip = sg.type === 'deflator' ? 'Shrink to fit through tight spaces!' : sg.type === 'inflator' ? 'Grow to reach high places!' : 'Return to normal size!';
          this.showTutorial('sizegate', tip, 140);
          break;
        }
      }
    }

    // Skill usage hints
    if (!this.tutorialHints.has('fireball') && KEYS['KeyE']) {
      this.showTutorial('fireball', 'Fireball! Hold E to rapid-fire', 100);
    }
    if (!this.tutorialHints.has('shield') && KEYS['KeyI']) {
      this.showTutorial('shield', 'Invulnerability toggled — press I again after cooldown', 120);
    }
    if (!this.tutorialHints.has('fly') && p.flying) {
      this.showTutorial('fly', 'Flight mode! Arrow keys to steer, release F to land', 140);
    }

    // Water hint
    if (!this.tutorialHints.has('water') && p.inWater) {
      this.showTutorial('water', 'Swim through water with jump + directional keys!', 140);
    }
  }

  update() {
    this.frameCount++;
    this.menuBlink += 0.04;
    this.titleHue = (this.titleHue + 0.5) % 360;
    this.menuBallAngle += 0.025;
    if (this.cheatMessageTimer > 0) this.cheatMessageTimer--;

    // Scroll stars
    for (const s of this.stars) {
      s.x -= s.speed;
      if (s.x < 0) s.x = CANVAS_W;
      s.phase += 0.04;
    }
    // Drift menu orbs
    for (const o of this.menuOrbs) {
      o.x += o.vx;
      o.y += o.vy;
      if (o.x < -o.r) o.x = CANVAS_W + o.r;
      if (o.x > CANVAS_W + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = CANVAS_H + o.r;
      if (o.y > CANVAS_H + o.r) o.y = -o.r;
    }
    // Win screen fireworks
    if (this.state === STATE_WIN) {
      if (Math.random() < 0.12) {
        const fwX = 50 + Math.random() * (CANVAS_W - 100);
        const fwY = 30 + Math.random() * (CANVAS_H * 0.55);
        this.winFireworks.push({
          particles: Array.from({ length: 22 }, () => ({
            x: fwX, y: fwY,
            vx: (Math.random() - 0.5) * 9,
            vy: (Math.random() - 0.5) * 9 - 1,
            life: 40 + Math.random() * 30,
            maxLife: 70,
            hue: Math.floor(Math.random() * 360)
          }))
        });
      }
      for (const fw of this.winFireworks) {
        for (const p of fw.particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.18;
          p.life--;
        }
        fw.particles = fw.particles.filter(p => p.life > 0);
      }
      this.winFireworks = this.winFireworks.filter(fw => fw.particles.length > 0);
    }

    if (this.state === STATE_PLAYING) {
      if (this.transitionTimer > 0) {
        this.transitionTimer--;
      }

      this.player.update(this.level);
      this.level.update(this.camera, this.player);
      this.player.checkLasers(this.level);
      this.checkExit();
      this.updateTutorial();

      if (this.level.secretWarp) {
        this.loadSecretLevel(this.level.secretWarp);
      }

      if (this.player.lives < 0) {
        this.state = STATE_GAME_OVER;
        AUDIO.gameOver();
        this.saveHighScore(this.player.score);
        document.getElementById('statOverName').textContent = (localStorage.getItem('bt_nickname') || 'BounceBaller').toUpperCase();
        document.getElementById('statOverScore').textContent = this.player.score;
        this.showScreen(document.getElementById('screenGameOver'));
      }

      if (this.level.complete) {
        this.totalScore += this.player.score;
        this.totalEggs += this.player.eggs;

        // Save progress to completed levels
        const completedLevels = JSON.parse(localStorage.getItem('bt_completed_levels') || '{}');
        completedLevels[this.currentLevelIndex] = true;
        localStorage.setItem('bt_completed_levels', JSON.stringify(completedLevels));

        // Unlock next level
        const maxUnlocked = Math.max(this.maxUnlocked || 0, this.currentLevelIndex + 1);
        localStorage.setItem('bt_max_unlocked', maxUnlocked.toString());
        this.maxUnlocked = maxUnlocked;

        this.state = STATE_LEVEL_COMPLETE;
        AUDIO.levelComplete();
        this.transitionTimer = 90;
        this.level.addParticles(
          this.level.exit.x + this.level.exit.w / 2,
          this.level.exit.y + this.level.exit.h / 2,
          '#00E676', 30
        );

        // Display level complete overlay statistics
        document.getElementById('statCompName').textContent = (localStorage.getItem('bt_nickname') || 'BounceBaller').toUpperCase();
        document.getElementById('statCompScore').textContent = this.player.score;
        document.getElementById('statCompEggs').textContent = `${this.player.eggs} / ${this.level.collectibles.filter(c => c.type === 'egg').length}`;
        this.showScreen(document.getElementById('screenLevelComplete'));
      }

      this.updateCamera();
    }
  }

  updateCamera() {
    const targetX = this.player.x - CANVAS_W / 2;
    const targetY = this.player.y - CANVAS_H / 2;
    this.camera.x += (targetX - this.camera.x) * 0.08;
    this.camera.y += (targetY - this.camera.y) * 0.06;
    this.camera.x = Math.max(0, Math.min(this.level.width - CANVAS_W, this.camera.x));
    if (!this.player.flying) {
      this.camera.y = Math.max(0, Math.min(this.level.height - CANVAS_H, this.camera.y));
    } else {
      this.camera.y = Math.min(this.level.height - CANVAS_H, this.camera.y);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    this.drawBackground(ctx);

    // Draw background elements first
    this.level.drawWindColumns(ctx, this.camera);

    this.level.drawPlatforms(ctx, this.camera);
    this.level.drawTrampolines(ctx, this.camera);
    this.level.drawBreakableWalls(ctx, this.camera);
    this.level.drawMovingPlatforms(ctx, this.camera);
    this.level.drawWater(ctx, this.camera);
    
    // Draw interactive switches and pads
    this.level.drawWeightSwitches(ctx, this.camera);
    this.level.drawDashPads(ctx, this.camera);

    this.level.drawSpikes(ctx, this.camera);
    this.level.drawLava(ctx, this.camera);
    this.level.drawEnemies(ctx, this.camera);
    
    // Draw boss
    this.level.drawBoss(ctx, this.camera);

    this.level.drawLasers(ctx, this.camera);
    this.level.drawGates(ctx, this.camera);
    this.level.drawKeys(ctx, this.camera);
    this.level.drawCollectibles(ctx, this.camera);
    this.level.drawTransforms(ctx, this.camera);
    this.level.drawSizeGates(ctx, this.camera);
    this.level.drawAirWalls(ctx, this.camera);
    this.level.drawSkyPortals(ctx, this.camera);
    this.level.drawExit(ctx, this.camera);
    this.level.drawFireballs(ctx, this.camera);
    this.level.drawParticles(ctx, this.camera);

    if (this.player && this.state === STATE_PLAYING) {
      ctx.save();
      ctx.translate(this.player.x - this.camera.x, this.player.y - this.camera.y);
      this.player.draw(ctx);
      ctx.restore();
    }

    this.drawHUD(ctx);

    if (this.state === STATE_MENU) {
      this.drawMenu(ctx);
    } else if (this.state === STATE_LEVEL_COMPLETE) {
      // Handled by HTML overlay, draw a dim overlay on canvas
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    } else if (this.state === STATE_GAME_OVER) {
      // Handled by HTML overlay, draw a dim overlay on canvas
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    } else if (this.state === STATE_WIN) {
      this.drawWin(ctx);
    } else if (this.state === STATE_PAUSED) {
      // Dim the game while paused
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (this.state === STATE_PLAYING && this.transitionTimer > 0) {
      const alpha = this.transitionTimer / 30;
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px Orbitron, Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = `hsl(${this.titleHue},100%,60%)`;
      ctx.shadowBlur = 22 * alpha;
      ctx.fillText(this.level.name, CANVAS_W / 2, CANVAS_H / 2 - 14);
      ctx.shadowBlur = 0;
      ctx.font = '11px Orbitron, Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(this.level.isSecret ? 'SECRET LEVEL' : `Level ${this.currentLevelIndex + 1}`, CANVAS_W / 2, CANVAS_H / 2 + 22);
      ctx.restore();
    }

    if (this.cheatMessageTimer > 0 && this.state === STATE_PLAYING) {
      const alpha2 = Math.min(1, this.cheatMessageTimer / 30);
      ctx.globalAlpha = alpha2;
      ctx.fillStyle = COLORS.fly;
      ctx.font = 'bold 14px Orbitron, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = COLORS.fly;
      ctx.shadowBlur = 16;
      ctx.fillText(this.cheatMessage, CANVAS_W / 2, CANVAS_H / 2 + 82);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  drawBackground(ctx) {
    if (this.level) {
      this.level.drawBackground(ctx, this.camera);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#1a1a2e');
      grad.addColorStop(1, '#16213e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  drawHUD(ctx) {
    if (this.state !== STATE_PLAYING && this.state !== STATE_LEVEL_COMPLETE) return;

    ctx.save();

    // Frosted glass bar
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, CANVAS_W, 44);

    // Animated neon bottom line
    const barGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    barGrad.addColorStop(0, `hsla(${this.titleHue},100%,55%,0)`);
    barGrad.addColorStop(0.5, `hsla(${this.titleHue},100%,55%,0.9)`);
    barGrad.addColorStop(1, `hsla(${this.titleHue},100%,55%,0)`);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 43, CANVAS_W, 1);

    ctx.textBaseline = 'middle';

    // Lives: glowing red ball icon + count
    ctx.fillStyle = '#E53935';
    ctx.shadowColor = '#E53935';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(13, 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(10, 17, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 17, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 12px Orbitron, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`x${Math.max(0, this.player.lives)}`, 26, 20);

    // Egg icon + count
    ctx.fillStyle = COLORS.egg;
    ctx.shadowColor = COLORS.egg;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.ellipse(66, 19, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFF9C4';
    ctx.font = '11px Orbitron, Arial';
    const totalEggs = this.level.collectibles.filter(c => c.type === 'egg').length;
    ctx.fillText(`x${this.player.eggs} / ${totalEggs}`, 76, 20);

    // Level name (centre)
    ctx.textAlign = 'center';
    const modeLabel = this.level.isSecret ? `\u2605 ${this.level.name} \u2605` : this.level.name;
    ctx.fillStyle = this.level.isSecret ? COLORS.fly : 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 12px Orbitron, Arial';
    if (this.level.isSecret) { ctx.shadowColor = COLORS.fly; ctx.shadowBlur = 14; }
    ctx.fillText(modeLabel, CANVAS_W / 2, 20);
    ctx.shadowBlur = 0;

    // Score (right)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD600';
    ctx.font = 'bold 13px Orbitron, Arial';
    ctx.shadowColor = '#FFD600';
    ctx.shadowBlur = 9;
    ctx.fillText(`${this.player.score}`, CANVAS_W - 15, 20);
    ctx.shadowBlur = 0;

    // Form badge
    const fCfg = FORM_CONFIG[this.player.form];
    ctx.font = '9px Orbitron, Arial';
    ctx.fillStyle = fCfg.color;
    ctx.fillText(fCfg.label.toUpperCase(), CANVAS_W - 95, 20);

    // Key icon
    if (this.player.hasKey) {
      const kx = CANVAS_W - 200;
      ctx.fillStyle = COLORS.key;
      ctx.shadowColor = COLORS.key;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(kx, 17, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(kx - 2, 17, 3, 9);
      ctx.fillRect(kx - 2, 23, 6, 2);
      ctx.shadowBlur = 0;
    }

    // FLY indicator
    if (this.player.flying) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 9px Orbitron, Arial';
      ctx.fillStyle = COLORS.fly;
      ctx.shadowColor = COLORS.fly;
      ctx.shadowBlur = 12;
      ctx.fillText('FLY', 130, 20);
      ctx.shadowBlur = 0;
    }

    // Skill cooldowns (second row)
    ctx.textAlign = 'left';
    ctx.font = '9px Orbitron, Arial';
    const invulReady = this.player.invulCooldown <= 0 && !this.player.invulnerable;
    ctx.fillStyle = this.player.invulnerable ? COLORS.invul
      : invulReady ? 'rgba(255,214,0,0.72)' : 'rgba(110,110,110,0.4)';
    const iLabel = this.player.invulnerable ? '[I] ON'
      : invulReady ? '[I] RDY' : `[I] ${Math.ceil(this.player.invulCooldown / 60)}s`;
    ctx.fillText(iLabel, 148, 32);

    ctx.fillStyle = this.player.fireballCooldown <= 0 ? 'rgba(255,109,0,0.88)' : 'rgba(110,110,110,0.4)';
    const eLabel = this.player.fireballCooldown <= 0 ? '[E] RDY' : `[E] ${Math.ceil(this.player.fireballCooldown / 60)}s`;
    ctx.fillText(eLabel, 214, 32);

    // Fuel bar
    const fuelW = 55, fuelH = 5;
    const fuelX = CANVAS_W - 75, fuelY = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.roundRect(ctx, fuelX, fuelY, fuelW, fuelH, 3);
    ctx.fill();
    const fuelPct = this.player.flightFuel / FLIGHT_FUEL_MAX;
    const fuelColor = fuelPct > 0.5 ? COLORS.fuelBar : fuelPct > 0.2 ? '#FFC107' : '#FF5722';
    if (fuelPct > 0) {
      ctx.fillStyle = fuelColor;
      ctx.shadowColor = fuelColor;
      ctx.shadowBlur = fuelPct > 0.2 ? 5 : 14;
      this.roundRect(ctx, fuelX, fuelY, Math.max(3, fuelW * fuelPct), fuelH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
     ctx.font = '7px Orbitron, Arial';
     ctx.fillStyle = this.player.flying ? COLORS.fuelBar : 'rgba(255,255,255,0.3)';
     ctx.textAlign = 'center';
     ctx.fillText('FUEL', fuelX + fuelW / 2, fuelY + fuelH + 8);
 
     // Boss Health Bar
     if (this.level && this.level.boss && this.level.boss.active) {
      const b = this.level.boss;
      const hbW = 280;
      const hbH = 8;
      const hbX = (CANVAS_W - hbW) / 2;
      const hbY = 56;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      this.roundRect(ctx, hbX - 10, hbY - 16, hbW + 20, hbH + 22, 5);
      ctx.fill();

      ctx.fillStyle = '#FF8A80';
      ctx.font = 'bold 8px Orbitron, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('HYPNOTOID CORE', CANVAS_W / 2, hbY - 6);

      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this.roundRect(ctx, hbX, hbY, hbW, hbH, 4);
      ctx.fill();

      const hpPct = b.health / b.maxHealth;
      if (hpPct > 0) {
        ctx.fillStyle = COLORS.boss;
        ctx.shadowColor = COLORS.boss;
        ctx.shadowBlur = 10;
        this.roundRect(ctx, hbX, hbY, hbW * hpPct, hbH, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    this.drawExitCompass(ctx);
    this.drawMinimap(ctx);

    ctx.restore();
  }

  drawExitCompass(ctx) {
    if (!this.level || !this.level.exit || !this.player) return;

    const dx = this.level.exit.x + this.level.exit.w / 2 - this.player.x;
    const dy = this.level.exit.y + this.level.exit.h / 2 - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 300) {
      const angle = Math.atan2(dy, dx);
      const px = this.player.x - this.camera.x;
      const py = this.player.y - this.camera.y;

      const arrowDist = 36;
      const ax = px + Math.cos(angle) * arrowDist;
      const ay = py + Math.sin(angle) * arrowDist;

      const pulse = 0.8 + 0.2 * Math.sin(this.frameCount * 0.15);

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);

      const remainingEggs = this.level.collectibles.filter(c => c.type === 'egg' && !c.collected).length;
      const locked = remainingEggs > 0;
      const col = locked ? '#FF3D00' : '#00E676';
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10 * pulse;

      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  drawMinimap(ctx) {
    if (!this.level || !this.player) return;

    const w = 150;
    const h = 70;
    const pad = 10;
    const mx = CANVAS_W - w - pad;
    const my = CANVAS_H - h - pad;

    ctx.save();

    // 1. Frosted glass container with neon border
    ctx.fillStyle = 'rgba(8, 2, 16, 0.76)';
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0, 229, 255, 0.2)';
    ctx.shadowBlur = 8;
    this.roundRect(ctx, mx, my, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Create a clip path for the inside content
    ctx.save();
    this.roundRect(ctx, mx + 1, my + 1, w - 2, h - 2, 5);
    ctx.clip();

    // Scale factors
    const scaleX = w / this.level.width;
    const scaleY = h / this.level.height;

    // Helper to map world to map coords
    const toMapX = (wx) => mx + wx * scaleX;
    const toMapY = (wy) => my + wy * scaleY;

    // 2. Draw Platforms (thin wireframe lines)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    for (const p of this.level.platforms) {
      ctx.fillRect(toMapX(p.x), toMapY(p.y), Math.max(1, p.w * scaleX), Math.max(1, p.h * scaleY));
    }

    // 3. Draw Moving Platforms
    ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
    if (this.level.movingPlatforms) {
      for (const p of this.level.movingPlatforms) {
        ctx.fillRect(toMapX(p.x), toMapY(p.y), Math.max(1, p.w * scaleX), Math.max(1, p.h * scaleY));
      }
    }

    // 4. Draw Lava & Spikes
    ctx.fillStyle = 'rgba(255, 82, 82, 0.5)';
    if (this.level.lava) {
      for (const l of this.level.lava) {
        ctx.fillRect(toMapX(l.x), toMapY(l.y), Math.max(1, l.w * scaleX), Math.max(1, l.h * scaleY));
      }
    }
    if (this.level.spikes) {
      for (const s of this.level.spikes) {
        if (s.destroyed) continue;
        ctx.fillRect(toMapX(s.x), toMapY(s.y), Math.max(1, s.w * scaleX), Math.max(1, s.h * scaleY));
      }
    }

    // 5. Draw Keys
    ctx.fillStyle = COLORS.key || '#FFD600';
    if (this.level.keys) {
      for (const k of this.level.keys) {
        if (!k.collected) {
          ctx.beginPath();
          ctx.arc(toMapX(k.x), toMapY(k.y), 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 6. Draw Gates
    ctx.fillStyle = '#E0E0E0';
    if (this.level.gates) {
      for (const g of this.level.gates) {
        if (g.h > 0) {
          ctx.fillRect(toMapX(g.x), toMapY(g.y), Math.max(1, g.w * scaleX), Math.max(1, g.h * scaleY));
        }
      }
    }

    // 7. Draw Exit Portal (pulsing color-coded dot)
    if (this.level.exit) {
      const remainingEggs = this.level.collectibles.filter(c => c.type === 'egg' && !c.collected).length;
      const locked = remainingEggs > 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.12);
      ctx.fillStyle = locked ? '#FF3D00' : '#00E676';
      ctx.shadowColor = locked ? '#FF3D00' : '#00E676';
      ctx.shadowBlur = 6 * pulse;
      ctx.beginPath();
      ctx.arc(toMapX(this.level.exit.x + this.level.exit.w / 2), toMapY(this.level.exit.y + this.level.exit.h / 2), 3 + 1 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 7.5 Draw uncollected Eggs/Coins (yellow/gold dots)
    if (this.level.collectibles) {
      ctx.fillStyle = '#FFD600';
      for (const c of this.level.collectibles) {
        if (c.type === 'egg' && !c.collected) {
          ctx.beginPath();
          ctx.arc(toMapX(c.x), toMapY(c.y), 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 8. Draw Player (pulsing red dot)
    const playerPulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.2);
    ctx.fillStyle = '#FF1744';
    ctx.shadowColor = '#FF1744';
    ctx.shadowBlur = 7 * playerPulse;
    ctx.beginPath();
    ctx.arc(toMapX(this.player.x), toMapY(this.player.y), 3 + 1 * playerPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
    ctx.restore();
  }

  drawMenu(ctx) {
    // Starfield background
    ctx.fillStyle = '#020210';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const s of this.stars) {
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating glowing orbs
    for (const o of this.menuOrbs) {
      const og = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      og.addColorStop(0, `hsla(${o.hue},100%,60%,0.22)`);
      og.addColorStop(1, `hsla(${o.hue},100%,60%,0)`);
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dark depth overlay
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // === ANIMATED TITLE ===
    const h1 = this.titleHue;
    const h2 = (this.titleHue + 100) % 360;
    const h3 = (this.titleHue + 200) % 360;
    const tg = ctx.createLinearGradient(CANVAS_W / 2 - 230, 0, CANVAS_W / 2 + 230, 0);
    tg.addColorStop(0, `hsl(${h1},100%,72%)`);
    tg.addColorStop(0.5, `hsl(${h2},100%,80%)`);
    tg.addColorStop(1, `hsl(${h3},100%,72%)`);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 50px Orbitron, Arial';
    ctx.shadowColor = `hsl(${h1},100%,55%)`;
    ctx.shadowBlur = 38;
    ctx.fillStyle = tg;
    ctx.fillText('BOUNCE TALES', CANVAS_W / 2, 62);
    ctx.shadowBlur = 0;
    ctx.font = '10px Orbitron, Arial';
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillText('A NOKIA CLASSIC REBORN', CANVAS_W / 2, 90);
    ctx.restore();

    // === ANIMATED MASCOT ===
    const bx = CANVAS_W / 2, by = 168;
    const bob = Math.sin(this.menuBallAngle * 2.2) * 7;
    const br = 26;
    ctx.save();
    ctx.translate(bx, by + bob);

    const outerG = ctx.createRadialGradient(0, 0, br - 2, 0, 0, br + 22);
    outerG.addColorStop(0, `hsla(${h1},100%,60%,0.4)`);
    outerG.addColorStop(1, 'transparent');
    ctx.fillStyle = outerG;
    ctx.beginPath();
    ctx.arc(0, 0, br + 22, 0, Math.PI * 2);
    ctx.fill();

    const ballG = ctx.createRadialGradient(-7, -9, 2, 0, 0, br);
    ballG.addColorStop(0, '#FF8A80');
    ballG.addColorStop(0.45, '#E53935');
    ballG.addColorStop(1, '#7B0000');
    ctx.fillStyle = ballG;
    ctx.shadowColor = '#E53935';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-7, -9, 7, 4.5, -0.5, 0, Math.PI * 2);
    ctx.fill();

    const wf = Math.sin(this.menuBallAngle * 3.5) * 0.45 + 0.75;
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = `hsla(${h2},100%,70%,0.38)`;
      ctx.beginPath();
      ctx.moveTo(side * br * 0.55, -br * 0.3);
      ctx.quadraticCurveTo(side * br * 2.1 * wf, -br * 0.1, side * br * 0.85, br * 0.18);
      ctx.quadraticCurveTo(side * br * 1.4 * wf, -br * 0.2, side * br * 0.55, -br * 0.3);
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-9, -5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-8, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 5, 9, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.restore();

    // === CONTROLS PANEL ===
    const pw = 450, ph = 88;
    const px = (CANVAS_W - pw) / 2, py = 216;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '10px Orbitron, Arial';
    ctx.fillStyle = 'rgba(220,230,255,0.78)';
    ctx.fillText('\u2190\u2192 Move  \u00B7  \u2191 / Space Jump  \u00B7  E Fire  \u00B7  I Shield  \u00B7  F Fly', CANVAS_W / 2, py + 20);
    ctx.fillStyle = 'rgba(180,200,255,0.5)';
    ctx.fillText('Collect Eggs  \u00B7  Grab Keys  \u00B7  Open Gates  \u00B7  Reach the Exit', CANVAS_W / 2, py + 40);
    ctx.fillStyle = `hsla(${h3},75%,72%,0.55)`;
    ctx.fillText('Bumpy \u2014 breaks walls  \u00B7  Wolly \u2014 floats higher', CANVAS_W / 2, py + 60);
    ctx.fillStyle = 'rgba(150,200,255,0.28)';
    ctx.font = '8px Orbitron, Arial';
    ctx.fillText('Konami: \u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192 BA  \u00B7  Mobile: 3x Jump = Fly  \u00B7  Hold F = Warp', CANVAS_W / 2, py + 78);
    ctx.restore();

    // === BLINKING PROMPT ===
    if (Math.sin(this.menuBlink * 4) > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px Orbitron, Arial';
      ctx.fillStyle = `hsl(${h1},100%,78%)`;
      ctx.shadowColor = `hsl(${h1},100%,60%)`;
      ctx.shadowBlur = 24;
      ctx.fillText('\u2014  TAP OR PRESS SPACE TO PLAY  \u2014', CANVAS_W / 2, 335);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Secret hint
    ctx.fillStyle = 'rgba(0,229,255,0.25)';
    ctx.font = '8px Orbitron, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SECRET: Fly high to find hidden portals!', CANVAS_W / 2, 428);
  }

  drawLevelComplete(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const pw = 410, ph = 238;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2 - 14;

    // Panel glow halo
    ctx.save();
    ctx.shadowColor = '#00E676';
    ctx.shadowBlur = 38;
    ctx.strokeStyle = 'rgba(0,230,118,0.55)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, px, py, pw, ph, 16);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Panel fill
    ctx.fillStyle = 'rgba(0,18,10,0.75)';
    this.roundRect(ctx, px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,230,118,0.22)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, px, py, pw, ph, 16);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    const title = this.level && this.level.isSecret ? 'SECRET CLEAR!' : 'LEVEL  CLEAR!';
    ctx.font = 'bold 28px Orbitron, Arial';
    ctx.fillStyle = '#00E676';
    ctx.shadowColor = '#00E676';
    ctx.shadowBlur = 28;
    ctx.fillText(title, CANVAS_W / 2, py + 38);
    ctx.shadowBlur = 0;

    // Divider
    const dg = ctx.createLinearGradient(px + 40, 0, px + pw - 40, 0);
    dg.addColorStop(0, 'transparent');
    dg.addColorStop(0.5, 'rgba(0,230,118,0.5)');
    dg.addColorStop(1, 'transparent');
    ctx.fillStyle = dg;
    ctx.fillRect(px + 40, py + 62, pw - 80, 1);

    // Stats
    ctx.font = '12px Orbitron, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`Score  ${this.player.score}  \u00B7  Eggs  ${this.player.eggs}  \u00B7  Lives  ${this.player.lives + 1}`, CANVAS_W / 2, py + 88);

    // Total
    ctx.font = 'bold 16px Orbitron, Arial';
    ctx.fillStyle = '#FFD600';
    ctx.shadowColor = '#FFD600';
    ctx.shadowBlur = 12;
    ctx.fillText(`TOTAL  ${this.totalScore}`, CANVAS_W / 2, py + 122);
    ctx.shadowBlur = 0;

    // Star rating
    const thresholds = [0, 300, 700];
    for (let i = 0; i < 3; i++) {
      const lit = this.player.score >= thresholds[i];
      const sx = CANVAS_W / 2 + (i - 1) * 46;
      const pulse = lit ? 1 + 0.08 * Math.sin(this.menuBlink * 4 + i) : 1;
      ctx.font = `${24 * pulse}px Arial`;
      ctx.fillStyle = lit ? '#FFD600' : 'rgba(255,255,255,0.14)';
      ctx.shadowColor = lit ? '#FFD600' : 'transparent';
      ctx.shadowBlur = lit ? 16 : 0;
      ctx.fillText('\u2605', sx, py + 162);
      ctx.shadowBlur = 0;
    }

    // Prompt
    if (Math.sin(this.menuBlink * 4) > 0) {
      ctx.font = '11px Orbitron, Arial';
      ctx.fillStyle = 'rgba(0,230,118,0.72)';
      ctx.shadowColor = '#00E676';
      ctx.shadowBlur = 9;
      const nextText = this.level && this.level.isSecret
        ? '\u2014 PRESS SPACE TO RETURN \u2014'
        : '\u2014 PRESS SPACE FOR NEXT \u2014';
      ctx.fillText(nextText, CANVAS_W / 2, py + 208);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawGameOver(ctx) {
    // Deep dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Red radial vignette
    const vig = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 80, CANVAS_W / 2, CANVAS_H / 2, 430);
    vig.addColorStop(0, 'rgba(140,0,0,0)');
    vig.addColorStop(1, 'rgba(140,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Flicker effect
    if (Math.random() > 0.92) ctx.globalAlpha = 0.55;

    ctx.font = 'bold 50px Orbitron, Arial';
    ctx.fillStyle = '#E53935';
    ctx.shadowColor = '#FF1744';
    ctx.shadowBlur = 48;
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 52);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Divider
    const dg = ctx.createLinearGradient(CANVAS_W / 2 - 160, 0, CANVAS_W / 2 + 160, 0);
    dg.addColorStop(0, 'transparent');
    dg.addColorStop(0.5, 'rgba(229,57,53,0.55)');
    dg.addColorStop(1, 'transparent');
    ctx.fillStyle = dg;
    ctx.fillRect(CANVAS_W / 2 - 160, CANVAS_H / 2 - 14, 320, 1);

    // Stats
    ctx.font = '12px Orbitron, Arial';
    ctx.fillStyle = 'rgba(255,190,190,0.82)';
    ctx.fillText(`Final Score  ${this.totalScore + this.player.score}`, CANVAS_W / 2, CANVAS_H / 2 + 18);
    ctx.fillText(`Eggs Collected  ${this.totalEggs + this.player.eggs}`, CANVAS_W / 2, CANVAS_H / 2 + 42);

    // Prompt
    if (Math.sin(this.menuBlink * 4) > 0) {
      ctx.font = '11px Orbitron, Arial';
      ctx.fillStyle = 'rgba(255,80,80,0.74)';
      ctx.shadowColor = '#E53935';
      ctx.shadowBlur = 12;
      ctx.fillText('\u2014 PRESS SPACE TO TRY AGAIN \u2014', CANVAS_W / 2, CANVAS_H / 2 + 86);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawWin(ctx) {
    // Starfield
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const s of this.stars) {
      const alpha = 0.25 + 0.75 * Math.abs(Math.sin(s.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Fireworks
    for (const fw of this.winFireworks) {
      for (const p of fw.particles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = `hsl(${p.hue},100%,65%)`;
        ctx.shadowColor = `hsl(${p.hue},100%,65%)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Gradient title
    const h1 = this.titleHue;
    const tg = ctx.createLinearGradient(CANVAS_W / 2 - 180, 0, CANVAS_W / 2 + 180, 0);
    tg.addColorStop(0, `hsl(${h1},100%,72%)`);
    tg.addColorStop(0.5, '#FFD600');
    tg.addColorStop(1, `hsl(${(h1 + 70) % 360},100%,72%)`);

    ctx.font = 'bold 56px Orbitron, Arial';
    ctx.fillStyle = tg;
    ctx.shadowColor = '#FFD600';
    ctx.shadowBlur = 48;
    ctx.fillText('YOU WIN!', CANVAS_W / 2, CANVAS_H / 2 - 82);
    ctx.shadowBlur = 0;

    // Animated gold stars
    for (let i = 0; i < 5; i++) {
      const pulse = 0.5 + 0.5 * Math.sin(this.menuBlink * 3 + i * 0.7);
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.font = `${24 + 5 * pulse}px Arial`;
      ctx.fillStyle = '#FFD600';
      ctx.shadowColor = '#FFD600';
      ctx.shadowBlur = 16 * pulse;
      ctx.fillText('\u2605', CANVAS_W / 2 + (i - 2) * 42, CANVAS_H / 2 - 30);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.font = '13px Orbitron, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('You conquered all 12 levels!', CANVAS_W / 2, CANVAS_H / 2 + 18);

    if (FLY_CHEAT_UNLOCKED) {
      ctx.font = '11px Orbitron, Arial';
      ctx.fillStyle = COLORS.fly;
      ctx.shadowColor = COLORS.fly;
      ctx.shadowBlur = 13;
      ctx.fillText('\u2605 Secret Levels Discovered! \u2605', CANVAS_W / 2, CANVAS_H / 2 + 46);
      ctx.shadowBlur = 0;
    }

    ctx.font = 'bold 20px Orbitron, Arial';
    ctx.fillStyle = '#FFD600';
    ctx.shadowColor = '#FFD600';
    ctx.shadowBlur = 14;
    ctx.fillText(`TOTAL  ${this.totalScore + this.player.score}`, CANVAS_W / 2, CANVAS_H / 2 + 82);
    ctx.shadowBlur = 0;

    if (Math.sin(this.menuBlink * 3) > 0) {
      ctx.font = '11px Orbitron, Arial';
      ctx.fillStyle = 'rgba(255,220,50,0.74)';
      ctx.shadowColor = '#FFD600';
      ctx.shadowBlur = 9;
      ctx.fillText('\u2014 PRESS SPACE TO PLAY AGAIN \u2014', CANVAS_W / 2, CANVAS_H / 2 + 118);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  setupUIOverlay() {
    const uiOverlay = document.getElementById('uiOverlay');
    const screenNickname = document.getElementById('screenNickname');
    const screenMainMenu = document.getElementById('screenMainMenu');
    const screenLevelSelect = document.getElementById('screenLevelSelect');
    const screenPause = document.getElementById('screenPause');
    const screenSettings = document.getElementById('screenSettings');
    const screenLeaderboard = document.getElementById('screenLeaderboard');
    const screenLevelComplete = document.getElementById('screenLevelComplete');
    const screenGameOver = document.getElementById('screenGameOver');
    const screenGameWin = document.getElementById('screenGameWin');

    const nicknameInput = document.getElementById('nicknameInput');
    const welcomeUser = document.getElementById('welcomeUser');

    let nickname = localStorage.getItem('bt_nickname') || '';
    let maxUnlocked = parseInt(localStorage.getItem('bt_max_unlocked') || '0');

    const showScreen = (screen) => {
      [screenNickname, screenMainMenu, screenLevelSelect, screenPause, screenSettings, screenLeaderboard, screenLevelComplete, screenGameOver, screenGameWin].forEach(s => {
        if (s) s.classList.remove('active');
      });
      if (screen) screen.classList.add('active');
      uiOverlay.classList.add('active');
    };

    const hideOverlay = () => {
      uiOverlay.classList.remove('active');
      if (document.activeElement) {
        document.activeElement.blur();
      }
    };

    if (nickname) {
      nicknameInput.value = nickname;
      welcomeUser.textContent = `WELCOME BACK, ${nickname.toUpperCase()}!`;
      showScreen(screenMainMenu);
    } else {
      showScreen(screenNickname);
    }

    document.getElementById('btnSaveNickname').addEventListener('click', () => {
      const name = nicknameInput.value.trim();
      if (name.length > 0) {
        nickname = name;
        localStorage.setItem('bt_nickname', nickname);
        welcomeUser.textContent = `WELCOME, ${nickname.toUpperCase()}!`;
        AUDIO.resume();
        showScreen(screenMainMenu);
      } else {
        nicknameInput.style.borderColor = '#FF5252';
        setTimeout(() => nicknameInput.style.borderColor = '', 1000);
      }
    });

    document.getElementById('btnPlayGame').addEventListener('click', () => {
      AUDIO.resume();
      this.startNewGame();
      this.currentLevelIndex = maxUnlocked;
      this.loadLevel(maxUnlocked);
      hideOverlay();
    });

    document.getElementById('btnLevelSelect').addEventListener('click', () => {
      AUDIO.resume();
      this.renderLevelSelectGrid(maxUnlocked, showScreen, hideOverlay);
      showScreen(screenLevelSelect);
    });

    document.getElementById('btnBackToMenu').addEventListener('click', () => {
      showScreen(screenMainMenu);
    });

    document.getElementById('btnResume').addEventListener('click', () => {
      this.state = STATE_PLAYING;
      hideOverlay();
    });

    document.getElementById('btnPauseSettings').addEventListener('click', () => {
      AUDIO.resume();
      document.getElementById('btnBackToMenuFromSettings').textContent = 'BACK';
      document.getElementById('btnQuitToMainMenu').style.display = 'none';
      showScreen(screenSettings);
    });

    document.getElementById('btnPauseQuit').addEventListener('click', () => {
      this.state = STATE_MENU;
      hideOverlay();
    });

    document.getElementById('btnSettings').addEventListener('click', () => {
      AUDIO.resume();
      document.getElementById('btnQuitToMainMenu').style.display = 'none';
      document.getElementById('btnBackToMenuFromSettings').textContent = 'BACK';
      showScreen(screenSettings);
    });

    document.getElementById('btnBackToMenuFromSettings').addEventListener('click', () => {
      if (this.state === STATE_PAUSED) {
        showScreen(screenPause);
      } else {
        showScreen(screenMainMenu);
      }
    });

    document.getElementById('btnQuitToMainMenu').addEventListener('click', () => {
      this.state = STATE_MENU;
      hideOverlay();
    });

    document.getElementById('btnLeaderboard').addEventListener('click', () => {
      AUDIO.resume();
      this.renderLeaderboard();
      showScreen(screenLeaderboard);
    });

    document.getElementById('btnBackToMenuFromLeaderboard').addEventListener('click', () => {
      showScreen(screenMainMenu);
    });

    const sliderMusic = document.getElementById('sliderMusic');
    const labelMusic = document.getElementById('labelMusic');
    sliderMusic.addEventListener('input', (e) => {
      const val = e.target.value;
      labelMusic.textContent = val + '%';
      AUDIO.setMusicVolume(val);
    });

    const sliderSfx = document.getElementById('sliderSfx');
    const labelSfx = document.getElementById('labelSfx');
    sliderSfx.addEventListener('input', (e) => {
      const val = e.target.value;
      labelSfx.textContent = val + '%';
      AUDIO.setSfxVolume(val);
    });

    const checkMute = document.getElementById('checkMute');
    checkMute.addEventListener('change', (e) => {
      const isMuted = e.target.checked;
      AUDIO.muted = isMuted;
      AUDIO.updateVolumes();
    });

    document.getElementById('btnNextLevel').addEventListener('click', () => {
      hideOverlay();
      this.advanceState();
    });

    document.getElementById('btnMenuFromComplete').addEventListener('click', () => {
      this.state = STATE_MENU;
      showScreen(screenMainMenu);
    });

    document.getElementById('btnRetryLevel').addEventListener('click', () => {
      hideOverlay();
      this.loadLevel(this.currentLevelIndex);
    });

    document.getElementById('btnMenuFromOver').addEventListener('click', () => {
      this.state = STATE_MENU;
      showScreen(screenMainMenu);
    });

    document.getElementById('btnMenuFromWin').addEventListener('click', () => {
      this.state = STATE_MENU;
      showScreen(screenMainMenu);
    });

    this.showScreen = showScreen;
    this.hideOverlay = hideOverlay;
    this.maxUnlocked = maxUnlocked;
  }

  renderLevelSelectGrid(maxUnlocked, showScreen, hideOverlay) {
    const grid = document.getElementById('levelGrid');
    grid.innerHTML = '';
    const completedLevels = JSON.parse(localStorage.getItem('bt_completed_levels') || '{}');

    LEVEL_DATA.forEach((l, i) => {
      const item = document.createElement('div');
      item.className = 'level-item';
      item.textContent = i + 1;

      const isLocked = i > maxUnlocked;
      if (isLocked) {
        item.classList.add('locked');
      } else {
        if (completedLevels[i]) {
          item.classList.add('completed');
        }
        item.addEventListener('click', () => {
          this.startNewGame();
          this.currentLevelIndex = i;
          this.loadLevel(i);
          hideOverlay();
        });
      }
      grid.appendChild(item);
    });
  }

  renderLeaderboard() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    const scores = JSON.parse(localStorage.getItem('bt_scores') || '[]');

    if (scores.length === 0) {
      list.innerHTML = '<div class="leaderboard-row" style="justify-content:center;">NO HIGH SCORES YET</div>';
      return;
    }

    scores.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${idx + 1}`;
      row.innerHTML = `<span>#${idx + 1} ${s.name.toUpperCase()}</span><span>${s.score} PTS</span>`;
      list.appendChild(row);
    });
  }

  saveHighScore(score) {
    const nickname = localStorage.getItem('bt_nickname') || 'BounceBaller';
    let scores = JSON.parse(localStorage.getItem('bt_scores') || '[]');
    scores.push({ name: nickname, score: score });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5);
    localStorage.setItem('bt_scores', JSON.stringify(scores));
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}
