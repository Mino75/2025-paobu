// main.js - Dynamic Procedural Parallax (Memory-only)

const layerConfig = [
  { id:'layer1', key:'layer1', factor:0.1,  yFrac:0.10, fontSize:120, minSpacing:150 },
  { id:'layer2', key:'layer2', factor:0.15, yFrac:0.12, fontSize:110, minSpacing:200 },
  { id:'layer3', key:'layer3', factor:0.3,  yFrac:0.50, fontSize:400, minSpacing:300 },
  { id:'layer4', key:'layer4', factor:0.5,  yFrac:0.60, fontSize:300, minSpacing:250 },
  { id:'layer5', key:'layer5', factor:0.6,  yFrac:0.65, fontSize:80,  minSpacing:100 },
  { id:'layer6', key:'layer6', factor:0.65, yFrac:0.70, fontSize:90,  minSpacing:120 },
  { id:'layer7', key:'layer7', factor:0.75, yFrac:0.75, fontSize:60,  minSpacing:80  },
  { id:'layer8', key:'layer8', factor:0.9,  yFrac:0.85, fontSize:30,  minSpacing:40  },
  { id:'layer9', key:'layer9', factor:1.0,  yFrac:0.90, fontSize:20,  minSpacing:100 },
  { id:'layer10', key:'layer10', factor:1.0, yFrac:0.90, fontSize:40,  minSpacing:100 }
];

let offsetX = 0;
let speed = 2;                 // base movement speed px/frame
let lastProcedureX = 0;
let sceneData = null;

const PROCEDURE_DISTANCE = 6000;
const PRELOAD_AHEAD = 4500;
const CLEANUP_BEHIND = 500;

// Utility
function getRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Create element
function createEmoji(emoji, layerId, x, baselineY, fontSize) {
  const layer = document.getElementById(layerId);
  if (!layer) return;
  const el = document.createElement('span');
  el.textContent = emoji;
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${baselineY - fontSize}px`;
  el.style.fontSize = `${fontSize}px`;
  layer.appendChild(el);
}

// Generate one procedure
function generateProcedure(startX) {
  console.log(`\n--- Generating procedure at ${startX}px ---`);

  layerConfig.forEach(cfg => {
    const arr = sceneData[cfg.key];
    if (!arr || arr.length === 0) return;

    // Randomly select 1 to all unique candidates
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    const candidateCount = getRandom(1, arr.length);
    const candidates = shuffled.slice(0, candidateCount);
    console.log(`Layer: ${cfg.id}, Candidates: ${candidates.join(', ')}`);

    const slots = Math.floor(PROCEDURE_DISTANCE / cfg.minSpacing);
    let lastPlacedX = startX - cfg.minSpacing;

    const baselineY = Math.floor(window.innerHeight * cfg.yFrac);

    for (let i = 0; i < slots; i++) {
      const slotX = startX + i * cfg.minSpacing;

      // 50% chance to place
      if (Math.random() < 0.5) continue;

      // Pick a random candidate
      const emoji = candidates[getRandom(0, candidates.length - 1)];

      // Prevent overlapping
      if (slotX - lastPlacedX < cfg.minSpacing) continue;

      lastPlacedX = slotX;
      createEmoji(emoji, cfg.id, slotX, baselineY, cfg.fontSize);
      console.log(`Placed: Layer: ${cfg.id}, Emoji: ${emoji}, X: ${slotX}`);
    }
  });

  randomizeCharacter();
  cleanupOldElements();
}

// Remove elements behind view
function cleanupOldElements() {
  layerConfig.forEach(cfg => {
    const layer = document.getElementById(cfg.id);
    Array.from(layer.children).forEach(child => {
      if (parseFloat(child.style.left) + cfg.fontSize < offsetX - CLEANUP_BEHIND) {
        layer.removeChild(child);
      }
    });
  });
}

// Apply parallax
function applyParallax() {
  layerConfig.forEach(cfg => {
    const layer = document.getElementById(cfg.id);
    if (!layer) return;
    layer.style.transform = `translateX(${-offsetX * cfg.factor}px)`;
  });
}

// Animate loop
function animate() {
  offsetX += speed;
  applyParallax();

  // Generate ahead if close to threshold
  if (offsetX - lastProcedureX >= PROCEDURE_DISTANCE - PRELOAD_AHEAD) {
    generateProcedure(lastProcedureX + PROCEDURE_DISTANCE);
    lastProcedureX += PROCEDURE_DISTANCE;
  }

  requestAnimationFrame(animate);
}

// Character
function randomizeCharacter() {
  const cfg = layerConfig.find(l => l.id === 'layer10');
  if (!cfg) return;
  const arr = sceneData[cfg.key];
  if (!arr || arr.length === 0) return;

  const layer = document.getElementById(cfg.id);
  layer.innerHTML = '';

  const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
  createEmoji(arr[getRandom(0, arr.length - 1)], cfg.id, window.innerWidth / 2, baselineY, cfg.fontSize);
}

// Keyboard speed control
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') speed += 2;
  if (e.key === 'ArrowLeft') speed = Math.max(1, speed - 2);
});

// Touch swipe control
let xDown = null;
window.addEventListener('touchstart', e => xDown = e.touches[0].clientX);
window.addEventListener('touchend', e => {
  if (!xDown) return;
  const xUp = e.changedTouches[0].clientX;
  speed += (xUp < xDown) ? 2 : -2;
  speed = Math.max(1, speed);
  xDown = null;
});

// Ensure layers exist
function ensureLayers() {
  const scene = document.querySelector('.scene');
  if (!scene) return;

  layerConfig.forEach(cfg => {
    let layer = document.getElementById(cfg.id);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = cfg.id;
      layer.className = 'layer';
      layer.style.position = 'absolute';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.width = '100%';
      layer.style.height = '100%';
      scene.appendChild(layer);
    }
  });
}

// Initialize
fetch('elements.json')
  .then(res => res.json())
  .then(data => {
    sceneData = data;
    ensureLayers();
    lastProcedureX = 0;
    generateProcedure(0);   // initial scene
    animate();
  })
  .catch(err => console.error('Could not load elements.json:', err));
