const { Bodies, Body, Composite, Engine, Events, Render, Runner, World } = Matter;

const ASSET_BASE = "../design/";
function designUrl(file) {
  return `${ASSET_BASE}${file}`;
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
const FRUIT_SIZE_SCALE = 1.5;
const NEXT_HINT_BUBBLE = 52;
const PREVIEW_BUBBLE_SCALE = 1.3;
const PREVIEW_FRUIT_RATIO = 0.92;
const PROTRUSION_DANGER = Math.round(20 * S);
const WARNING_DURATION = 10;
const PIPETTE_ORBIT = PLANET_RADIUS + Math.round(65 * S);
const PIPETTE_PIVOT_X = Math.round(35 * (80 / 120));
const PIPETTE_PIVOT_Y = Math.round(45 * (80 / 120));
const DISH_BOTTOM = CENTER.y + PLANET_RADIUS + RING_THICKNESS;

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
const COLLISION_RATIO = 0.94;
const imageMetaCache = {};

function measureImageContent(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const maxSample = 256;
  const sampleScale = Math.min(1, maxSample / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * sampleScale));
  const sh = Math.max(1, Math.round(h * sampleScale));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;

  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      if (data[(y * sw + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const imgSize = Math.max(w, h);
  if (maxX < minX) {
    return { imgSize, contentHalf: imgSize / 2 };
  }

  const cw = (maxX - minX + 1) / sampleScale;
  const ch = (maxY - minY + 1) / sampleScale;
  return { imgSize, contentHalf: Math.max(cw, ch) / 2 };
}

function getFruitRadii(fruit) {
  const meta = imageMetaCache[fruit.texture];
  const imgSize = meta?.imgSize || 256;
  const contentHalf = meta?.contentHalf || imgSize / 2;
  const drawRadius = fruit.drawRadius * FRUIT_SIZE_SCALE;
  const spriteScale = (drawRadius * 2) / imgSize;
  const contentRadius = contentHalf * spriteScale;
  const visRadius = Math.max(6, contentRadius * COLLISION_RATIO);
  return { visRadius, contentRadius, spriteScale, imgSize };
}

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
const pretestError = document.getElementById("pretest-error");
const gameoverContinueBtn = document.getElementById("gameover-continue-btn");
const winContinueBtn = document.getElementById("win-continue-btn");
const posttestOverlay = document.getElementById("posttest-overlay");
const posttestError = document.getElementById("posttest-error");
const posttestStatus = document.getElementById("posttest-status");
const posttestSubmitBtn = document.getElementById("posttest-submit-btn");
const thankyouOverlay = document.getElementById("thankyou-overlay");
const thankyouMessage = document.getElementById("thankyou-message");
const nextFruitEvolutionImg = document.getElementById("next-fruit-evolution-img");
const nextFruitEvolutionName = document.getElementById("next-fruit-evolution-name");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnDrop = document.getElementById("btn-drop");

let playerName = "";
let surveySession = null;
let lastGameWon = false;

function setSurveyScrollEnabled(enabled) {
  document.body.style.touchAction = enabled ? "pan-y" : "none";
  document.getElementById("app-inner")?.classList.toggle("survey-mode", enabled);
}

function beginGame() {
  if (gameStarted) return;

  const preResult = readSurveyAnswers(PRE_QUESTIONS);
  if (!preResult.complete) {
    if (pretestError) pretestError.hidden = false;
    return;
  }
  if (pretestError) pretestError.hidden = true;

  playerName = usernameInput?.value.trim() || "Anonymous";

  surveySession = {
    sessionId: createSurveySessionId(),
    name: playerName,
    preQ1: preResult.answers.preQ1,
    preQ2: preResult.answers.preQ2,
    preQ3: preResult.answers.preQ3,
  };

  setSurveyScrollEnabled(false);
  startOverlay?.classList.remove("active");
  gameStarted = true;
  if (!runnerStarted) {
    Runner.run(runner, engine);
    runnerStarted = true;
  }
  startTimer();
}

function openPostTest() {
  gameOverOverlay?.classList.remove("active");
  winOverlay?.classList.remove("active");
  if (posttestError) posttestError.hidden = true;
  if (posttestStatus) {
    posttestStatus.hidden = true;
    posttestStatus.textContent = "";
  }
  setSurveyScrollEnabled(true);
  posttestOverlay?.classList.add("active");
}

async function submitPostTest() {
  const postResult = readSurveyAnswers(POST_QUESTIONS);
  if (!postResult.complete) {
    if (posttestError) posttestError.hidden = false;
    return;
  }
  if (posttestError) posttestError.hidden = true;

  if (posttestSubmitBtn) {
    posttestSubmitBtn.disabled = true;
    posttestSubmitBtn.textContent = "Submitting… / 提交中…";
  }
  if (posttestStatus) {
    posttestStatus.hidden = false;
    posttestStatus.textContent = "Submitting… / 提交中…";
  }

  const payload = {
    timestamp: new Date().toISOString(),
    sessionId: surveySession?.sessionId || createSurveySessionId(),
    name: surveySession?.name || playerName || "Anonymous",
    preQ1: surveySession?.preQ1 || "",
    preQ2: surveySession?.preQ2 || "",
    preQ3: surveySession?.preQ3 || "",
    postQ1: postResult.answers.postQ1,
    postQ2: postResult.answers.postQ2,
    postQ3: postResult.answers.postQ3,
    score,
    timeSeconds: elapsedSeconds,
    won: lastGameWon,
  };

  const result = await submitSurveyResponse(payload);

  posttestOverlay?.classList.remove("active");

  if (thankyouMessage) {
    if (result.skipped) {
      thankyouMessage.textContent =
        "Thank you for completing the survey! (Google Sheets is not configured — responses were not sent to the server.) / 感謝完成問卷！（尚未設定 Google 試算表，回覆未上傳。）";
    } else if (result.ok) {
      thankyouMessage.textContent =
        "Your responses have been recorded. Thank you! / 您的回覆已提交，感謝參與！";
    } else {
      thankyouMessage.textContent =
        "We could not confirm submission. If the problem persists, please contact your instructor. / 無法確認是否提交成功，若問題持續請聯絡老師。";
    }
  }

  thankyouOverlay?.classList.add("active");
  setSurveyScrollEnabled(true);

  if (posttestSubmitBtn) {
    posttestSubmitBtn.disabled = false;
    posttestSubmitBtn.textContent = "Submit / 提交";
  }
  if (posttestStatus) posttestStatus.hidden = true;
}

if (startBtn) {
  startBtn.addEventListener("click", beginGame);
}

gameoverContinueBtn?.addEventListener("click", openPostTest);
winContinueBtn?.addEventListener("click", openPostTest);
posttestSubmitBtn?.addEventListener("click", submitPostTest);

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

function layoutPhoneUI() {
  const controlsTop = DISH_BOTTOM + 16;
  const controlsHeight = 64;
  const footerTop = controlsTop + controlsHeight + 8;
  const footerBottomReserved = 44;
  const footerHeight = Math.max(150, HEIGHT - footerTop - footerBottomReserved);

  document.documentElement.style.setProperty("--footer-top", `${footerTop}px`);
  document.documentElement.style.setProperty("--footer-height", `${footerHeight}px`);
  document.documentElement.style.setProperty(
    "--controls-top",
    `${controlsTop}px`,
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
    const { contentRadius } = getFruitRadii(fruit);
    const dx = body.position.x - CENTER.x;
    const dy = body.position.y - CENTER.y;
    const dist = Math.hypot(dx, dy);
    const outerEdge = dist + contentRadius;
    const protrusion = outerEdge - PLANET_RADIUS;
    if (protrusion > 0) {
      const bodyAngle = Math.atan2(dy, dx);
      const angularSpan = Math.asin(Math.min(contentRadius / Math.max(dist, 1), 1));
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
  lastGameWon = false;
  stopTimer();
  clearWarning();
  finalScoreEl.textContent = score;
  gameOverOverlay.classList.add("active");
}

function triggerWin() {
  gameEnded = true;
  lastGameWon = true;
  stopTimer();
  clearWarning();
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
      imageMetaCache[fruit.texture] = measureImageContent(img);
    };
    img.src = fruit.texture;
  });
}

function createFruitBody(x, y, fruitIndex) {
  const fruit = FRUITS[fruitIndex];
  const { visRadius, spriteScale } = getFruitRadii(fruit);
  const densityScale = 1 + fruitIndex * 0.8;

  return Bodies.circle(x, y, visRadius, {
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
  const dropBubble = document.getElementById("next-fruit-bubble");
  const hintBubble = document.getElementById("next-fruit-evolution-bubble");
  const dropBubbleSize = Math.round(NEXT_BUBBLE_SIZE * PREVIEW_BUBBLE_SCALE);
  const dropFruitSize = Math.min(
    dropBubbleSize - 2,
    Math.round(dropBubbleSize * PREVIEW_FRUIT_RATIO * FRUIT_SIZE_SCALE),
  );
  const hintBubbleSize = Math.round(NEXT_HINT_BUBBLE * PREVIEW_BUBBLE_SCALE);
  const hintFruitSize = Math.min(
    hintBubbleSize - 4,
    Math.round(hintBubbleSize * PREVIEW_FRUIT_RATIO * FRUIT_SIZE_SCALE),
  );

  const current = FRUITS[currentFruitIndex];
  if (dropBubble) {
    dropBubble.style.width = `${dropBubbleSize}px`;
    dropBubble.style.height = `${dropBubbleSize}px`;
  }
  nextFruitEl.style.width = `${dropFruitSize}px`;
  nextFruitEl.style.height = `${dropFruitSize}px`;
  nextFruitEl.style.backgroundImage = `url("${current.texture}")`;
  nextFruitEl.style.backgroundPosition = "center";
  nextFruitEl.style.backgroundRepeat = "no-repeat";
  nextFruitEl.style.backgroundSize = "contain";
  nextFruitEl.style.backgroundColor = "transparent";

  const next = FRUITS[nextFruitIndex];
  if (hintBubble) {
    hintBubble.style.width = `${hintBubbleSize}px`;
    hintBubble.style.height = `${hintBubbleSize}px`;
  }
  if (nextFruitEvolutionImg) {
    nextFruitEvolutionImg.style.width = `${hintFruitSize}px`;
    nextFruitEvolutionImg.style.height = `${hintFruitSize}px`;
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
setSurveyScrollEnabled(true);
window.addEventListener("resize", fitGameToViewport);
window.addEventListener("orientationchange", () => {
  setTimeout(fitGameToViewport, 100);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitGameToViewport);
}

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
