// main.js

// 9-layer config with updated user values:
// - id: HTML layer ID
// - key: JSON key
// - countRange: how many emojis to spawn
// - factor: parallax speed
// - yFrac: vertical baseline as fraction of viewport height
// - fontSize: fixed size in px (back layers larger)
// - minSpacing: minimal gap in px between elements in same layer
const layerConfig = [
  { id:'layer1', key:'layer1', countRange:[2,4], factor:0.1,  yFrac:0.10, fontSize:120, minSpacing: 150 }, // clouds
  { id:'layer2', key:'layer2', countRange:[1,1], factor:0.15, yFrac:0.12, fontSize:110, minSpacing: 200 }, // sun/moon daytime
  { id:'layer3', key:'layer3', countRange:[2,4], factor:0.3,  yFrac:0.50, fontSize:400, minSpacing: 300 }, // mountains and landmarks
  { id:'layer4', key:'layer4', countRange:[3,5], factor:0.5,  yFrac:0.60, fontSize:300, minSpacing: 250 }, // big buildings
  { id:'layer5', key:'layer5', countRange:[3,6], factor:0.6,  yFrac:0.65, fontSize:80,  minSpacing: 100 }, // trees
  { id:'layer6', key:'layer6', countRange:[2,4], factor:0.65, yFrac:0.70, fontSize:90,  minSpacing: 120 }, // houses
  { id:'layer7', key:'layer7', countRange:[3,5], factor:0.75, yFrac:0.75, fontSize:60,  minSpacing: 80  }, // road vehicles and transportation
  { id:'layer8', key:'layer8', countRange:[4,8], factor:0.9,  yFrac:0.85, fontSize:20,  minSpacing: 40  }, // pedestrian, elements and animals
  { id:'layer9', key:'layer9', countRange:[1,2], factor:1.0,  yFrac:0.90, fontSize:40,  minSpacing: 100 },  // plants an small animals
  { id:'layer9', key:'layer10', countRange:[1,2], factor:1.0,  yFrac:0.90, fontSize:40,  minSpacing: 100 }  // main character
];

let offsetX = 0,
    moving = false;

// random integer [min,max]
function getRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// create & place one emoji at (x, baselineY) so bottom aligns at baselineY
function createEmoji(emoji, layerId, x, baselineY, fontSize) {
  const el = document.createElement('span');
  el.textContent = emoji;
  el.style.left     = `${x}px`;
  // position top such that bottom of emoji sits on baselineY
  el.style.top      = `${baselineY - fontSize}px`;
  el.style.fontSize = `${fontSize}px`;
  document.getElementById(layerId).appendChild(el);
}

// once JSON loads, populate all layers
function populateScene(data) {
  layerConfig.forEach(cfg => {
    const arr   = data[cfg.key];
    const count = getRandom(...cfg.countRange);
    const baselineY = Math.floor(window.innerHeight * cfg.yFrac);
    const placedX = [];

    for (let i = 0; i < count; i++) {
      const emoji    = arr[getRandom(0, arr.length - 1)];
      const fontSize = cfg.fontSize;
      const maxX     = window.innerWidth - fontSize;
      let x;
      let attempts = 0;
      do {
        x = getRandom(0, maxX);
        attempts++;
      } while (placedX.some(px => Math.abs(x - px) < cfg.minSpacing) && attempts < 20);
      placedX.push(x);

      createEmoji(emoji, cfg.id, x, baselineY, fontSize);
    }
  });
  applyParallax();
}

// update all layers based on current offset
function applyParallax() {
  layerConfig.forEach(cfg => {
    document.getElementById(cfg.id)
      .style.transform = `translateX(${-offsetX * cfg.factor}px)`;
  });
}

// animate a smooth parallax step
function moveScene(dir) {
  if (moving) return;
  moving = true;
  const step   = dir * 10;
  const frames = 10;
  let frame    = 0;

  (function anim() {
    offsetX += step / frames;
    applyParallax();
    if (++frame < frames) {
      requestAnimationFrame(anim);
    } else {
      moving = false;
    }
  })();
}

// keyboard ↔ control
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') moveScene(1);
  if (e.key === 'ArrowLeft')  moveScene(-1);
});

// touch ↔ control (swipe)
let xDown = null;
window.addEventListener('touchstart', e => { xDown = e.touches[0].clientX; }, false);
window.addEventListener('touchend', e => {
  if (!xDown) return;
  const xUp = e.changedTouches[0].clientX;
  if (Math.abs(xUp - xDown) > 20) moveScene(xUp < xDown ? 1 : -1);
  xDown = null;
}, false);

// fetch elements.json and initialize
fetch('elements.json')
  .then(response => response.json())
  .then(populateScene)
  .catch(err => console.error('Could not load elements.json:', err));
