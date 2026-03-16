const { Bodies, Body, Composite, Engine, Events, Render, Runner, World } = Matter;

const WIDTH = 1200;
const HEIGHT = 820;
const CENTER = { x: 430, y: 410 };
const PLANET_RADIUS = 270;
const RING_THICKNESS = 26;
const RADIAL_GRAVITY = 0.00016;
const ANGULAR_SPEED = 0.028;
const NEXT_BUBBLE_SIZE = 66;
const NEXT_FRUIT_RATIO = 0.7;
const PROTRUSION_DANGER = 20;
const WARNING_DURATION = 10;

const MAX_RANKINGS = 10;

const FRUITS = [
  { name: "Nucleotide",      visRadius: 28,  drawRadius: 42,  texture: "./design/nucleotide.png",           color: "#ff8f8f" },
  { name: "DNA",              visRadius: 35,  drawRadius: 53,  texture: "./design/dna.png",                  color: "#8fc0ff" },
  { name: "Nucleosome",       visRadius: 41,  drawRadius: 62,  texture: "./design/nucleosome.png",           color: "#c3a3ff" },
  { name: "Chromatin",        visRadius: 47,  drawRadius: 72,  texture: "./design/chromatin.png",            color: "#ffd48f" },
  { name: "Chromosome",       visRadius: 55,  drawRadius: 83,  texture: "./design/chromosome.png",          color: "#a9e49b" },
  { name: "mRNA",             visRadius: 64,  drawRadius: 96,  texture: "./design/mrna.png",                color: "#9fe2ff" },
  { name: "Protein",          visRadius: 74,  drawRadius: 111, texture: "./design/protein.png",             color: "#f3a6ff" },
  { name: "Functional Cell",  visRadius: 86,  drawRadius: 129, texture: "./design/functional%20cell.png",   color: "#9effcf" },
  { name: "Organism",         visRadius: 99,  drawRadius: 149, texture: "./design/organism.png",            color: "#ffd4f0" },
];

const SCORE_PER_MERGE_LEVEL = [0, 2, 4, 8, 14, 24, 40, 65, 100];
const imageSizeCache = {};

// --- Engine setup (paused until start) ---

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

// --- DOM refs ---

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

// --- Game state ---

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

// --- Planet visual (transparent; custom draw) ---

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

// --- Show rankings on start screen ---

renderRankings();

// --- Start button ---

startBtn.addEventListener("click", () => {
  playerName = usernameInput.value.trim() || "Anonymous";
  startOverlay.classList.remove("active");
  gameStarted = true;
  Runner.run(runner, engine);
  startTimer();
});

// --- Input ---

window.addEventListener("keydown", (event) => {
  if (!gameStarted || gameEnded) return;
  if (event.code === "KeyA") {
    rotateDir = -1;
  } else if (event.code === "KeyD") {
    rotateDir = 1;
  } else if (event.code === "KeyS" || event.code === "Space") {
    if (canDrop) {
      dropFruit();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "KeyA" && rotateDir === -1) {
    rotateDir = 0;
  } else if (event.code === "KeyD" && rotateDir === 1) {
    rotateDir = 0;
  }
});

// --- Physics loop ---

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

// --- Deformed planet rendering ---

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

// --- Protrusion & losing logic ---

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

// --- Timer ---

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

// --- Ranking (Firebase Realtime Database) ---

const rankingsRef = firebaseDB.ref("rankings");

function saveRanking(won, finalScore, seconds) {
  rankingsRef.push({
    name: playerName,
    won,
    score: finalScore,
    time: seconds,
    date: new Date().toLocaleDateString(),
    timestamp: Date.now(),
  });
}

function renderRankings() {
  rankingList.innerHTML = '<div class="rank-empty">Loading...</div>';
  rankingsRef.orderByChild("timestamp").limitToLast(MAX_RANKINGS).once("value", (snapshot) => {
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

    entries.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "rank-row";
      const result = entry.won ? "WIN" : "LOSE";
      const name = entry.name || "Anonymous";
      row.innerHTML =
        '<span class="rank-pos">#' + (i + 1) + '</span>' +
        '<span class="rank-name">' + name + '</span>' +
        '<span class="rank-result">' + result + '</span>' +
        '<span class="rank-score">' + entry.score + ' pts</span>' +
        '<span class="rank-time">' + formatTime(entry.time) + '</span>';
      rankingList.appendChild(row);
    });
  });
}

// --- Core helpers ---

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
  const pipetteOrbit = PLANET_RADIUS + 65;
  const px = CENTER.x + Math.cos(angle) * pipetteOrbit;
  const py = CENTER.y + Math.sin(angle) * pipetteOrbit;
  const rotationDeg = (angle + Math.PI / 2) * (180 / Math.PI);

  pipetteWrapper.style.left = `${px - 28}px`;
  pipetteWrapper.style.top = `${py - 45}px`;
  pipetteWrapper.style.transform = `rotate(${rotationDeg}deg)`;
}

function updateNextFruitUI() {
  // Pipette bubble: shows the CURRENT fruit (what you're about to drop)
  const current = FRUITS[currentFruitIndex];
  const uiDiameter = Math.round(NEXT_BUBBLE_SIZE * NEXT_FRUIT_RATIO);
  nextFruitEl.style.width = `${uiDiameter}px`;
  nextFruitEl.style.height = `${uiDiameter}px`;
  nextFruitEl.style.backgroundImage = `url("${current.texture}")`;
  nextFruitEl.style.backgroundPosition = "center";
  nextFruitEl.style.backgroundRepeat = "no-repeat";
  nextFruitEl.style.backgroundSize = "contain";
  nextFruitEl.style.backgroundColor = "transparent";

  // Evolution "Next" bubble: shows what comes AFTER the current drop
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

  const inwardDist = PLANET_RADIUS - 34;
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

// Scale game to fill viewport (no border)
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 820;

function fitGameToViewport() {
  const inner = document.getElementById("app-inner");
  if (!inner) return;
  const scale = Math.max(
    window.innerWidth / GAME_WIDTH,
    window.innerHeight / GAME_HEIGHT
  );
  inner.style.transform = "scale(" + scale + ")";
}

fitGameToViewport();
window.addEventListener("resize", fitGameToViewport);
