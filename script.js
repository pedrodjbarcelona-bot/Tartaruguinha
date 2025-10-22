/* Tartaruguinha — versão com: nome no primeiro acesso, drag&drop de itens, cenário livre e turtle mais realista */

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---------- Estado ---------- */
const state = {
  name: "Tuca",
  coins: 50,
  ageMinutes: 0,
  xp: 0,
  level: 1,
  stats: { hunger: 80, thirst: 80, energy: 70, hygiene: 70, happy: 75, health: 80 },
  inventory: {
    "Folha crocante": { qty: 3 },
    "Fruta do mar":   { qty: 1 },
    "Água fresca":    { qty: 2 },
    "Bola divertida": { qty: 0 },
    "Sabonete":       { qty: 1 },
    "Remédio":        { qty: 0 }
  },
  achievements: [],
  lastTick: Date.now(),
  mute: false,
  quests: [],
  questsDate: null,
  seenNameModal: false,
};

const shopItems = [
  { name:"Folha crocante", icon:"🥬", price:6,  effects:{ hunger:+18 } },
  { name:"Fruta do mar",   icon:"🍓", price:10, effects:{ hunger:+28, happy:+6 } },
  { name:"Água fresca",    icon:"💧", price:5,  effects:{ thirst:+25 } },
  { name:"Bola divertida", icon:"🎾", price:18, effects:{ happy:+20, energy:-5 } },
  { name:"Sabonete",       icon:"🧼", price:12, effects:{ hygiene:+30 } },
  { name:"Remédio",        icon:"💊", price:22, effects:{ health:+30 } },
];

/* ---------- Utils ---------- */
const clamp = (v,min=0,max=100)=>Math.max(min, Math.min(max, v));
const rnd   = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;

function save(silent=true){
  try{
    localStorage.setItem("tartaruguinha_save", JSON.stringify(state));
    if(!silent) flash("Jogo salvo!");
  }catch(e){ console.warn("Falha ao salvar", e); }
}

function load(){
  try{
    const raw = localStorage.getItem("tartaruguinha_save");
    if(!raw) return;
    const s = JSON.parse(raw);
    Object.assign(state, s);
  }catch(e){ console.warn("Falha ao carregar", e); }
  finally{ state.lastTick = Date.now(); }
}

/* ---------- UI ---------- */
function setBar($el, value){
  if(!$el) return;
  $el.value = clamp(value);
  const v = $el.value;
  let lvl = "ok";
  if(v < 30) lvl = "danger"; else if(v < 60) lvl = "warn";
  $el.dataset.level = lvl;
}

function drawHUD(){
  $("#coins").textContent = state.coins;
  $("#xp").textContent = state.xp;
  $("#level").textContent = state.level;
  $("#age").textContent = formatAge(state.ageMinutes);
  $("#petName").textContent = state.name || "—";
  $("#petTitle").textContent = state.name ? `🐢 ${state.name}` : "Tartaruguinha";

  setBar($("#stat-hunger"),  state.stats.hunger);
  setBar($("#stat-thirst"),  state.stats.thirst);
  setBar($("#stat-energy"),  state.stats.energy);
  setBar($("#stat-hygiene"), state.stats.hygiene);
  setBar($("#stat-happy"),   state.stats.happy);
  setBar($("#stat-health"),  state.stats.health);
  drawInventory();
  drawAchievements();
  drawSky();
  drawMood();
}

function drawInventory(){
  const root = $("#inventoryList");
  root.innerHTML = "";
  Object.entries(state.inventory).forEach(([name, obj]) => {
    const shopDef = shopItems.find(i=>i.name===name);
    const icon = shopDef?.icon || "📦";
    const qty = obj?.qty ?? 0;

    const el = document.createElement("div");
    el.className = "item";
    el.setAttribute("role", "button");
    el.setAttribute("title", `Arraste ${name} para a tartaruga`);
    el.innerHTML = `<div style="font-size:1.4rem">${icon}</div><strong>${name}</strong><small>x${qty}</small>`;

    el.draggable = qty>0;
    el.dataset.item = name;
    if(qty<=0) el.classList.add("disabled");

    // drag events
    el.addEventListener("dragstart", (e)=>{
      el.classList.add("dragging");
      e.dataTransfer.setData("text/plain", name);
      e.dataTransfer.effectAllowed = "copy";
    });
    el.addEventListener("dragend", ()=> el.classList.remove("dragging"));

    // clique ainda usa (acessibilidade)
    el.addEventListener("click", ()=>{
      if((state.inventory[name]?.qty||0)>0){
        useItem(name);
      }
    });

    root.appendChild(el);
  });
}

function drawAchievements(){
  const ul = $("#achievements");
  ul.innerHTML = "";
  state.achievements.forEach(a=>{
    const li = document.createElement("li");
    li.textContent = `🏅 ${a}`;
    ul.appendChild(li);
  });
}

function drawShop(){
  const root = $("#shopList");
  root.innerHTML = "";
  shopItems.forEach(item=>{
    const card = document.createElement("div");
    card.className = "item";
    card.innerHTML = `<div style="font-size:1.6rem">${item.icon}</div>
      <strong>${item.name}</strong>
      <small>${formatEffects(item.effects)}</small>
      <button class="primary" type="button">Comprar — ${item.price}💰</button>`;
    const btn = card.querySelector("button");
    btn.disabled = state.coins < item.price;
    btn.onclick = ()=> buy(item);
    root.appendChild(card);
  });
}

/* Céu/Sol/Lua & Relógio */
function drawSky(){
  const clock = $("#clock");
  const minutes = state.ageMinutes % (24*60);
  const h = Math.floor(minutes/60);
  const m = Math.floor(minutes % 60);
  clock.textContent = String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");

  const sun = $("#sun"), moon=$("#moon"), stars=$("#stars");
  const t = (minutes/(24*60)) * 2 * Math.PI;
  const isDay = (h>=6 && h<=18);

  // orbita (em viewport)
  const sunX = 12 + 70*Math.sin(t);
  const sunY = 14 + 18*Math.cos(t);
  sun.style.left = sunX + "vw";
  sun.style.top  = sunY + "vh";
  sun.style.opacity = isDay ? 1 : 0.15;

  const moonX = 88 + 70*Math.sin(t+Math.PI);
  const moonY = 16 + 18*Math.cos(t+Math.PI);
  moon.style.left = moonX + "vw";
  moon.style.top  = moonY + "vh";
  moon.style.opacity = isDay ? 0 : 1;

  stars.style.opacity = isDay ? 0 : 0.45;
}

function drawMood(){
  const {hunger, thirst, energy, hygiene, happy, health} = state.stats;
  const bad = [hunger,thirst,energy,hygiene,health].filter(v=>v<30).length;
  const mouth = $("#mouth");
  const eyeL = $("#eyeL"); const eyeR = $("#eyeR");
  if(mouth){
    if(bad>=2 || happy<30){ mouth.setAttribute("d","M40,84 Q44,78 50,84"); }
    else if(happy>80){ mouth.setAttribute("d","M40,82 Q44,90 50,82"); }
    else{ mouth.setAttribute("d","M40,84 Q44,86 50,84"); }
  }
  // piscadinha
  if(Math.random()<0.02){
    eyeL?.setAttribute("r","1.2"); eyeR?.setAttribute("r","1.2");
    setTimeout(()=>{ eyeL?.setAttribute("r","3.2"); eyeR?.setAttribute("r","3.2"); }, 110);
  }
}

/* ---------- Ações ---------- */
function applyEffects(eff){
  for(const [k,v] of Object.entries(eff)){
    const cur = state.stats[k] ?? 0;
    state.stats[k] = clamp(cur + v);
  }
}

function addXP(val){
  state.xp += val;
  while(state.xp >= needXP()){
    state.xp -= needXP();
    state.level++;
    flash("↑ Subiu para o nível "+state.level+"!");
    earn(10*state.level);
  }
}
function needXP(){ return 25 + state.level*10; }
function earn(n){ state.coins += n; $("#coins").textContent = state.coins; }

function flash(text){
  $("#message").textContent = text;
  const em = $("#emote");
  em.style.opacity = 1; em.textContent = pickEmote(text);
  setTimeout(()=> em.style.opacity = 0, 800);
}
function pickEmote(t){
  if(/salv/i.test(t)) return "";
  if(/nivel|nível|subiu/i.test(t)) return "✨";
  if(/comprou|ganhou/i.test(t)) return "💰";
  if(/dorm|descans/i.test(t)) return "😴";
  if(/usou|aliment|água|banho|curou/i.test(t)) return "🍃";
  return "💚";
}
function log(text){
  const p = document.createElement("p");
  const time = new Date().toLocaleTimeString();
  p.innerHTML = `<small style="color:#64748b">${time}</small> — ${text}`;
  $("#log").prepend(p);
}

/* useItem — atualiza missões + DnD usa essa função */
let useItem = function(name){
  const def = shopItems.find(i=>i.name===name);
  const inv = state.inventory[name];
  if(!def || !inv || inv.qty<=0) { flash("Você não tem esse item."); return; }
  inv.qty--;
  applyEffects(def.effects);
  addXP(2);
  flash(`Usou ${def.icon} ${name}!`);
  log(`Usou ${name}.`);
  // progresso de missões
  if(state.quests){
    if(name==="Folha crocante" || name==="Fruta do mar"){
      const q = state.quests.find(x=>x.id==="eat3"); if(q) q.progress = Math.min(q.need, q.progress+1);
    }
    if(name==="Sabonete"){
      const q = state.quests.find(x=>x.id==="wash2"); if(q) q.progress = Math.min(q.need, q.progress+1);
    }
  }
  maybeAchievement();
  drawHUD(); save();
};

function buy(item){
  if(state.coins<item.price) return flash("Moedas insuficientes.");
  state.coins -= item.price;
  state.inventory[item.name] = state.inventory[item.name] || {qty:0};
  state.inventory[item.name].qty++;
  flash(`Comprou ${item.icon} ${item.name}.`);
  log(`Comprou ${item.name} por ${item.price}💰.`);
  drawHUD(); save();
}

function act(action){
  switch(action){
    case "play":
      if((state.inventory["Bola divertida"]?.qty||0)>0){ useItem("Bola divertida"); }
      else { applyEffects({ happy:+10, energy:-5 }); flash("Brincou!"); addXP(3); }
      break;
    case "sleep":
      disableActions(true, /*keepHeal*/ true);
      flash("Dormindo…");
      let steps=0;
      const nap = setInterval(()=>{
        steps++; applyEffects({ energy:+8, health:+2, hunger:-3, thirst:-3 });
        if(steps>=10){ clearInterval(nap); flash("Acordou descansada!"); disableActions(false); addXP(4); }
        drawHUD();
      }, 600);
      break;
  }
  drawHUD(); save();
}

function disableActions(flag, keepHeal=false){
  $$(".actions button").forEach(b=>{
    const act = b.dataset.action;
    if(keepHeal && act==="heal") return;
    if(act){ b.disabled = flag; }
  });
}

/* ---------- Loop do jogo ---------- */
function tick(){
  const now = Date.now();
  const dt = Math.min((now - state.lastTick)/1000, 1.2);
  state.lastTick = now;

  // 1 segundo real = 2 minutos de jogo
  const gameMinutes = dt * 2;
  state.ageMinutes += gameMinutes;

  // decaimento
  const decay = gameMinutes * 0.06;
  state.stats.hunger = clamp(state.stats.hunger - decay);
  state.stats.thirst = clamp(state.stats.thirst - decay*1.10);
  state.stats.energy = clamp(state.stats.energy - decay*0.70);
  state.stats.hygiene = clamp(state.stats.hygiene - decay*0.50);
  state.stats.happy  = clamp(state.stats.happy  - decay*0.40);

  // saúde depende dos outros
  const bads = ["hunger","thirst","energy","hygiene","happy"].reduce((n,k)=> n + (state.stats[k]<25?1:0), 0);
  const dHealthPerMin = (bads===0? +0.20 : -bads*0.15);
  state.stats.health = clamp(state.stats.health + dHealthPerMin*gameMinutes);

  // eventos aleatórios
  if(Math.random()<0.003*dt){ randomEvent(); }

  // Doente? manter "Remédio" usável via DnD (não há botão heal)
  if(state.stats.health<=1){
    flash("😢 Sua tartaruguinha ficou muito doente… arraste 💊 Remédio até ela!");
  }

  drawHUD();
}

/* ---------- Eventos ---------- */
function randomEvent(){
  const events = [
    { text:"Encontrou uma moeda brilhante!", effect:()=> earn(3) },
    { text:"Fez amizade com um peixinho. +felicidade", effect:()=> applyEffects({happy:+6}) },
    { text:"Comeu demais e ficou com sede!", effect:()=> applyEffects({thirst:-8, hunger:+6}) },
    { text:"Tomou chuva — ficou limpinha!", effect:()=> applyEffects({hygiene:+10}) },
  ];
  const e = events[rnd(0,events.length-1)];
  e.effect(); flash("Evento: "+e.text); log(e.text);
  maybeAchievement();
}

function maybeAchievement(){
  const add = name => {
    if(!state.achievements.includes(name)){
      state.achievements.push(name); log("Conquista desbloqueada: "+name); flash("Conquista: "+name);
    }
  };
  const s = state.stats;
  if(s.happy>=95) add("Felicidade máxima");
  if(s.health>=95) add("Coração forte");
  if(state.coins>=200) add("Cofrinho recheado");
  if(Object.values(state.inventory).every(i=> (i?.qty||0) >= 1)) add("Colecionadora");
}

/* ---------- Formatação ---------- */
function formatEffects(eff){
  return Object.entries(eff).map(([k,v])=>{
    const sign = v>0?"+":"";
    const label = ({hunger:"fome",thirst:"sede",energy:"energia",hygiene:"higiene",happy:"felicidade",health:"saúde"})[k]||k;
    return `${label} ${sign}${v}`;
  }).join(", ");
}
function formatAge(mins){
  const d = Math.floor(mins/1440);
  const h = Math.floor((mins%1440)/60);
  return `${d}d ${h}h`;
}

/* ---------- Mini-jogo ---------- */
let mgTimer = null;
function startMiniggameInternal(){
  const arena = $("#minigameArena");
  arena.innerHTML = "";
  $("#mgScore").textContent = "0";
  $("#mgTime").textContent = "30";
  let score = 0, time=30;
  clearInterval(mgTimer);
  mgTimer = setInterval(()=>{
    time--; $("#mgTime").textContent = String(time);
    spawnBug();
    if(time<=0){ clearInterval(mgTimer); endMG(); }
  }, 1000);

  function spawnBug(){
    const b = document.createElement("div");
    b.className="bug";
    const w = Math.max(arena.clientWidth-40, 40);
    const h = Math.max(arena.clientHeight-40, 40);
    b.style.left = rnd(0, w)+"px";
    b.style.top  = rnd(0, h)+"px";
    b.textContent = "🐞";
    b.onclick = ()=>{
      score++; $("#mgScore").textContent = String(score);
      b.remove();
      earn(1); applyEffects({happy:+1}); addXP(1);
    };
    arena.appendChild(b);
    setTimeout(()=>{ b.remove(); }, 1200);
  }

  function endMG(){
    arena.querySelectorAll(".bug").forEach(el=>el.remove());
    flash(`Mini-jogo acabou! Pontos: ${score}`);
    log(`Mini-jogo: ${score} pontos`);
    earn(Math.floor(score/2));
    applyEffects({energy:-10});
    addXP(5);
    maybeAchievement();
    drawHUD(); save();
  }
}
const startMinigame = ()=> startMiniggameInternal();

/* ---------- Missões ---------- */
function generateQuests(){
  const q = [
    { id:"eat3",   text:"Usar 3 comidas hoje", type:"use", item:"Folha crocante", need:3, reward:{xp:15, coins:15} },
    { id:"wash2",  text:"Dar 2 banhos", type:"use", item:"Sabonete", need:2, reward:{xp:10, coins:10} },
    { id:"play10", text:"Fazer carinho 10x", type:"pet", need:10, reward:{xp:12, coins:12} },
  ];
  const today = new Date().toDateString();
  if(!state.quests || state.questsDate !== today){
    state.quests = q.map(o=>({...o, progress:0, done:false}));
    state.questsDate = today;
  }
}
function drawQuests(){
  const list = $("#questsList");
  list.innerHTML = "";
  state.quests.forEach(q=>{
    const div = document.createElement("div");
    const pct = Math.floor(100* q.progress / q.need);
    div.className="quest";
    div.innerHTML = `<div>
      <strong>${q.text}</strong>
      <small>${q.progress}/${q.need}</small>
    </div>
    <div><progress max="100" value="${pct}"></progress></div>
    <button ${q.done?"disabled":""}>Resgatar</button>`;
    const btn = div.querySelector("button");
    btn.onclick = ()=>{
      if(!q.done && q.progress>=q.need){
        addXP(q.reward.xp); earn(q.reward.coins); q.done=true; flash("Recompensa coletada!");
        drawQuests(); drawHUD(); save();
      }
    };
    list.appendChild(div);
  });
}

/* ---------- Interações ---------- */
// Carinho
$("#turtle")?.addEventListener("click", ()=>{
  applyEffects({happy:+1}); addXP(1);
  flash("Carinho 🐢💚");
  if(state.quests){
    const q = state.quests.find(x=>x.id==="play10"); if(q){ q.progress = Math.min(q.need, q.progress+1); }
  }
  drawHUD(); save();
});

// Drag & Drop alvo
const turtle = $("#turtle");
if(turtle){
  turtle.addEventListener("dragover", (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect="copy"; turtle.classList.add("drag-over"); });
  turtle.addEventListener("dragleave", ()=> turtle.classList.remove("drag-over"));
  turtle.addEventListener("drop", (e)=>{
    e.preventDefault();
    turtle.classList.remove("drag-over");
    const name = e.dataTransfer.getData("text/plain");
    if(name && (state.inventory[name]?.qty||0)>0){
      useItem(name);
    }else{
      flash("Esse item não está disponível.");
    }
  });
}

// Botões
$$(".actions button[data-action]").forEach(btn=>{
  btn.addEventListener("click", ()=> act(btn.dataset.action));
});
$("#minigameBtn")?.addEventListener("click", ()=> $("#minigameModal").showModal());
$("#shopBtn")?.addEventListener("click", ()=>{ drawShop(); $("#shopModal").showModal(); });
$("#questBtn")?.addEventListener("click", ()=>{ drawQuests(); $("#questsModal").showModal(); });

$("#startMinigame")?.addEventListener("click", (e)=>{ e.preventDefault(); startMinigame(); });

$("#saveBtn")?.addEventListener("click", ()=> save(false));
$("#muteBtn")?.addEventListener("click", ()=>{ state.mute = !state.mute; $("#muteBtn").textContent = state.mute? "🔇" : "🔈"; });

/* ---------- Inicialização & Primeiro Acesso ---------- */
function ensureNameFlow(){
  if(!state.seenNameModal || !state.name){
    const nameModal = $("#nameModal");
    const input = $("#nameInput");
    const confirm = $("#confirmNameBtn");
    nameModal?.showModal();
    confirm?.addEventListener("click", (e)=>{
      e.preventDefault();
      const val = (input?.value || "").trim();
      if(!val){ input?.focus(); return; }
      state.name = val.slice(0,16);
      state.seenNameModal = true;
      save();
      nameModal?.close();
      drawHUD();
      log(`Nome escolhido: ${state.name}`);
      flash(`Olá, ${state.name}!`);
    }, { once:true });
  }
}

function init(){
  load();
  generateQuests();
  drawHUD();
  // Primeiro acesso: pedir nome se não tiver save
  ensureNameFlow();

  // Tick + auto-save
  setInterval(tick, 1000);
  setInterval(()=> save(true), 30000);
  log("Bem-vinda ao Tartaruguinha!");
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) state.lastTick = Date.now(); });
}
document.addEventListener("DOMContentLoaded", init);
