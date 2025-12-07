// main.js - dynamic procedural parallax v2

const layerConfig = [
  { id:'layer1', key:'layer1', countRange:[2,4], factor:0.1,  yFrac:0.10, fontSize:120, minSpacing:150 },
  { id:'layer2', key:'layer2', countRange:[1,2], factor:0.15, yFrac:0.12, fontSize:110, minSpacing:200 },
  { id:'layer3', key:'layer3', countRange:[2,4], factor:0.3,  yFrac:0.50, fontSize:400, minSpacing:300 },
  { id:'layer4', key:'layer4', countRange:[3,5], factor:0.5,  yFrac:0.60, fontSize:300, minSpacing:250 },
  { id:'layer5', key:'layer5', countRange:[3,6], factor:0.6,  yFrac:0.65, fontSize:80,  minSpacing:100 },
  { id:'layer6', key:'layer6', countRange:[2,4], factor:0.65, yFrac:0.70, fontSize:90,  minSpacing:120 },
  { id:'layer7', key:'layer7', countRange:[3,5], factor:0.75, yFrac:0.75, fontSize:60,  minSpacing:80  },
  { id:'layer8', key:'layer8', countRange:[4,8], factor:0.9,  yFrac:0.85, fontSize:30,  minSpacing:40  },
  { id:'layer9', key:'layer9', countRange:[1,2], factor:1.0,  yFrac:0.90, fontSize:20,  minSpacing:100 },
  { id:'layer10', key:'layer10', countRange:[1,2], factor:1.0, yFrac:0.90, fontSize:40,  minSpacing:100 } // main character
];

let offsetX = 0;
let speed = 2;  // base automatic speed
let lastProcedureX = 0;
let sceneData = null;

// procedural params
const PROCEDURE_DISTANCE = 6000;   // generate new procedure every 6000px
const PRELOAD_AHEAD = 4500;        // generate 1500px before threshold
const CLEANUP_BEHIND = 500;        // remove old elements behind

// utility
function getRandom(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// create & place an element
function createEmoji(emoji, layerId, x, baselineY, fontSize) {
  const layer = document.getElementById(layerId);
  if (!layer) return;
  const el = document.createElement('span');
  el.textContent = emoji;
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top  = `${baselineY - fontSize}px`;
  el.style.fontSize = `${fontSize}px`;
  layer.appendChild(el);
}

// procedural generation - all layers per slot
function generateProcedure(startX) {
  console.log(`\n--- Generating procedure at ${startX}px ---`);

  // Track last placed X per layer to avoid overlap
  const lastPlacedX = {};
  layerConfig.forEach(cfg => lastPlacedX[cfg.id] = startX - cfg.minSpacing);

  // Compute candidates per layer
  const layerCandidates = {};
  layerConfig.forEach(cfg => {
    const arr = sceneData[cfg.key];
    const count = getRandom(...cfg.countRange);
    const candidates = [];
    for (let i = 0; i < count; i++) {
      candidates.push(arr[getRandom(0, arr.length - 1)]);
    }
    layerCandidates[cfg.id] = candidates;
    console.log(`Layer: ${cfg.id}, Candidates: ${candidates.join(', ')}`);
  });

  // Generate elements along X
  const procedureWidth = PROCEDURE_DISTANCE; // full width
  for (let x = startX; x <= startX + procedureWidth; x += 20) { // step 20px
    layerConfig.forEach(cfg => {
      if (Math.random() > 0.5) return; // 50% chance empty

      // ensure minSpacing
      if (x - lastPlacedX[cfg.id] < cfg.minSpacing) return;

      const candidates = layerCandidates[cfg.id];
      const emoji = candidates[getRandom(0, candidates.length - 1)];
      const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
      createEmoji(emoji, cfg.id, x, baselineY, cfg.fontSize);
      lastPlacedX[cfg.id] = x;
      console.log(`Placed: Layer: ${cfg.id}, Emoji: ${emoji}, X: ${x}`);
    });
  }
}

// remove old elements behind view
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

// apply parallax
function applyParallax() {
  layerConfig.forEach(cfg => {
    document.getElementById(cfg.id)
      .style.transform = `translateX(${-offsetX * cfg.factor}px)`;
  });
}

// randomize main character
function randomizeCharacter() {
  const cfg = layerConfig.find(l => l.id === 'layer10');
  const arr = sceneData[cfg.key];
  const layer = document.getElementById(cfg.id);
  layer.innerHTML = '';
  const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
  createEmoji(arr[getRandom(0, arr.length - 1)], cfg.id, window.innerWidth/2, baselineY, cfg.fontSize);
}

// main animation loop
function animate() {
  offsetX += speed;
  applyParallax();

  if (offsetX - lastProcedureX >= PROCEDURE_DISTANCE) {
    generateProcedure(offsetX + PRELOAD_AHEAD); // preload
    lastProcedureX = offsetX;
    cleanupOldElements();
    randomizeCharacter();
  }

  requestAnimationFrame(animate);
}

// arrow key control
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') speed += 1;
  if (e.key === 'ArrowLeft') speed = Math.max(1, speed - 1);
});

// swipe control
let xDown = null;
window.addEventListener('touchstart', e => xDown = e.touches[0].clientX, false);
window.addEventListener('touchend', e => {
  if (!xDown) return;
  const xUp = e.changedTouches[0].clientX;
  speed += (xUp < xDown) ? 1 : -1;
  speed = Math.max(1, speed);
  xDown = null;
}, false);

// ensure all layers exist
function ensureLayers() {
  const scene = document.querySelector('.scene');
  if (!scene) return console.error('Scene container not found!');
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

// initialize
fetch('elements.json')
  .then(res => res.json())
  .then(data => {
    sceneData = data;
    ensureLayers();
    generateProcedure(0); // initial scene
    randomizeCharacter();
    animate();
  })
  .catch(err => console.error('Could not load elements.json:', err));
