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
let speed = 2;  // base automatic movement speed in px/frame
let lastProcedureX = 0;
let sceneData = null;

// utility
function getRandom(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// create & place one element
function createEmoji(emoji, layerId, x, baselineY, fontSize) {
  const el = document.createElement('span');
  el.textContent = emoji;
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top  = `${baselineY - fontSize}px`;
  el.style.fontSize = `${fontSize}px`;
  document.getElementById(layerId).appendChild(el);
}

// generate a procedure starting at offsetX
function generateProcedure(startX) {
  layerConfig.forEach(cfg => {
    const arr = sceneData[cfg.key];
    const count = getRandom(...cfg.countRange);
    const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
    const placedX = [];

    for (let i = 0; i < count; i++) {
      const emoji = arr[getRandom(0, arr.length - 1)];
      const fontSize = cfg.fontSize;
      let x;
      let attempts = 0;
      do {
        x = getRandom(startX, startX + 500);  // procedural segment width
        attempts++;
      } while (placedX.some(px => Math.abs(x - px) < cfg.minSpacing) && attempts < 20);
      placedX.push(x);

      createEmoji(emoji, cfg.id, x, baselineY, fontSize);
    }
  });
}

// remove old elements behind view
function cleanupOldElements() {
  layerConfig.forEach(cfg => {
    const layer = document.getElementById(cfg.id);
    Array.from(layer.children).forEach(child => {
      if (parseFloat(child.style.left) + cfg.fontSize < offsetX - 500) {
        layer.removeChild(child);
      }
    });
  });
}

// update layer positions based on offsetX
function applyParallax() {
  layerConfig.forEach(cfg => {
    document.getElementById(cfg.id)
      .style.transform = `translateX(${-offsetX * cfg.factor}px)`;
  });
}

// main animation loop
function animate() {
  offsetX += speed;
  applyParallax();

  // generate new procedure every 2000px
  if (offsetX - lastProcedureX >= 2000) {
    generateProcedure(offsetX + 1500); // preload at 1500px before threshold
    lastProcedureX = offsetX;
    cleanupOldElements();
    randomizeCharacter();
  }

  requestAnimationFrame(animate);
}

// speed boost on arrow keys
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') speed += 1;
  if (e.key === 'ArrowLeft') speed = Math.max(1, speed - 1);
});

// optional swipe support
let xDown = null;
window.addEventListener('touchstart', e => xDown = e.touches[0].clientX, false);
window.addEventListener('touchend', e => {
  if (!xDown) return;
  const xUp = e.changedTouches[0].clientX;
  speed += (xUp < xDown) ? 1 : -1;
  speed = Math.max(1, speed);
  xDown = null;
}, false);

// change character after procedure
function randomizeCharacter() {
  const cfg = layerConfig.find(l => l.id === 'layer10');
  const arr = sceneData[cfg.key];
  const layer = document.getElementById(cfg.id);
  layer.innerHTML = '';  // remove old character
  const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
  createEmoji(arr[getRandom(0, arr.length - 1)], cfg.id, window.innerWidth/2, baselineY, cfg.fontSize);
}

// initialize
fetch('elements.json')
  .then(res => res.json())
  .then(data => {
    sceneData = data;
    generateProcedure(0);           // initial scene
    randomizeCharacter();
    animate();
  })
  .catch(err => console.error('Could not load elements.json:', err));
