(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");

  // DPI-scharf zeichnen
  function fitDPI() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const STORAGE_KEY = "flappy.best.v1";
  const bestScore = Number(localStorage.getItem(STORAGE_KEY) || "0");
  bestEl.textContent = String(bestScore);

  // Game config
  const CFG = {
    gravity: 0.62,
    flap: -10.5,
    pipeSpeed: 3.2,
    pipeGap: 160,
    pipeWidth: 70,
    pipeEvery: 1100, // ms
    floorHeight: 90,
  };

  // Game state
  let state = "menu"; // "menu" | "playing" | "dead"
  let score = 0;
  let best = bestScore;

  const bird = {
    x: 120,
    y: 300,
    r: 18,
    vy: 0,
    rot: 0,
  };

  /** @type {{x:number, top:number, passed:boolean}[]} */
  let pipes = [];

  let lastT = 0;
  let spawnTimer = 0;

  // Helpers
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function reset() {
    fitDPI();
    const H = canvas.height;
    bird.y = H * 0.42;
    bird.vy = 0;
    bird.rot = 0;
    pipes = [];
    score = 0;
    spawnTimer = 0;
    scoreEl.textContent = "0";
  }

  function start() {
    state = "playing";
    overlay.style.display = "none";
    reset();
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function die() {
    state = "dead";
    overlay.style.display = "grid";
    overlay.querySelector("h1").textContent = "Game Over";
    overlay.querySelector("p").innerHTML = `Score: <b>${score}</b> · Best: <b>${best}</b>`;
    startBtn.textContent = "Nochmal";
  }

  function flap() {
    if (state === "menu") start();
    if (state !== "playing") return;
    bird.vy = CFG.flap;
  }

  function restart() {
    if (state === "playing") return;
    state = "menu";
    overlay.style.display = "grid";
    overlay.querySelector("h1").textContent = "Flappy Clone";
    overlay.querySelector("p").innerHTML = `Drücke <b>Space</b> oder tippe, um zu starten.`;
    startBtn.textContent = "Start";
    reset();
  }

  // Input
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); flap(); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); restart(); }
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });

  startBtn.addEventListener("click", () => {
    if (state === "playing") return;
    start();
  });

  window.addEventListener("resize", () => {
    fitDPI();
  });

  // Collision
  function circleRectColl(cx, cy, cr, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return (dx * dx + dy * dy) <= cr * cr;
  }

  // Rendering
  function drawBackground() {
    const W = canvas.width, H = canvas.height;
    // simple vertical gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1020");
    g.addColorStop(1, "#0b0d12");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // stars
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let i = 0; i < 35; i++) {
      const x = (i * 97) % W;
      const y = (i * 173) % (H - CFG.floorHeight);
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawFloor() {
    const W = canvas.width, H = canvas.height;
    const y = H - CFG.floorHeight;
    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, y, W, CFG.floorHeight);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let x = 0; x < W; x += 24) {
      ctx.fillRect(x, y + 10, 12, 3);
    }
  }

  function drawPipes() {
    const H = canvas.height;
    const floorY = H - CFG.floorHeight;

    for (const p of pipes) {
      const x = p.x;
      const w = CFG.pipeWidth;
      const topH = p.top;
      const gap = CFG.pipeGap;
      const botY = topH + gap;

      // Pipe style
      ctx.fillStyle = "#1b6b3a";
      ctx.fillRect(x, 0, w, topH);
      ctx.fillRect(x, botY, w, floorY - botY);

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(x + 8, 0, 8, topH);
      ctx.fillRect(x + 8, botY, 8, floorY - botY);

      // lips
      ctx.fillStyle = "#155a30";
      ctx.fillRect(x - 4, topH - 18, w + 8, 18);
      ctx.fillRect(x - 4, botY, w + 8, 18);
    }
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);

    // body
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();

    // wing
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(-4, 4, 10, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // eye
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(6, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(8, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.moveTo(bird.r - 2, 0);
    ctx.lineTo(bird.r + 14, 4);
    ctx.lineTo(bird.r - 2, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawPipes();
    drawFloor();
    drawBird();

    // subtle vignette
    const W = canvas.width, H = canvas.height;
    const v = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, Math.max(W,H));
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // Game update
  function spawnPipe() {
    const H = canvas.height;
    const floorY = H - CFG.floorHeight;
    const minTop = 70;
    const maxTop = floorY - CFG.pipeGap - 70;
    const top = rand(minTop, maxTop);
    pipes.push({ x: canvas.width + 30, top, passed: false });
  }

  function update(dtMs) {
    const dt = dtMs / 16.6667; // normalize ~60fps
    const H = canvas.height;
    const floorY = H - CFG.floorHeight;

    // bird physics
    bird.vy += CFG.gravity * dt;
    bird.y += bird.vy * dt;

    bird.rot = clamp(bird.vy / 12, -0.6, 1.2);

    // spawn pipes
    spawnTimer += dtMs;
    if (spawnTimer >= CFG.pipeEvery) {
      spawnTimer = 0;
      spawnPipe();
    }

    // move pipes
    const speed = CFG.pipeSpeed * dt;
    for (const p of pipes) p.x -= speed;

    // remove offscreen
    pipes = pipes.filter(p => p.x > -CFG.pipeWidth - 80);

    // collision / scoring
    for (const p of pipes) {
      const x = p.x;
      const w = CFG.pipeWidth;
      const gapTop = p.top;
      const gapBot = p.top + CFG.pipeGap;

      // score when passing center line
      if (!p.passed && x + w < bird.x - bird.r) {
        p.passed = true;
        score++;
        scoreEl.textContent = String(score);
        if (score > best) {
          best = score;
          bestEl.textContent = String(best);
          localStorage.setItem(STORAGE_KEY, String(best));
        }
      }

      // top rect: (x,0,w,gapTop)
      if (circleRectColl(bird.x, bird.y, bird.r, x, 0, w, gapTop)) return die();
      // bottom rect: (x,gapBot,w,floorY-gapBot)
      if (circleRectColl(bird.x, bird.y, bird.r, x, gapBot, w, floorY - gapBot)) return die();
    }

    // ground/ceiling
    if (bird.y - bird.r < 0) {
      bird.y = bird.r;
      bird.vy = 0;
    }
    if (bird.y + bird.r > floorY) {
      bird.y = floorY - bird.r;
      return die();
    }
  }

  function loop(t) {
    if (state !== "playing") return;
    const dt = Math.min(40, t - lastT);
    lastT = t;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Initialize
  fitDPI();
  reset();
  draw();

  // Ensure overlay in menu state
  overlay.style.display = "grid";
})();