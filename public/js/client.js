const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const inputHandler = new InputHandler(canvas);

let myId = null;
let gameState = { players: {}, resources: [], structures: [], leaderboard: [] };
let prevState = null;
let lastStateTime = 0;
let MAP_SIZE = 4000;
let isPlaying = false;
let floatingTexts = [];
let particles = [];
let cameraZoom = 0.85;
let targetZoom = 0.85;

// --- Sploop.io Şapka Verileri ---
const HATS = [
    { id: 'none', name: 'Yok', price: 0, icon: '🚫', color: 'transparent' },
    { id: 'bush', name: 'Bush Hat', price: 300, icon: '🌿', color: '#2e7d32' },
    { id: 'bumber', name: 'Bumber Hat', price: 500, icon: '🪖', color: '#558b2f' },
    { id: 'bull', name: 'Bull Helmet', price: 1500, icon: '🐂', color: '#3e2723' },
    { id: 'boost', name: 'Boost Hat', price: 2000, icon: '⚡', color: '#fbc02d' },
    { id: 'winter', name: 'Winter Cap', price: 1000, icon: '❄️', color: '#0288d1' }
];

// --- Sploop.io Age Seçenekleri ---
const AGE_UPGRADES = {
    2: [
        { id: 'sword', name: 'Great Sword', icon: '⚔️', desc: 'Yüksek Hasar' },
        { id: 'spear', name: 'Spear', icon: '🗡️', desc: 'Uzun Menzil' }
    ],
    3: [
        { id: 'cookie', name: 'Cookie', icon: '🍪', desc: '+40 Can' },
        { id: 'boostPad', name: 'Boost Pad', icon: '💨', desc: 'Hızlandırıcı' }
    ],
    4: [
        { id: 'greaterSpike', name: 'Spinning Spike', icon: '⚙️', desc: 'Dönen Diken' },
        { id: 'poisonSpike', name: 'Poison Spike', icon: '☣️', desc: 'Zehir Diken' }
    ],
    5: [
        { id: 'windmill', name: 'Fast Windmill', icon: '🌀', desc: 'Hızlı Altın' },
        { id: 'trap', name: 'Pitfall Trap', icon: '🕳️', desc: 'Tuzak' }
    ]
};

let selectedHat = 'none';
let lastAgePrompted = 1;
let currentClan = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Özel Sploop Arayüzü (UI) ---
function setupSploopUI() {
    if (document.getElementById('sploop-top-bar')) return;

    const topBar = document.createElement('div');
    topBar.id = 'sploop-top-bar';
    topBar.style.cssText = `
        position: absolute; top: 15px; left: 15px; z-index: 1000;
        display: flex; gap: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Shop Button
    const shopBtn = document.createElement('button');
    shopBtn.innerHTML = '🛒 MAĞAZA';
    shopBtn.style.cssText = `
        background: #fbc02d; border: 3px solid #141414; border-radius: 10px;
        color: #141414; font-weight: 900; font-size: 14px; padding: 10px 18px; cursor: pointer;
        box-shadow: 0 4px 0 #c79100, 0 5px 10px rgba(0,0,0,0.3); transition: transform 0.1s;
    `;

    // Clan Button
    const clanBtn = document.createElement('button');
    clanBtn.innerHTML = '🛡️ KLAN';
    clanBtn.style.cssText = `
        background: #29b6f6; border: 3px solid #141414; border-radius: 10px;
        color: #ffffff; font-weight: 900; font-size: 14px; padding: 10px 18px; cursor: pointer;
        box-shadow: 0 4px 0 #0288d1, 0 5px 10px rgba(0,0,0,0.3); transition: transform 0.1s;
    `;

    topBar.appendChild(shopBtn);
    topBar.appendChild(clanBtn);
    document.body.appendChild(topBar);

    // Shop Menu Panel
    const shopMenu = document.createElement('div');
    shopMenu.id = 'sploop-shop-menu';
    shopMenu.style.cssText = `
        position: absolute; top: 70px; left: 15px; z-index: 1000;
        background: rgba(18, 18, 20, 0.95); border: 3px solid #fbc02d; border-radius: 14px;
        padding: 14px; display: none; flex-direction: column; gap: 10px; backdrop-filter: blur(8px);
        width: 280px; max-height: 400px; overflow-y: auto; color: white;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(shopMenu);

    // Clan Menu Panel (Pop-up uyarısı yerine özel modal)
    const clanMenu = document.createElement('div');
    clanMenu.id = 'sploop-clan-menu';
    clanMenu.style.cssText = `
        position: absolute; top: 70px; left: 15px; z-index: 1000;
        background: rgba(18, 18, 20, 0.95); border: 3px solid #29b6f6; border-radius: 14px;
        padding: 16px; display: none; flex-direction: column; gap: 12px; backdrop-filter: blur(8px);
        width: 300px; color: white; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(clanMenu);

    shopBtn.onclick = () => {
        clanMenu.style.display = 'none';
        shopMenu.style.display = shopMenu.style.display === 'flex' ? 'none' : 'flex';
        renderShopItems(shopMenu);
    };

    clanBtn.onclick = () => {
        shopMenu.style.display = 'none';
        clanMenu.style.display = clanMenu.style.display === 'flex' ? 'none' : 'flex';
        renderClanMenu(clanMenu);
    };
}

function renderShopItems(container) {
    container.innerHTML = '<div style="font-weight:900; font-size:16px; text-align:center; color:#fbc02d; margin-bottom:4px; text-transform:uppercase;">Şapka Mağazası</div>';
    HATS.forEach(hat => {
        let item = document.createElement('div');
        item.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            background: #252529; padding: 8px 12px; border-radius: 10px;
            border: ${selectedHat === hat.id ? '2px solid #66bb6a' : '1px solid #3f3f46'};
        `;
        item.innerHTML = `
            <span style="font-size:24px">${hat.icon}</span>
            <div style="flex-grow:1; margin-left:10px;">
                <div style="font-weight:bold; font-size:13px; color:#fff;">${hat.name}</div>
                <div style="font-size:11px; color:#fbc02d; font-weight:600;">${hat.price} Altın</div>
            </div>
            <button style="background:${selectedHat === hat.id ? '#66bb6a' : '#fbc02d'}; border:none; border-radius:6px; padding:6px 12px; font-weight:bold; cursor:pointer; font-size:11px; color:#141414;">
                ${selectedHat === hat.id ? 'TAKILDI' : 'AL'}
            </button>
        `;
        item.querySelector('button').onclick = () => {
            selectedHat = hat.id;
            socket.emit('equipHat', { hatId: hat.id });
            renderShopItems(container);
        };
        container.appendChild(item);
    });
}

function renderClanMenu(container) {
    container.innerHTML = `
        <div style="font-weight:900; font-size:16px; text-align:center; color:#29b6f6; text-transform:uppercase;">Klan Yönetimi</div>
        ${currentClan ? `
            <div style="background:#252529; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:14px; font-weight:bold; color:#66bb6a;">Klanın: ${currentClan}</div>
                <button id="leave-clan-btn" style="margin-top:8px; background:#ef5350; border:none; border-radius:6px; color:white; padding:6px 12px; font-weight:bold; cursor:pointer; width:100%;">Klandan Ayrıl</button>
            </div>
        ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <input id="clan-name-input" type="text" placeholder="Klan Adı Gir..." style="background:#18181b; border:1px solid #3f3f46; border-radius:8px; padding:8px; color:white; font-size:13px; outline:none;" />
                <button id="create-clan-btn" style="background:#29b6f6; border:none; border-radius:8px; padding:8px; color:white; font-weight:bold; cursor:pointer;">Klan Oluştur</button>
            </div>
            <div style="border-top:1px solid #3f3f46; margin-top:4px; padding-top:8px; font-size:12px; color:#aaa; text-align:center;">Henüz bir klana üye değilsin.</div>
        `}
    `;

    const createBtn = document.getElementById('create-clan-btn');
    if (createBtn) {
        createBtn.onclick = () => {
            const input = document.getElementById('clan-name-input');
            if (input && input.value.trim() !== '') {
                currentClan = input.value.trim();
                socket.emit('createClan', { name: currentClan });
                renderClanMenu(container);
            }
        };
    }

    const leaveBtn = document.getElementById('leave-clan-btn');
    if (leaveBtn) {
        leaveBtn.onclick = () => {
            currentClan = null;
            socket.emit('leaveClan');
            renderClanMenu(container);
        };
    }
}

function checkAgeUpgrade(currentAge) {
    if (currentAge > lastAgePrompted && AGE_UPGRADES[currentAge]) {
        lastAgePrompted = currentAge;
        showAgeSelectionMenu(currentAge);
    }
}

function showAgeSelectionMenu(age) {
    let menu = document.getElementById('age-upgrade-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'age-upgrade-menu';
        menu.style.cssText = `
            position: absolute; top: 10%; left: 50%; transform: translateX(-50%);
            display: flex; gap: 16px; z-index: 1001; background: rgba(18, 18, 20, 0.9);
            padding: 16px 24px; border-radius: 16px; backdrop-filter: blur(10px);
            border: 3px solid #fbc02d; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        `;
        document.body.appendChild(menu);
    }

    menu.innerHTML = '';
    const items = AGE_UPGRADES[age];

    items.forEach(item => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: #252529; color: white; border: 2px solid #fbc02d;
            border-radius: 12px; padding: 14px 22px; text-align: center;
            cursor: pointer; user-select: none; transition: transform 0.15s, background 0.15s;
            min-width: 110px;
        `;
        card.innerHTML = `
            <div style="font-size:38px">${item.icon}</div>
            <div style="font-weight:bold; margin-top:6px; font-size:14px; color:#fff;">${item.name}</div>
            <div style="font-size:11px; color:#aaa; margin-top:2px;">${item.desc}</div>
        `;
        card.onmouseover = () => { card.style.transform = 'scale(1.05)'; card.style.background = '#323238'; };
        card.onmouseout = () => { card.style.transform = 'scale(1)'; card.style.background = '#252529'; };
        
        card.onclick = () => {
            socket.emit('selectUpgrade', { item: item.id, age });
            menu.style.display = 'none';
        };
        menu.appendChild(card);
    });

    menu.style.display = 'flex';
}

document.getElementById('play-btn').addEventListener('click', () => {
    const name = document.getElementById('nickname-input').value;
    socket.emit('joinGame', { name });
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    isPlaying = true;
    setupSploopUI();
});

inputHandler.onAttack = () => { if (isPlaying) socket.emit('attackAction'); };
inputHandler.onQuickHeal = () => { if (isPlaying) socket.emit('quickHeal'); };

socket.on('init', (data) => {
    myId = data.id;
    MAP_SIZE = data.mapSize;
    requestAnimationFrame(renderLoop);
});

socket.on('damage', (data) => {
    floatingTexts.push({ x: data.x, y: data.y, text: '-' + data.amount, life: 1, color: '#ff5252' });
    spawnParticles(data.x, data.y, '#ff5252', 6);
});

socket.on('resourceGain', (data) => {
    floatingTexts.push({ x: data.x, y: data.y, text: '+' + data.amount, life: 1, color: '#ffd54f' });
});

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 1, color });
    }
}

socket.on('gameState', (state) => {
    prevState = gameState;
    gameState = state;
    lastStateTime = performance.now();

    if (isPlaying) {
        socket.emit('playerInput', {
            inputs: inputHandler.inputs,
            angle: inputHandler.angle,
            selectedSlot: inputHandler.selectedSlot
        });

        const me = gameState.players[myId];
        if (me) {
            document.getElementById('res-food').innerText = me.resources.food;
            document.getElementById('res-wood').innerText = me.resources.wood;
            document.getElementById('res-stone').innerText = me.resources.stone;
            document.getElementById('res-gold').innerText = me.resources.gold;
            document.getElementById('age-num').innerText = me.age;
            document.getElementById('xp-bar-fill').style.width = me.xp + '%';

            checkAgeUpgrade(me.age);

            const minimapPlayer = document.getElementById('minimap-player');
            if (minimapPlayer) {
                minimapPlayer.style.left = (me.x / MAP_SIZE * 100) + '%';
                minimapPlayer.style.top = (me.y / MAP_SIZE * 100) + '%';
            }

            const speed = Math.hypot(me.vx || 0, me.vy || 0);
            targetZoom = speed > 3 ? 0.78 : 0.85;
        }

        const lbList = document.getElementById('leaderboard-list');
        if (lbList && gameState.leaderboard) {
            lbList.innerHTML = '';
            gameState.leaderboard.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${item.name}</span> <span>${item.score}</span>`;
                lbList.appendChild(li);
            });
        }
    }
});

function getInterpolatedPlayers(t) {
    if (!prevState) return gameState.players;
    const result = {};
    for (const id in gameState.players) {
        const cur = gameState.players[id];
        const prev = prevState.players[id];
        if (prev && cur.spawned && prev.spawned) {
            result[id] = {
                ...cur,
                x: prev.x + (cur.x - prev.x) * t,
                y: prev.y + (cur.y - prev.y) * t,
                angle: cur.angle
            };
        } else {
            result[id] = cur;
        }
    }
    return result;
}

function drawGrid(scale, me) {
    const gridSize = 60 * scale;
    const offsetX = (canvas.width / 2 - me.x * scale) % gridSize;
    const offsetY = (canvas.height / 2 - me.y * scale) % gridSize;

    ctx.fillStyle = '#7cb342';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 2;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function isOnScreen(x, y, radius, me, scale) {
    const margin = radius * scale + 50;
    const sx = canvas.width / 2 + (x - me.x) * scale;
    const sy = canvas.height / 2 + (y - me.y) * scale;
    return sx > -margin && sx < canvas.width + margin && sy > -margin && sy < canvas.height + margin;
}

// Birebir Sploop Silah Çizimleri
function drawWeapon(type, isAttacking) {
    ctx.save();
    let offset = isAttacking ? 12 : 0;
    ctx.translate(22 + offset, 16);

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#1e1e1e';

    if (type === 'sword') {
        // Kılıç Bıçağı
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(8, -5); ctx.lineTo(44, -3); ctx.lineTo(52, 0); ctx.lineTo(44, 3); ctx.lineTo(8, 5);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // Kabza
        ctx.fillStyle = '#fbc02d';
        ctx.fillRect(4, -8, 5, 16); ctx.strokeRect(4, -8, 5, 16);
        ctx.fillStyle = '#424242';
        ctx.fillRect(-6, -3, 10, 6); ctx.strokeRect(-6, -3, 10, 6);
    } else if (type === 'spear') {
        // Mızrak Sapı
        ctx.fillStyle = '#795548';
        ctx.fillRect(-10, -3, 50, 6); ctx.strokeRect(-10, -3, 50, 6);

        // Mızrak Ucu
        ctx.fillStyle = '#b0bec5';
        ctx.beginPath();
        ctx.moveTo(40, -7); ctx.lineTo(62, 0); ctx.lineTo(40, 7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
        // Standart Kazma
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-4, -3, 32, 6); ctx.strokeRect(-4, -3, 32, 6);
        ctx.fillStyle = '#78909c';
        ctx.beginPath();
        ctx.arc(28, 0, 14, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(24, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // El Çizimi
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(3, 5, p.radius, 0, Math.PI * 2); ctx.fill();

    // Oyuncu İsmi & Klan
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(p.name, 0, -p.radius - 22);
    ctx.shadowBlur = 0;

    // Can Barı
    const barW = 46;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW / 2, -p.radius - 14, barW, 6);
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    const hpColor = hpRatio > 0.5 ? '#66bb6a' : hpRatio > 0.25 ? '#ffa726' : '#ef5350';
    ctx.fillStyle = hpColor;
    ctx.fillRect(-barW / 2, -p.radius - 14, barW * hpRatio, 6);

    ctx.rotate(p.angle);

    // Sol El
    ctx.fillStyle = '#e0a96d';
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(22, -16, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Sağ El ve Silah
    const weaponType = (p.selectedSlot === 1 || p.weapon === 'sword') ? 'sword' : (p.weapon === 'spear' ? 'spear' : 'pickaxe');
    drawWeapon(weaponType, p.isAttacking);

    // Gövde
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#1e1e1e'; ctx.stroke();

    // Şapka
    if (p.hatId && p.hatId !== 'none') {
        const hat = HATS.find(h => h.id === p.hatId);
        if (hat && hat.color !== 'transparent') {
            ctx.fillStyle = hat.color;
            ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.75, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = '#1e1e1e'; ctx.stroke();
        }
    }

    ctx.restore();
}

let millAngle = 0;
function drawStructures(structures, me, scale) {
    millAngle += 0.03;
    structures.forEach(st => {
        if (!isOnScreen(st.x, st.y, st.radius, me, scale)) return;
        ctx.save();
        ctx.translate(st.x, st.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath(); ctx.arc(3, 4, st.radius, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4; ctx.strokeStyle = '#1e1e1e';

        if (st.type === 'wall') {
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.strokeRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
        } else if (st.type === 'spike') {
            ctx.fillStyle = '#78909c';
            ctx.beginPath(); ctx.arc(0, 0, st.radius - 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            for (let i = 0; i < 8; i++) {
                let ang = (i * Math.PI) / 4;
                ctx.save();
                ctx.rotate(ang);
                ctx.fillStyle = '#b0bec5';
                ctx.beginPath(); ctx.moveTo(st.radius - 6, -6); ctx.lineTo(st.radius + 10, 0); ctx.lineTo(st.radius - 6, 6);
                ctx.fill(); ctx.stroke();
                ctx.restore();
            }
        } else if (st.type === 'trap') {
            ctx.fillStyle = '#37474f';
            ctx.fillRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.strokeRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.fillStyle = '#cfd8dc';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (st.type === 'windmill') {
            ctx.fillStyle = '#d7ccc8';
            ctx.beginPath(); ctx.arc(0, 0, st.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.save();
            ctx.rotate(millAngle);
            ctx.fillStyle = '#4e342e';
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.fillRect(-4, 0, 8, st.radius + 12);
                ctx.strokeRect(-4, 0, 8, st.radius + 12);
            }
            ctx.restore();
        }

        ctx.restore();
    });
}

function drawResources(resources, me, scale) {
    resources.forEach(res => {
        if (!isOnScreen(res.x, res.y, res.radius, me, scale)) return;
        ctx.save();
        ctx.translate(res.x, res.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath(); ctx.arc(4, 5, res.radius, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4.5; ctx.strokeStyle = '#1e1e1e';

        if (res.type === 'bush') {
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.arc(-10, -8, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 6, 6, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'tree') {
            ctx.fillStyle = '#388e3c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath(); ctx.arc(0, 0, res.radius * 0.65, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'stone') {
            ctx.fillStyle = '#78909c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (res.type === 'gold') {
            ctx.fillStyle = '#fbc02d';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }

        ctx.restore();
    });
}

function updateAndDrawParticles(dt) {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.94; p.vy *= 0.94;
        p.life -= dt * 2;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    });
}

function updateAndDrawFloatingTexts(dt) {
    floatingTexts = floatingTexts.filter(f => f.life > 0);
    floatingTexts.forEach(f => {
        f.y -= 40 * dt;
        f.life -= dt;
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.color;
        ctx.font = '900 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
    });
}

let lastFrameTime = performance.now();

function renderLoop(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    const t = Math.min(1, (now - lastStateTime) / 100);
    const players = getInterpolatedPlayers(t);

    cameraZoom += (targetZoom - cameraZoom) * 0.05;

    const me = players[myId];
    if (me) {
        const scale = cameraZoom;
        drawGrid(scale, me);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-me.x, -me.y);

        if (gameState.structures) drawStructures(gameState.structures, me, scale);
        drawResources(gameState.resources, me, scale);

        for (let id in players) {
            const p = players[id];
            if (p.spawned && isOnScreen(p.x, p.y, p.radius, me, scale)) {
                drawPlayer(p);
            }
        }

        updateAndDrawParticles(dt);
        updateAndDrawFloatingTexts(dt);

        ctx.restore();
    }

    requestAnimationFrame(renderLoop);
}
