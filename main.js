// main.js - Stateless Dynamic Procedural Parallax with Ground Lines and Main Character

const layerConfig = [
  { id:'layer1', key:'layer1', factor:0.1,  yFrac:0.10, fontSize:120, minSpacing:2800 }, 
  { id:'layer2', key:'layer2', factor:0.15, yFrac:0.12, fontSize:110, minSpacing:1600 }, 
  { id:'layer3', key:'layer3', factor:0.3,  yFrac:0.50, fontSize:400, minSpacing:2000 }, 
  { id:'layer4', key:'layer4', factor:0.5,  yFrac:0.60, fontSize:300, minSpacing:1400 }, 
  { id:'layer5', key:'layer5', factor:0.6,  yFrac:0.65, fontSize:80,  minSpacing:100 },
  { id:'layer6', key:'layer6', factor:0.65, yFrac:0.70, fontSize:90,  minSpacing:120 },
  { id:'layer7', key:'layer7', factor:0.75, yFrac:0.75, fontSize:60,  minSpacing:80  },
  { id:'layer8', key:'layer8', factor:0.9,  yFrac:0.85, fontSize:30,  minSpacing:40  },
  { id:'layer9', key:'layer9', factor:1.0,  yFrac:0.90, fontSize:20,  minSpacing:100 },
  { id:'layer10', key:'layer10', factor:1.0, yFrac:0.90, fontSize:40,  minSpacing:100 }
];

let offsetX = 0;
let speed = 2;
const PROCEDURE_DISTANCE = 6000;

let bufferN = {};
let bufferNext = {};
let sceneData = null;
let currentCharacter = null;

// Utility
function getRandom(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

function createEmoji(emoji, layerId, x, baselineY, fontSize){
  const layer = document.getElementById(layerId);
  if(!layer) return;
  const el = document.createElement('span');
  el.textContent = emoji;
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${baselineY - fontSize}px`;
  el.style.fontSize = `${fontSize}px`;
  layer.appendChild(el);
}

function drawGroundLine(layerId, baselineY){
  const layer = document.getElementById(layerId);
  if(!layer) return;
  const line = document.createElement('div');
  line.style.position='absolute';
  line.style.left='0';
  line.style.width='100%';
  line.style.height='2px';
  line.style.backgroundColor='rgba(255,255,255,0.3)';
  line.style.top = `${baselineY}px`;
  layer.appendChild(line);
}

// Stateless buffer generation
function generateBuffer(){
  const buffer = {};
  layerConfig.forEach(cfg=>{
    if(cfg.id==='layer10') return; // skip main character here
    const arr = sceneData[cfg.key];
    if(!arr || arr.length===0) return;

    const shuffled = [...arr].sort(()=>0.5-Math.random());
    const candidateCount = getRandom(1, arr.length);
    const candidates = shuffled.slice(0,candidateCount);

    const slots = Math.floor(PROCEDURE_DISTANCE/cfg.minSpacing);
    let lastPlacedSlot = -1;
    buffer[cfg.key] = [];

    for(let i=0;i<slots;i++){
      if(Math.random()<0.5) continue;
      if(i - lastPlacedSlot < 1) continue;

      const emoji = candidates[getRandom(0,candidates.length-1)];
      buffer[cfg.key].push({slotIndex:i, emoji});
      lastPlacedSlot = i;
    }
  });
  return buffer;
}

function drawBuffer(progress, buffer, offsetXLocal){
  layerConfig.forEach(cfg=>{
    const baselineY = Math.floor(window.innerHeight*cfg.yFrac);
    drawGroundLine(cfg.id, baselineY); // draw ground line

    if(cfg.id==='layer10'){
      // Draw main character always centered
      if(!currentCharacter){
        const arr = sceneData[cfg.key];
        currentCharacter = arr[getRandom(0, arr.length-1)];
      }
      createEmoji(currentCharacter, cfg.id, window.innerWidth/2, baselineY, cfg.fontSize);
      return;
    }

    const arr = buffer[cfg.key];
    if(!arr) return;
    arr.forEach(item=>{
      const x = offsetXLocal + item.slotIndex*cfg.minSpacing - progress*PROCEDURE_DISTANCE;
      if(x + cfg.fontSize <0 || x>window.innerWidth) return;
      createEmoji(item.emoji,cfg.id,x,baselineY,cfg.fontSize);
    });
  });
}

// Clean layers
function clearLayers(){
  layerConfig.forEach(cfg=>{
    const layer = document.getElementById(cfg.id);
    if(layer) layer.innerHTML='';
  });
}

// Animate
function animate(){
  clearLayers();

  const progress = (offsetX % PROCEDURE_DISTANCE)/PROCEDURE_DISTANCE;

  drawBuffer(progress, bufferN, 0);
  drawBuffer(progress, bufferNext, PROCEDURE_DISTANCE);

  offsetX += speed;
  if(offsetX >= PROCEDURE_DISTANCE){
    bufferN = bufferNext;
    bufferNext = generateBuffer();
    offsetX = 0;
    // Randomize main character for next procedure
    const arr = sceneData['layer10'];
    currentCharacter = arr[getRandom(0, arr.length-1)];
  }

  requestAnimationFrame(animate);
}

// Ensure layers exist
function ensureLayers(){
  const scene = document.querySelector('.scene');
  if(!scene) return;
  layerConfig.forEach(cfg=>{
    if(!document.getElementById(cfg.id)){
      const layer = document.createElement('div');
      layer.id = cfg.id;
      layer.className='layer';
      layer.style.position='absolute';
      layer.style.top='0';
      layer.style.left='0';
      layer.style.width='100%';
      layer.style.height='100%';
      scene.appendChild(layer);
    }
  });
}

// Initialize
fetch('elements.json')
  .then(res=>res.json())
  .then(data=>{
    sceneData = data;
    ensureLayers();
    bufferN = generateBuffer();
    bufferNext = generateBuffer();
    animate();
  })
  .catch(err=>console.error('Could not load elements.json:', err));
