// main.js - dynamic procedural parallax

const layerConfig = [
  { id:'layer1', key:'layer1', countRange:[2,4], factor:0.1,  yFrac:0.10, fontSize:120, minSpacing:150 },
  { id:'layer2', key:'layer2', countRange:[1,1], factor:0.15, yFrac:0.12, fontSize:110, minSpacing:200 },
  { id:'layer3', key:'layer3', countRange:[2,4], factor:0.3,  yFrac:0.50, fontSize:400, minSpacing:300 },
  { id:'layer4', key:'layer4', countRange:[3,5], factor:0.5,  yFrac:0.60, fontSize:300, minSpacing:250 },
  { id:'layer5', key:'layer5', countRange:[3,6], factor:0.6,  yFrac:0.65, fontSize:80,  minSpacing:100 },
  { id:'layer6', key:'layer6', countRange:[2,4], factor:0.65, yFrac:0.70, fontSize:90,  minSpacing:120 },
  { id:'layer7', key:'layer7', countRange:[3,5], factor:0.75, yFrac:0.75, fontSize:60,  minSpacing:80  },
  { id:'layer8', key:'layer8', countRange:[4,8], factor:0.9,  yFrac:0.85, fontSize:30,  minSpacing:40  },
  { id:'layer9', key:'layer9', countRange:[1,2], factor:1.0,  yFrac:0.90, fontSize:20,  minSpacing:100 },
  { id:'layer10', key:'layer10', countRange:[1,2], factor:1.0, yFrac:0.90, fontSize:40,  minSpacing:100 }
];

let offsetX = 0;
let speed = 2;  
let lastProcedureX = 0;
let sceneData = null;

const PROCEDURE_DISTANCE = 6000;   
const PRELOAD_AHEAD = 4500;        
const CLEANUP_BEHIND = 500;       

function getRandom(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

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

// generate procedure with candidate selection and 50% chance per minSpacing
function generateProcedure(startX, width = 500) {
  console.log(`\n--- Generating procedure at ${startX}px ---`);

  layerConfig.forEach(cfg => {
    const arr = sceneData[cfg.key];
    const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
    const layer = document.getElementById(cfg.id);
    if (!layer) return;

    // Step 1: select candidates for this procedure
    const candidateCount = getRandom(...cfg.countRange);
    const candidates = [];
    for (let i = 0; i < candidateCount; i++) {
      candidates.push(arr[getRandom(0, arr.length - 1)]);
    }
    console.log(`Layer: ${cfg.id}, Candidates: ${candidates.join(', ')}`);

    // Step 2: iterate along procedure segment
    for (let x = startX; x <= startX + width; x += cfg.minSpacing) {
      if (Math.random() < 0.5) continue;  // 50% chance to leave empty
      const emoji = candidates[getRandom(0, candidates.length - 1)];
      createEmoji(emoji, cfg.id, x, baselineY, cfg.fontSize);
      console.log(`Placed: Layer: ${cfg.id}, Emoji: ${emoji}, X: ${x}`);
    }
  });
}

// remove elements behind view
function cleanupOldElements() {
  layerConfig.forEach(cfg => {
    const layer = document.getElementById(cfg.id);
    if (!layer) return;
    Array.from(layer.children).forEach(child => {
      if (parseFloat(child.style.left) + cfg.fontSize < offsetX - CLEANUP_BEHIND) {
        layer.removeChild(child);
      }
    });
  });
}

// parallax
function applyParallax() {
  layerConfig.forEach(cfg => {
    const layer = document.getElementById(cfg.id);
    if (!layer) return;
    layer.style.transform = `translateX(${-offsetX * cfg.factor}px)`;
  });
}

// speed boost temporary
let boostTimeout = null;
function boostSpeed(amount, duration = 300) {
  speed = Math.max(1, speed + amount);
  clearTimeout(boostTimeout);
  boostTimeout = setTimeout(() => { speed = 2; }, duration);
}

// randomize main character
function randomizeCharacter() {
  const cfg = layerConfig.find(l => l.id === 'layer10');
  const arr = sceneData[cfg.key];
  const layer = document.getElementById(cfg.id);
  if (!layer) return;
  layer.innerHTML = '';
  const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
  createEmoji(arr[getRandom(0, arr.length - 1)], cfg.id, window.innerWidth/2, baselineY, cfg.fontSize);
}

// animation loop
function animate() {
  offsetX += speed;
  applyParallax();

  if (offsetX - lastProcedureX >= PROCEDURE_DISTANCE) {
    generateProcedure(offsetX + PRELOAD_AHEAD);
    lastProcedureX = offsetX;
    cleanupOldElements();
    randomizeCharacter();
  }

  requestAnimationFrame(animate);
}

// controls
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') boostSpeed(3);
  if (e.key === 'ArrowLeft')  boostSpeed(-1);
});

let xDown = null;
window.addEventListener('touchstart', e => xDown = e.touches[0].clientX, false);
window.addEventListener('touchend', e => {
  if (!xDown) return;
  const xUp = e.changedTouches[0].clientX;
  boostSpeed((xUp < xDown) ? 3 : -1);
  xDown = null;
}, false);

// ensure layers exist
function ensureLayers() {
  const scene = document.querySelector('.scene');
  if (!scene) return console.error('Scene container missing!');
  layerConfig.forEach(cfg => {
    if (!document.getElementById(cfg.id)) {
      const layer = document.createElement('div');
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
    generateProcedure(0);   // initial scene
    randomizeCharacter();
    animate();
  })
  .catch(err => console.error('Could not load elements.json:', err));
