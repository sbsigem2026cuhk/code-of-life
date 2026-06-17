const { Bodies, Body, Composite, Engine, Events, Render, Runner, World } = Matter;

const ASSET_BASE = "../design/";
const DESIGN_VERSION = "20260612";

function designUrl(file) {
  return `${ASSET_BASE}${file}?v=${DESIGN_VERSION}`;
}

const S = 130 / 270;

const WIDTH = 390;
const HEIGHT = 844;
const CENTER = { x: WIDTH / 2, y: 310 };
const PLANET_RADIUS = 130;
const RING_THICKNESS = Math.round(26 * S);
const RADIAL_GRAVITY = 0.00016;
const ANGULAR_SPEED = 0.032;
const NEXT_BUBBLE_SIZE = Math.round(66 * S);
const NEXT_FRUIT_RATIO = 0.7;
const PROTRUSION_DANGER = Math.round(20 * S);
const WARNING_DURATION = 10;
const PIPETTE_ORBIT = PLANET_RADIUS + Math.round(65 * S);
const PIPETTE_PIVOT_X = Math.round(35 * (80 / 120));
const PIPETTE_PIVOT_Y = Math.round(45 * (80 / 120));
const DISH_BOTTOM = CENTER.y + PLANET_RADIUS + RING_THICKNESS;

const MAX_RANKINGS = 10;
const rankingsRef = firebaseDB.ref("rankings");

const FRUITS = [
  { name: "Nucleotide",      visRadius: Math.round(28 * S),  drawRadius: Math.round(42 * S),  texture: designUrl("nucleotide.png"),           color: "#ff8f8f" },
  { name: "DNA",              visRadius: Math.round(35 * S),  drawRadius: Math.round(53 * S),  texture: designUrl("dna.png"),                  color: "#8fc0ff" },
  { name: "Nucleosome",       visRadius: Math.round(41 * S),  drawRadius: Math.round(62 * S),  texture: designUrl("nucleosome.png"),           color: "#c3a3ff" },
  { name: "Chromatin",        visRadius: Math.round(47 * S),  drawRadius: Math.round(72 * S),  texture: designUrl("chromatin.png"),            color: "#ffd48f" },
  { name: "Chromosome",       visRadius: Math.round(55 * S),  drawRadius: Math.round(83 * S),  texture: designUrl("chromosome.png"),          color: "#a9e49b" },
  { name: "mRNA",             visRadius: Math.round(64 * S),  drawRadius: Math.round(96 * S),  texture: designUrl("mrna.png"),                color: "#9fe2ff" },
  { name: "Protein",          visRadius: Math.round(74 * S),  drawRadius: Math.round(111 * S), texture: designUrl("protein.png"),             color: "#f3a6ff" },
  { name: "Functional Cell",  visRadius: Math.round(86 * S),  drawRadius: Math.round(129 * S), texture: designUrl("functional%20cell.png"),   color: "#9effcf" },
  { name: "Organism",         visRadius: Math.round(99 * S),  drawRadius: Math.round(149 * S), texture: designUrl("organism.png"),            color: "#ffd4f0" },
];

const SCORE_PER_MERGE_LEVEL = [0, 2, 4, 8, 14, 24, 40, 65, 100];
const imageSizeCache = {};

const engine = Engine.create();
engine.gravity.x = 0;
engine.gravity.y = 0;

const render = Render.create({
  element: document.getElementById("game-root"),
  engine,
  options: {
    width: WIDTH,
    height: HEIGHT,
    wireframes: false,
    background: "transparent",
  },
});

Render.run(render);

const runner = Runner.create();
let gameStarted = false;
let runnerStarted = false;

const startOverlay = document.getElementById("start-overlay");
const startBtn = document.getElementById("start-btn");
const rankingList = document.getElementById("ranking-list");
const scoreValue = document.getElementById("score-value");
const timerValue = document.getElementById("timer-value");
const pipetteWrapper = document.getElementById("pipette-wrapper");
const nextFruitEl = document.getElementById("next-fruit");
const warningOverlay = document.getElementById("warning-overlay");
const warningTimer = document.getElementById("warning-timer");
const gameOverOverlay = document.getElementById("gameover-overlay");
const finalScoreEl = document.getElementById("final-score");
const winOverlay = document.getElementById("win-overlay");
const winTimeEl = document.getElementById("win-time");
const winScoreEl = document.getElementById("win-score");
const usernameInput = document.getElementById("username-input");
const nextFruitEvolutionImg = document.getElementById("next-fruit-evolution-img");
const nextFruitEvolutionName = document.getElementById("next-fruit-evolution-name");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnDrop = document.getElementById("btn-drop");

let playerName = "";
let score = 0;
let angle = -Math.PI / 2;
let rotateDir = 0;
let canDrop = true;
let currentFruitIndex = randomStartFruitIndex();
let nextFruitIndex = randomStartFruitIndex();
while (nextFruitIndex === currentFruitIndex) {
  nextFruitIndex = randomStartFruitIndex();
}
let gameEnded = false;
let warningActive = false;
let warningCountdown = 0;
let warningIntervalId = null;
let elapsedSeconds = 0;
let timerIntervalId = null;

const planetVisual = Bodies.circle(CENTER.x, CENTER.y, PLANET_RADIUS, {
  isStatic: true,
  isSensor: true,
  render: { fillStyle: "transparent", strokeStyle: "transparent", lineWidth: 0 },
});

World.add(engine.world, [planetVisual, ...buildBoundaryRing()]);
preloadFruitImages();

Events.on(render, "afterRender", () => {
  drawDeformedPlanet();
});

updatePipetteUI();
updateNextFruitUI();
layoutPhoneUI();
renderRankings();

function layoutPhoneUI() {
  document.documentElement.style.setProperty(
    "--controls-top",
    `${DISH_BOTTOM + 16}px`,
  );
  document.documentElement.style.setProperty(
    "--pipette-pivot-x",
    `${PIPETTE_PIVOT_X}px`,
  );
  document.documentElement.style.setProperty(
    "--pipette-pivot-y",
    `${PIPETTE_PIVOT_Y}px`,
  );
}

startBtn.addEventListener("click", () => {
  if (gameStarted) return;
  playerName = usernameInput.value.trim() || "Anonymous";
  startOverlay.classList.remove("active");
  gameStarted = true;
  if (!runnerStarted) {
    Runner.run(runner, engine);
    runnerStarted = true;
  }
  startTimer();
});

setupTouchControls();

Events.on(engine, "beforeUpdate", () => {
  if (gameEnded) return;
  applyPlanetGravity();
  stepPipette();
  checkProtrusion();
});

Events.on(engine, "collisionStart", (event) => {
  if (gameEnded) return;
  const mergedPairs = new Set();

  event.pairs.forEach((pair) => {
    const a = pair.bodyA;
    const b = pair.bodyB;

    if (!isFruit(a) || !isFruit(b)) return;
    if (a.fruitIndex !== b.fruitIndex) return;
    if (a.fruitIndex >= FRUITS.length - 1) return;

    const pairKey = [a.id, b.id].sort((m, n) => m - n).join("-");
    if (mergedPairs.has(pairKey)) return;
    mergedPairs.add(pairKey);

    const nextIndex = a.fruitIndex + 1;
    const mid = {
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2,
    };

    Composite.remove(engine.world, a);
    Composite.remove(engine.world, b);
    World.add(engine.world, createFruitBody(mid.x, mid.y, nextIndex));

    updateScore(score + SCORE_PER_MERGE_LEVEL[nextIndex]);

    if (nextIndex === FRUITS.length - 1) {
      triggerWin();
    }
  });
});

function setupTouchControls() {
  function bindRotateButton(btn, direction) {
    const start = (e) => {
      e.preventDefault();
      if (!gameStarted || gameEnded) return;
      rotateDir = direction;
      btn.classList.add("pressed");
    };
    const stop = (e) => {
      e.preventDefault();
      if (rotateDir === direction) rotateDir = 0;
      btn.classList.remove("pressed");
    };

    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
  }

  bindRotateButton(btnLeft, -1);
  bindRotateButton(btnRight, 1);

  btnDrop.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!gameStarted || gameEnded || !canDrop) return;
    btnDrop.classList.add("pressed");
    dropFruit();
  });

  btnDrop.addEventListener("pointerup", (e) => {
    e.preventDefault();
    btnDrop.classList.remove("pressed");
  });

  btnDrop.addEventListener("pointerleave", (e) => {
    e.preventDefault();
    btnDrop.classList.remove("pressed");
  });

  const gameRoot = document.getElementById("game-root");
  let dragActive = false;
  let lastDragX = 0;

  gameRoot.addEventListener("pointerdown", (e) => {
    if (!gameStarted || gameEnded) return;
    if (e.target.closest("#touch-controls")) return;
    dragActive = true;
    lastDragX = e.clientX;
  });

  window.addEventListener("pointermove", (e) => {
    if (!dragActive || !gameStarted || gameEnded) return;
    const dx = e.clientX - lastDragX;
    lastDragX = e.clientX;
    angle += dx * 0.008;
    updatePipetteUI();
  });

  window.addEventListener("pointerup", () => {
    dragActive = false;
  });

  window.addEventListener("pointercancel", () => {
    dragActive = false;
  });
}

function getDeformedRadii(protruding, steps) {
  const radii = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    let r = PLANET_RADIUS;

    for (const pf of protruding) {
      let angleDiff = t - pf.angle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      const spread = pf.span + 0.25;
      if (Math.abs(angleDiff) < spread) {
        const falloff = Math.cos((angleDiff / spread) * (Math.PI / 2));
        const bumpHeight = pf.protrusion * falloff * falloff;
        r = Math.max(r, PLANET_RADIUS + bumpHeight);
      }
    }

    radii.push({ t, r });
  }
  return radii;
}

function drawDeformedPlanet() {
  const ctx = render.context;
  const protruding = getProtrudingFruits();
  const steps = 180;
  const radii = getDeformedRadii(protruding, steps);
  const ringWidth = RING_THICKNESS;

  ctx.save();
  ctx.globalCompositeOperation = "destination-over";

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const { t, r } = radii[i];
    const px = CENTER.x + Math.cos(t) * (r + ringWidth / 2);
    const py = CENTER.y + Math.sin(t) * (r + ringWidth / 2);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  for (let i = steps; i >= 0; i--) {
    const { t, r } = radii[i];
    const px = CENTER.x + Math.cos(t) * (r - ringWidth / 2);
    const py = CENTER.y + Math.sin(t) * (r - ringWidth / 2);
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#E6B143";
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const { t, r } = radii[i];
    const px = CENTER.x + Math.cos(t) * (r - ringWidth / 2);
    const py = CENTER.y + Math.sin(t) * (r - ringWidth / 2);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 236, 184, 1)";
  ctx.fill();

  ctx.restore();
}

function getProtrudingFruits() {
  const results = [];
  const bodies = Composite.allBodies(engine.world);
  bodies.forEach((body) => {
    if (!isFruit(body)) return;
    const fruit = FRUITS[body.fruitIndex];
    const dx = body.position.x - CENTER.x;
    const dy = body.position.y - CENTER.y;
    const dist = Math.hypot(dx, dy);
    const outerEdge = dist + fruit.drawRadius;
    const protrusion = outerEdge - PLANET_RADIUS;
    if (protrusion > 0) {
      const bodyAngle = Math.atan2(dy, dx);
      const angularSpan = Math.asin(Math.min(fruit.drawRadius / Math.max(dist, 1), 1));
      results.push({ body, protrusion, angle: bodyAngle, span: angularSpan });
    }
  });
  return results;
}

function checkProtrusion() {
  const protruding = getProtrudingFruits();
  const hasDanger = protruding.some((pf) => pf.protrusion >= PROTRUSION_DANGER);

  if (hasDanger && !warningActive) {
    startWarning();
  } else if (!hasDanger && warningActive) {
    clearWarning();
  }
}

function startWarning() {
  warningActive = true;
  warningCountdown = WARNING_DURATION;
  warningOverlay.classList.add("active");
  warningTimer.textContent = warningCountdown;

  warningIntervalId = setInterval(() => {
    warningCountdown -= 1;
    warningTimer.textContent = Math.max(warningCountdown, 0);

    if (warningCountdown <= 0) {
      clearInterval(warningIntervalId);
      warningIntervalId = null;

      const stillDanger = getProtrudingFruits().some(
        (pf) => pf.protrusion >= PROTRUSION_DANGER
      );
      if (stillDanger) {
        triggerGameOver();
      } else {
        clearWarning();
      }
    }
  }, 1000);
}

function clearWarning() {
  warningActive = false;
  warningCountdown = 0;
  warningOverlay.classList.remove("active");
  if (warningIntervalId) {
    clearInterval(warningIntervalId);
    warningIntervalId = null;
  }
}

function triggerGameOver() {
  gameEnded = true;
  stopTimer();
  clearWarning();
  saveRanking(false, score, elapsedSeconds);
  finalScoreEl.textContent = score;
  gameOverOverlay.classList.add("active");
}

function triggerWin() {
  gameEnded = true;
  stopTimer();
  clearWarning();
  saveRanking(true, score, elapsedSeconds);
  winTimeEl.textContent = formatTime(elapsedSeconds);
  winScoreEl.textContent = score;
  winOverlay.classList.add("active");
}

function startTimer() {
  elapsedSeconds = 0;
  timerValue.textContent = formatTime(0);
  timerIntervalId = setInterval(() => {
    if (gameEnded) return;
    elapsedSeconds += 1;
    timerValue.textContent = formatTime(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function saveRanking(won, finalScore, seconds) {
  rankingsRef.push({
    name: playerName,
    won,
    score: finalScore,
    time: seconds,
    date: new Date().toLocaleDateString(),
    timestamp: Date.now(),
    platform: "phone",
  });
}

function renderRankings() {
  rankingList.innerHTML = '<div class="rank-empty">Loading...</div>';
  rankingsRef.orderByChild("timestamp").once("value", (snapshot) => {
    const entries = [];
    snapshot.forEach((child) => {
      entries.push(child.val());
    });
    entries.sort((a, b) => {
      if (a.won !== b.won) return a.won ? -1 : 1;
      if (a.won && b.won) return a.time - b.time;
      return b.score - a.score;
    });

    rankingList.innerHTML = "";
    if (entries.length === 0) {
      rankingList.innerHTML = '<div class="rank-empty">No records yet. Be the first!</div>';
      return;
    }

    entries.slice(0, MAX_RANKINGS).forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "rank-row";
      const result = entry.won ? "WIN" : "LOSE";
      const name = entry.name || "Anonymous";
      row.innerHTML =
        '<span class="rank-pos">#' + (i + 1) + '</span>' +
        '<span class="rank-name">' + name + '</span>' +
        '<span class="rank-result">' + result + '</span>' +
        '<span class="rank-score">' + entry.score + '</span>' +
        '<span class="rank-time">' + formatTime(entry.time) + '</span>';
      rankingList.appendChild(row);
    });
  });
}

function buildBoundaryRing() {
  const segments = [];
  const count = 64;
  const segmentLength = (2 * Math.PI * PLANET_RADIUS) / count;

  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * 2 * Math.PI;
    const x = CENTER.x + Math.cos(t) * PLANET_RADIUS;
    const y = CENTER.y + Math.sin(t) * PLANET_RADIUS;
    segments.push(
      Bodies.rectangle(x, y, segmentLength + 4, RING_THICKNESS, {
        isStatic: true,
        angle: t + Math.PI / 2,
        render: { visible: false },
      }),
    );
  }

  return segments;
}

function isFruit(body) {
  return Number.isInteger(body.fruitIndex);
}

function randomStartFruitIndex() {
  return Math.floor(Math.random() * 5);
}

function preloadFruitImages() {
  FRUITS.forEach((fruit) => {
    const img = new Image();
    img.onload = () => {
      imageSizeCache[fruit.texture] = Math.max(img.naturalWidth, img.naturalHeight) || 256;
    };
    img.src = fruit.texture;
  });
}

function createFruitBody(x, y, fruitIndex) {
  const fruit = FRUITS[fruitIndex];
  const drawDiameter = fruit.drawRadius * 2;
  const imgSize = imageSizeCache[fruit.texture] || 256;
  const spriteScale = drawDiameter / imgSize;
  const densityScale = 1 + fruitIndex * 0.8;

  return Bodies.circle(x, y, fruit.visRadius, {
    fruitIndex,
    density: 0.001 * densityScale,
    restitution: 0.12,
    friction: 0.06,
    frictionAir: 0.012 + fruitIndex * 0.004,
    render: {
      fillStyle: "transparent",
      sprite: {
        texture: fruit.texture,
        xScale: spriteScale,
        yScale: spriteScale,
      },
    },
  });
}

function applyPlanetGravity() {
  const bodies = Composite.allBodies(engine.world);

  bodies.forEach((body) => {
    if (body.isStatic || !isFruit(body)) return;

    const dx = CENTER.x - body.position.x;
    const dy = CENTER.y - body.position.y;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const ux = dx / distance;
    const uy = dy / distance;

    const gravityBoost = 1 + body.fruitIndex * 0.35;
    const forceMagnitude = RADIAL_GRAVITY * body.mass * gravityBoost;

    Body.applyForce(body, body.position, {
      x: ux * forceMagnitude,
      y: uy * forceMagnitude,
    });
  });
}

function stepPipette() {
  if (rotateDir === 0) return;
  angle += rotateDir * ANGULAR_SPEED;
  updatePipetteUI();
}

function updatePipetteUI() {
  const px = CENTER.x + Math.cos(angle) * PIPETTE_ORBIT;
  const py = CENTER.y + Math.sin(angle) * PIPETTE_ORBIT;
  const rotationDeg = (angle + Math.PI / 2) * (180 / Math.PI);

  pipetteWrapper.style.left = `${px - PIPETTE_PIVOT_X}px`;
  pipetteWrapper.style.top = `${py - PIPETTE_PIVOT_Y}px`;
  pipetteWrapper.style.transform = `rotate(${rotationDeg}deg)`;
}

function updateNextFruitUI() {
  const current = FRUITS[currentFruitIndex];
  const uiDiameter = Math.round(NEXT_BUBBLE_SIZE * NEXT_FRUIT_RATIO);
  nextFruitEl.style.width = `${uiDiameter}px`;
  nextFruitEl.style.height = `${uiDiameter}px`;
  nextFruitEl.style.backgroundImage = `url("${current.texture}")`;
  nextFruitEl.style.backgroundPosition = "center";
  nextFruitEl.style.backgroundRepeat = "no-repeat";
  nextFruitEl.style.backgroundSize = "contain";
  nextFruitEl.style.backgroundColor = "transparent";

  const next = FRUITS[nextFruitIndex];
  if (nextFruitEvolutionImg) {
    nextFruitEvolutionImg.style.backgroundImage = `url("${next.texture}")`;
    nextFruitEvolutionImg.title = next.name;
  }
  if (nextFruitEvolutionName) {
    nextFruitEvolutionName.textContent = next.name;
  }
}

function dropFruit() {
  canDrop = false;

  const inwardDist = PLANET_RADIUS - Math.round(34 * S);
  const spawnX = CENTER.x + Math.cos(angle) * inwardDist;
  const spawnY = CENTER.y + Math.sin(angle) * inwardDist;
  const body = createFruitBody(spawnX, spawnY, currentFruitIndex);

  const inwardSpeed = 1.2;
  Body.setVelocity(body, {
    x: -Math.cos(angle) * inwardSpeed,
    y: -Math.sin(angle) * inwardSpeed,
  });

  World.add(engine.world, body);

  currentFruitIndex = nextFruitIndex;
  nextFruitIndex = randomStartFruitIndex();
  updateNextFruitUI();

  setTimeout(() => {
    canDrop = true;
  }, 260);
}

function updateScore(nextScore) {
  score = nextScore;
  scoreValue.textContent = String(score);
}

function getAvailableSize() {
  const app = document.getElementById("app");
  if (app) {
    return { w: app.clientWidth, h: app.clientHeight };
  }
  const vv = window.visualViewport;
  return {
    w: vv ? vv.width : window.innerWidth,
    h: vv ? vv.height : window.innerHeight,
  };
}

function fitGameToViewport() {
  const wrap = document.getElementById("app-scale");
  const inner = document.getElementById("app-inner");
  if (!wrap || !inner) return;

  const { w: availW, h: availH } = getAvailableSize();
  const scale = Math.min(availW / WIDTH, availH / HEIGHT);

  wrap.style.width = `${WIDTH * scale}px`;
  wrap.style.height = `${HEIGHT * scale}px`;
  inner.style.transform = `scale(${scale})`;
  layoutPhoneUI();
}

fitGameToViewport();
window.addEventListener("resize", fitGameToViewport);
window.addEventListener("orientationchange", () => {
  setTimeout(fitGameToViewport, 100);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitGameToViewport);
}

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
