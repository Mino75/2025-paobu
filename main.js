/* main.js — single-file emoji game engine (EN)
   - Start popup -> sequential Levels (time-based) -> End -> Main Menu
   - Layers are named objects; Levels superpose layers by z-index
   - Mobile elements reference a shared MovementBehavior object
   - Each Level defines a Player + optional Chaser
   - Mobile: randomized direction, accel/decel/pause/turn-back + jitter vibration
   - Fixed: stackable vs non-stackable; non-stackable uses widthPx to avoid overlap
   - Mobile landscape: tries orientation lock; otherwise shows rotate overlay
   - Emoji direction: all emojis are drawn "facing left" by default.
     When moving right, we mirror the character horizontally.
*/

(() => {
  // -----------------------------
  // Core utils
  // -----------------------------
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eventThisFrame = (pPerSec, dtMs) => Math.random() < (pPerSec * dtMs) / 1000;

  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

  const isLandscape = () => window.innerWidth >= window.innerHeight;

  // -----------------------------
  // Canvas
  // -----------------------------
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.appendChild(canvas);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  const viewport = () => ({ w: canvas.width, h: canvas.height });

  // -----------------------------
  // Overlay UI
  // -----------------------------
  let activeOverlay = null;

  function removeOverlay() {
    if (activeOverlay) activeOverlay.remove();
    activeOverlay = null;
  }

  function makeOverlay({ title, subtitle, buttons = [] }) {
    removeOverlay();

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed; inset:0; display:grid; place-items:center;
      background:rgba(0,0,0,0.62); z-index:9999;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      width:min(620px, calc(100vw - 32px));
      background:rgba(16,16,20,0.94);
      color:#fff;
      border:1px solid rgba(255,255,255,0.14);
      border-radius:18px;
      padding:20px 18px;
      box-shadow:0 22px 60px rgba(0,0,0,0.55);
    `;

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-size:20px; font-weight:800; letter-spacing:0.2px;";

    const p = document.createElement("div");
    p.textContent = subtitle || "";
    p.style.cssText = "margin-top:10px; opacity:0.85; line-height:1.35;";

    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;";

    buttons.forEach(({ label, onClick, primary }) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = `
        appearance:none; border:1px solid rgba(255,255,255,0.18);
        background:${primary ? "rgba(255,255,255,0.18)" : "transparent"};
        color:#fff; border-radius:12px; padding:10px 14px;
        cursor:pointer; font-weight:700;
      `;
      b.addEventListener("click", onClick);
      row.appendChild(b);
    });

    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(row);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    activeOverlay = overlay;
    return overlay;
  }

  // -----------------------------
  // Config objects (6 types)
  // -----------------------------

  // 1) MovementBehavior (shared across mobiles)
  const Behaviors = {
    traffic: {
      spawn: { fromLeftP: 0.5 }, // initial direction decision
      speed: { min: 90, max: 280 },

      events: {
        changeSpeedPPerSec: 0.35,
        accelP: 0.55,
        accelFactor: { min: 1.05, max: 1.28 },
        decelFactor: { min: 0.75, max: 0.95 },

        pausePPerSec: 0.12,
        pauseMs: { min: 250, max: 1100 },

        turnBackPPerSec: 0.08,
      },

      jitter: { ampX: 0.8, ampY: 1.8, freqHz: { min: 6, max: 12 } },

      bounds: {
        turnBackAtEdgeP: 0.55,
        marginFactor: 2.0, // margin = fontSize * marginFactor
      },

      ttlMs: 22000,
    },

personWalk: {
    spawn: { fromLeftP: 0.5 },

    // Humans: slower than vehicles
    speed: { min: 35, max: 95 },

    events: {
      // People adjust pace sometimes
      changeSpeedPPerSec: 0.22,
      accelP: 0.50,
      accelFactor: { min: 1.03, max: 1.14 },
      decelFactor: { min: 0.82, max: 0.97 },

      // People stop more often (look around, phone, etc.)
      pausePPerSec: 0.18,
      pauseMs: { min: 350, max: 2000 },

      // Occasional U-turn (missed direction, etc.)
      turnBackPPerSec: 0.05,
    },

    // "Walking bob" + micro jitter
    // ampY a bit higher than vehicles to simulate stepping.
    jitter: { ampX: 0.35, ampY: 1.25, freqHz: { min: 2.0, max: 4.0 } },

    bounds: {
      // More likely to turn back at edges than disappear
      turnBackAtEdgeP: 0.75,
      marginFactor: 2.0,
    },

    ttlMs: 30000,
  },
   
    floaty: {
      spawn: { fromLeftP: 0.5 },
      speed: { min: 15, max: 90 },
      events: {
        changeSpeedPPerSec: 0.12,
        accelP: 0.5,
        accelFactor: { min: 1.02, max: 1.12 },
        decelFactor: { min: 0.82, max: 0.98 },
        pausePPerSec: 0.05,
        pauseMs: { min: 200, max: 900 },
        turnBackPPerSec: 0.03,
      },
      jitter: { ampX: 0.5, ampY: 1.4, freqHz: { min: 3, max: 7 } },
      bounds: { turnBackAtEdgeP: 0.35, marginFactor: 2.0 },
      ttlMs: 26000,
    },
  };

  // 2) MobileElementDef: emoji + fontSize + spawn rate + behavior reference
  // NOTE: emojis are assumed to be "left-facing" visually by default.
  const MobileElements = {
    wbike: { emoji: "🚴‍♀️", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    pwalk: { emoji: "🚶", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    pwalk2: { emoji: "🚶🏾", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    car: { emoji: "🚗", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    rickshaw: { emoji: "🛺", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    ambulance: { emoji: "🚑", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    minibus: { emoji: "🚐", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    fireengine: { emoji: "🚒", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    lorry: { emoji: "🚛", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    delivery: { emoji: "🚚", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    taxi: { emoji: "🚕", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    racing: { emoji: "🏎️", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    utility: { emoji: "🚙", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    tractor: { emoji: "🚜", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    police: { emoji: "🚓", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    car: { emoji: "🚗", fontSize: 32, ratePerSec: 1.2, behavior: "traffic" },
    bus: { emoji: "🚌", fontSize: 36, ratePerSec: 0.5, behavior: "traffic" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🪂", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🚁", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    drone: { emoji: "🛸", fontSize: 28, ratePerSec: 0.7, behavior: "floaty" },
    bird: { emoji: "🕊️", fontSize: 28, ratePerSec: 0.9, behavior: "floaty" },
  };

  // 3) FixedElementDef: emoji + fontSize + probability + stackable + widthPx
  // widthPx is used for NON-stackable placement (avoid overlap).
  const FixedElements = {
  factory:  { emoji: "🏭", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  stadium:  { emoji: "🏟️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  classicalb:  { emoji: "🏛️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  hut:  { emoji: "🛖", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  houses:  { emoji: "🏘️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  dhouse:  { emoji: "🏚️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  house:  { emoji: "🏠", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  ghouse:  { emoji: "🏡", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  store:  { emoji: "🏪", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  school:  { emoji: "🏫", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  dstore:  { emoji: "🏬", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  jcastle:  { emoji: "🏯", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  castle:  { emoji: "🏰", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  wchurch:  { emoji: "💒", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  ttower:  { emoji: "🗼", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  church:  { emoji: "⛪", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  mosque:  { emoji: "🕌", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  htemple:  { emoji: "🛕", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  synagogue:  { emoji: "🕍", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  shrine:  { emoji: "⛩️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  fountain:  { emoji: "⛲", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  tent:  { emoji: "⛺", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  fwheel:  { emoji: "🎡", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  circus:  { emoji: "🎪", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  moai:  { emoji: "🗿", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  scmountain:  { emoji: "🏔️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  mountain:  { emoji: "⛰️", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  volcano:  { emoji: "🌋", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  fujisan:  { emoji: "🗻", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  hotel:  { emoji: "🏨", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  bank:  { emoji: "🏦", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  hostpital:  { emoji: "🏥", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  poffice:  { emoji: "🏣", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  office: { emoji: "🏢", fontSize: 60, probability: 0.30, stackable: false, widthPx: 120 },
  dtree:     { emoji: "🌳", fontSize: 56, probability: 0.65, stackable: true,  widthPx: 70  },
  smushrooom:  { emoji: "🍄", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  gmushroom:  { emoji: "🍄", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  etree:  { emoji: "🌲", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  ptree:  { emoji: "🌴", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  cactus:  { emoji: "🌵", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  ltree:  { emoji: "🪾", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  rock:  { emoji: "🪨", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  log:  { emoji: "🪵", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  playground:  { emoji: "🛝", fontSize: 64, probability: 0.35, stackable: false, widthPx: 140 },
  cloud:    { emoji: "☁️", fontSize: 52, probability: 0.65, stackable: true,  widthPx: 90  },
  };

  // 4) LayerDef: name + height + list of mobiles/fixed
const Layers = {
  sky:  { name: "sky",  height: 220, mobiles: ["drone", "bird"], fixed: ["cloud"] },
  mountains: { name: "mountains", height: 260, mobiles: [],                 fixed: ["mountain"] },
  city: { name: "city", height: 260, mobiles: ["car","pwalk"],                 fixed: ["building", "factory", "tree"] },
  woods: { name: "woods", height: 260, mobiles: [],                 fixed: ["building", "factory", "tree"] },
  road: { name: "road", height: 320, mobiles: ["car", "bus"],     fixed: ["tree"] },
};

  // 5) PlayerDef: emoji + fontSize
  const Players = {
    runner: { emoji: "🧍", fontSize: 34 },
    ninja: { emoji: "🥷", fontSize: 34 },
    robot: { emoji: "🤖", fontSize: 34 },
  };

  // 6) ChaserDef (optional in level)
  const Chasers = {
    ghost: {
      emoji: "👻",
      fontSize: 34,
      speed: 160,
      jitter: { ampX: 0.5, ampY: 0.5, freqHz: { min: 4, max: 9 } },
      arriveRadius: 10,
    },
    trex: {
      emoji: "🦖",
      fontSize: 34,
      speed: 190,
      jitter: { ampX: 0.4, ampY: 0.4, freqHz: { min: 5, max: 10 } },
      arriveRadius: 12,
    },
  };

  // LevelDef: duration + layerRefs with z + player + optional chaser
  const GameDef = {
    levels: [
      {
        name: "Level 1",
        durationMs: 12000,
        player: "runner",
        chaser: null,
        layers: [
          { layer: "sky", z: 10 },
          { layer: "city", z: 20 },
          { layer: "road", z: 30 },
        ],
      },
      {
        name: "Level 2",
        durationMs: 15000,
        player: "ninja",
        chaser: "ghost",
        layers: [
          { layer: "sky", z: 10 },
          { layer: "city", z: 20 },
          { layer: "road", z: 30 },
        ],
      },
      {
        name: "Level 3",
        durationMs: 18000,
        player: "robot",
        chaser: "trex",
        layers: [
          { layer: "sky", z: 10 },
          { layer: "city", z: 20 },
          { layer: "road", z: 30 },
        ],
      },
    ],
  };

  // -----------------------------
  // Drawing helpers (with mirroring)
  // -----------------------------
  function resolveBehavior(ref) {
    if (!ref) return null;
    if (typeof ref === "string") return Behaviors[ref];
    return ref;
  }

  // Draw emoji normally (left-facing baseline)
  function drawEmoji(ctx, emoji, x, y, fontSize) {
    ctx.font = `${fontSize}px system-ui, apple color emoji, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(emoji, x, y);
  }

  // Draw emoji mirrored horizontally around its anchor when moving right.
  // The anchor is the top-left drawing position used for left-facing drawing.
  function drawEmojiFacing(ctx, emoji, x, y, fontSize, facing) {
    // facing: -1 => left (no mirror), +1 => right (mirror)
    if (facing !== 1) {
      drawEmoji(ctx, emoji, x, y, fontSize);
      return;
    }

    // Mirror by scaling X by -1, then drawing at mirrored coordinates.
    // We shift by fontSize to keep the anchor roughly consistent.
    ctx.save();
    ctx.translate(x + fontSize, 0);
    ctx.scale(-1, 1);
    drawEmoji(ctx, emoji, 0, y, fontSize);
    ctx.restore();
  }

  function jitterOffset(tMs, jitter, freqHz, phaseX, phaseY) {
    if (!jitter) return { ox: 0, oy: 0 };
    const t = tMs / 1000;
    const ox = Math.sin(t * freqHz * Math.PI * 2 + phaseX) * (jitter.ampX ?? 0);
    const oy = Math.cos(t * freqHz * Math.PI * 2 + phaseY) * (jitter.ampY ?? 0);
    return { ox, oy };
  }

  // -----------------------------
  // Fixed placement (stackable / non-stackable)
  // -----------------------------
  function placeFixedInBand(fixedKeys, band, vp) {
    const placed = [];
    const occupied = []; // segments for non-stackables: {x0,x1}
    const maxAttempts = 22;

    for (const key of fixedKeys) {
      const def = FixedElements[key];
      if (!def) continue;

      const p = def.probability ?? 0;
      if (Math.random() >= p) continue;

      const fontSize = def.fontSize ?? 48;
      const widthPx = def.widthPx ?? fontSize * 1.2;

      let ok = false;
      let x = 0;

      for (let a = 0; a < maxAttempts; a++) {
        x = rand(0, Math.max(0, vp.w - widthPx));

        if (def.stackable) {
          ok = true;
          break;
        }

        const seg = { x0: x, x1: x + widthPx };
        const overlaps = occupied.some((s) => !(seg.x1 <= s.x0 || seg.x0 >= s.x1));
        if (!overlaps) {
          occupied.push(seg);
          ok = true;
          break;
        }
      }

      if (!ok) continue;

      const y = rand(band.yTop, Math.max(band.yTop, band.yBottom - fontSize));

      placed.push({
        type: "fixed",
        key,
        emoji: def.emoji,
        fontSize,
        x,
        y,
        tMs: 0,
      });
    }

    return placed;
  }

  // -----------------------------
  // Mobile instances (behavior-driven)
  // -----------------------------
  function createMobileInstance(mobileKey, band, vp) {
    const def = MobileElements[mobileKey];
    if (!def) return null;

    const behavior = resolveBehavior(def.behavior);
    const fromLeft = Math.random() < (behavior?.spawn?.fromLeftP ?? 0.5);
    const dir = fromLeft ? 1 : -1; // +1 right, -1 left

    const fontSize = def.fontSize ?? 32;
    const baseSpeed = rand(behavior.speed.min, behavior.speed.max);
    const vx = dir * baseSpeed;

    const x = fromLeft ? -fontSize : vp.w + fontSize;
    const y = rand(band.yTop, Math.max(band.yTop, band.yBottom - fontSize));

    const freq = behavior?.jitter?.freqHz ?? { min: 6, max: 12 };

    return {
      type: "mobile",
      key: mobileKey,
      emoji: def.emoji,
      fontSize,

      x,
      y,
      vx,
      pausedMs: 0,

      behavior,
      tMs: 0,
      ttlMs: behavior?.ttlMs ?? 15000,

      jitterFreq: rand(freq.min, freq.max),
      jitterPhaseX: rand(0, Math.PI * 2),
      jitterPhaseY: rand(0, Math.PI * 2),
    };
  }

  function updateMobile(it, dtMs, vp) {
    const b = it.behavior;
    it.tMs += dtMs;
    it.ttlMs -= dtMs;

    // pause lifecycle
    if (it.pausedMs > 0) {
      it.pausedMs -= dtMs;
    } else if (eventThisFrame(b.events.pausePPerSec ?? 0, dtMs)) {
      it.pausedMs = rand(b.events.pauseMs.min, b.events.pauseMs.max);
    }

    // speed change events
    if (it.pausedMs <= 0 && eventThisFrame(b.events.changeSpeedPPerSec ?? 0, dtMs)) {
      const accel = Math.random() < (b.events.accelP ?? 0.5);
      if (accel) it.vx *= rand(b.events.accelFactor.min, b.events.accelFactor.max);
      else it.vx *= rand(b.events.decelFactor.min, b.events.decelFactor.max);

      const s = clamp(Math.abs(it.vx), b.speed.min, b.speed.max);
      it.vx = Math.sign(it.vx || 1) * s;
    }

    // random U-turn (when it turns back, vx flips => facing will auto flip)
    if (it.pausedMs <= 0 && eventThisFrame(b.events.turnBackPPerSec ?? 0, dtMs)) {
      it.vx *= -1;
    }

    // integrate
    if (it.pausedMs <= 0) {
      it.x += it.vx * (dtMs / 1000);
    }

    // bounds policy: turn back or remove
    const margin = it.fontSize * (b.bounds?.marginFactor ?? 2.0);
    const offLeft = it.x < -margin;
    const offRight = it.x > vp.w + margin;

    if (offLeft || offRight) {
      const p = b.bounds?.turnBackAtEdgeP ?? 0;
      if (Math.random() < p) {
        it.vx *= -1;
        it.x = clamp(it.x, -margin, vp.w + margin);
      } else {
        it.ttlMs = 0;
      }
    }
  }

  function drawMobile(ctx, it) {
    const { ox, oy } = jitterOffset(
      it.tMs,
      it.behavior?.jitter,
      it.jitterFreq,
      it.jitterPhaseX,
      it.jitterPhaseY
    );

    // Facing rule:
    // - left movement => no mirror (default emoji assumed left-facing)
    // - right movement => mirror
    const facing = it.vx > 0 ? 1 : -1;

    drawEmojiFacing(ctx, it.emoji, it.x + ox, it.y + oy, it.fontSize, facing);
  }

  // -----------------------------
  // Player + Chaser (also mirrored by direction if you later move player)
  // -----------------------------
  function createPlayer(playerKey, vp) {
    const p = Players[playerKey];
    return {
      type: "player",
      emoji: p.emoji,
      fontSize: p.fontSize ?? 34,
      x: vp.w * 0.5,
      y: vp.h * 0.66,
      tMs: 0,
      vx: 0, // reserved if you later add player movement
    };
  }

  function drawPlayer(ctx, player) {
    // Player currently static; no mirroring needed. If vx>0 later, it will mirror correctly.
    const facing = player.vx > 0 ? 1 : -1;
    drawEmojiFacing(ctx, player.emoji, player.x, player.y, player.fontSize, facing);
  }

  function createChaser(chaserKey, vp) {
    const c = Chasers[chaserKey];
    const freq = c.jitter?.freqHz ?? { min: 6, max: 12 };

    return {
      type: "chaser",
      emoji: c.emoji,
      fontSize: c.fontSize ?? 34,
      x: vp.w * 0.2,
      y: vp.h * 0.66,
      speed: c.speed ?? 150,
      arriveRadius: c.arriveRadius ?? 10,
      tMs: 0,
      vx: 0,

      jitter: c.jitter ?? null,
      jitterFreq: rand(freq.min, freq.max),
      jitterPhaseX: rand(0, Math.PI * 2),
      jitterPhaseY: rand(0, Math.PI * 2),
    };
  }

  function updateChaser(ch, player, dtMs) {
    ch.tMs += dtMs;

    const dx = player.x - ch.x;
    const dy = player.y - ch.y;
    const dist = Math.hypot(dx, dy);

    if (dist > ch.arriveRadius) {
      const ux = dx / (dist || 1);
      const uy = dy / (dist || 1);
      const step = ch.speed * (dtMs / 1000);

      const prevX = ch.x;
      ch.x += ux * step;
      ch.y += uy * step;
      ch.vx = ch.x - prevX; // sign only, used for mirroring
    } else {
      ch.vx = 0;
    }
  }

  function drawChaser(ctx, ch) {
    const { ox, oy } = jitterOffset(
      ch.tMs,
      ch.jitter,
      ch.jitterFreq,
      ch.jitterPhaseX,
      ch.jitterPhaseY
    );

    const facing = ch.vx > 0 ? 1 : -1;
    drawEmojiFacing(ctx, ch.emoji, ch.x + ox, ch.y + oy, ch.fontSize, facing);
  }

  // -----------------------------
  // Runtime Layer
  // -----------------------------
  class RuntimeLayer {
    constructor(layerDef) {
      this.name = layerDef.name;
      this.height = layerDef.height;
      this.mobileKeys = layerDef.mobiles ?? [];
      this.fixedKeys = layerDef.fixed ?? [];
      this.instances = [];
    }

    init(band, vp) {
      this.instances = placeFixedInBand(this.fixedKeys, band, vp);
    }

    update(dtMs, band, vp) {
      // spawn mobiles
      for (const key of this.mobileKeys) {
        const def = MobileElements[key];
        if (!def) continue;

        if (eventThisFrame(def.ratePerSec ?? 0, dtMs)) {
          const inst = createMobileInstance(key, band, vp);
          if (inst) this.instances.push(inst);
        }
      }

      // update instances
      for (const it of this.instances) {
        it.tMs += dtMs;
        if (it.type === "mobile") updateMobile(it, dtMs, vp);
      }

      // cull expired mobiles
      this.instances = this.instances.filter((it) => it.type === "fixed" || it.ttlMs > 0);
    }

    draw(ctx) {
      for (const it of this.instances) {
        if (it.type === "fixed") drawEmoji(ctx, it.emoji, it.x, it.y, it.fontSize);
        else if (it.type === "mobile") drawMobile(ctx, it);
      }
    }
  }

  // -----------------------------
  // Runtime Level
  // -----------------------------
  class RuntimeLevel {
    constructor(levelDef) {
      this.name = levelDef.name;
      this.durationMs = levelDef.durationMs;
      this.layerRefs = [...levelDef.layers].sort((a, b) => a.z - b.z);
      this.playerKey = levelDef.player;
      this.chaserKey = levelDef.chaser;

      this.elapsedMs = 0;
      this.layers = [];
      this.bands = new Map();

      this.player = null;
      this.chaser = null;
    }

    start(vp) {
      this.elapsedMs = 0;

      // resolve layers
      this.layers = this.layerRefs.map(({ layer, z }) => ({
        z,
        layer: new RuntimeLayer(Layers[layer]),
      }));

      // compute bands bottom-up
      this.bands.clear();
      let yCursor = vp.h;

      for (const { layer } of this.layers) {
        const h = layer.height ?? Math.floor(vp.h / this.layers.length);
        const yBottom = yCursor;
        const yTop = Math.max(0, yBottom - h);
        yCursor = yTop;

        const band = { yTop, yBottom };
        this.bands.set(layer.name, band);
        layer.init(band, vp);
      }

      // player + optional chaser
      this.player = createPlayer(this.playerKey, vp);
      this.chaser = this.chaserKey ? createChaser(this.chaserKey, vp) : null;
    }

    update(dtMs, vp) {
      this.elapsedMs += dtMs;

      for (const { layer } of this.layers) {
        const band = this.bands.get(layer.name) ?? { yTop: 0, yBottom: vp.h };
        layer.update(dtMs, band, vp);
      }

      this.player.tMs += dtMs;
      if (this.chaser) updateChaser(this.chaser, this.player, dtMs);

      // Level ends ONLY when duration expires
      return this.elapsedMs >= this.durationMs;
    }

    draw(ctx, vp) {
      // background
      ctx.clearRect(0, 0, vp.w, vp.h);
      ctx.fillStyle = "rgb(10,10,14)";
      ctx.fillRect(0, 0, vp.w, vp.h);

      // layers
      for (const { layer } of this.layers) layer.draw(ctx);

      // entities on top
      if (this.player) drawPlayer(ctx, this.player);
      if (this.chaser) drawChaser(ctx, this.chaser);

      // HUD
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const remaining = Math.max(0, this.durationMs - this.elapsedMs);
      ctx.fillText(`${this.name} • ${(remaining / 1000).toFixed(1)}s`, 14, 22);
      ctx.restore();
    }
  }

  // -----------------------------
  // Landscape gate (mobile)
  // -----------------------------
  let rotateOverlayVisible = false;

  async function tryLockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (_) {
      // Must be in user gesture and supported; fallback is rotate overlay.
    }
  }

  function showRotateOverlay() {
    if (rotateOverlayVisible) return;
    rotateOverlayVisible = true;

    makeOverlay({
      title: "Landscape required",
      subtitle: "On mobile, the game starts in landscape. Rotate your phone to landscape, then press Continue.",
      buttons: [
        {
          label: "Continue",
          primary: true,
          onClick: () => {
            if (isLandscape()) {
              rotateOverlayVisible = false;
              removeOverlay();
              game.showStartPopup();
            }
          },
        },
        {
          label: "Main Menu",
          onClick: () => {
            rotateOverlayVisible = false;
            game.showMainMenu();
          },
        },
      ],
    });
  }

  function ensureLandscapeBeforeStart() {
    if (!isTouchDevice) return true;
    if (isLandscape()) return true;
    showRotateOverlay();
    return false;
  }

  window.addEventListener("resize", () => {
    if (isTouchDevice && rotateOverlayVisible && isLandscape()) {
      rotateOverlayVisible = false;
      removeOverlay();
      game.showStartPopup();
    }
  });

  // -----------------------------
  // Game controller
  // -----------------------------
  class Game {
    constructor(gameDef) {
      this.levelDefs = gameDef.levels;
      this.state = "menu"; // menu | running | finished
      this.levelIndex = 0;
      this.level = null;

      this._raf = null;
      this._lastTs = null;
    }

    showMainMenu() {
      this.state = "menu";
      this.stopLoop();

      makeOverlay({
        title: "Main Menu",
        subtitle: "Start from popup. Levels end only when the timer expires.",
        buttons: [{ label: "Start", primary: true, onClick: () => this.showStartPopup() }],
      });
    }

    showStartPopup() {
      this.stopLoop();

      if (!ensureLandscapeBeforeStart()) return;

      makeOverlay({
        title: "Start",
        subtitle: "Press Start to run the levels in sequence.",
        buttons: [
          {
            label: "Start",
            primary: true,
            onClick: async () => {
              if (isTouchDevice) await tryLockLandscape();
              if (!ensureLandscapeBeforeStart()) return;
              removeOverlay();
              this.startGame();
            },
          },
          { label: "Main Menu", onClick: () => this.showMainMenu() },
        ],
      });
    }

    startGame() {
      this.state = "running";
      this.levelIndex = 0;
      this.loadLevel(this.levelIndex);
      this.startLoop();
    }

    loadLevel(i) {
      const vp = viewport();
      this.level = new RuntimeLevel(this.levelDefs[i]);
      this.level.start(vp);
    }

    finishGame() {
      this.state = "finished";
      this.stopLoop();

      makeOverlay({
        title: "Game Finished",
        subtitle: "All levels completed. Returning to main menu.",
        buttons: [{ label: "Main Menu", primary: true, onClick: () => this.showMainMenu() }],
      });
    }

    startLoop() {
      this._lastTs = null;

      const tick = (ts) => {
        if (this.state !== "running") return;

        if (this._lastTs == null) this._lastTs = ts;
        const dtMs = Math.min(40, ts - this._lastTs);
        this._lastTs = ts;

        const vp = viewport();

        const ended = this.level.update(dtMs, vp);
        this.level.draw(ctx, vp);

        if (ended) {
          this.levelIndex += 1;
          if (this.levelIndex >= this.levelDefs.length) {
            this.finishGame();
            return;
          }
          this.loadLevel(this.levelIndex);
        }

        this._raf = requestAnimationFrame(tick);
      };

      this._raf = requestAnimationFrame(tick);
    }

    stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  const game = new Game(GameDef);

  // Escape -> menu
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") game.showMainMenu();
  });

  // Boot
  game.showStartPopup();
})();
