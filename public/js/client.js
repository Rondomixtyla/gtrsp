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

const HATS = [
    { id: 'none', name: 'Yok', price: 0, icon: '🚫' },
    { id: 'bush', name: 'Bush Hat', price: 300, icon: '🌿' },
    { id: 'bumber', name: 'Bumber Hat', price: 500, icon: '🪖' },
    { id: 'bull', name: 'Bull Helmet', price: 1500, icon: '🐂' },
    { id: 'boost', name: 'Boost Hat', price: 2000, icon: '⚡' },
    { id: 'winter', name: 'Winter Cap', price: 1000, icon: '❄️' }
];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

document.getElementById('play-btn').addEventListener('click', () => {
    const name = document.getElementById('nickname-input').value;
    socket.emit('joinGame', { name });
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    isPlaying = true;
});

inputHandler.onAttack = () => { if (isPlaying) socket.emit('attackAction'); };
inputHandler.onQuickHeal = () => { if (isPlaying) socket.emit('quickHeal'); };

socket.on('init', (data) => {
    myId = data.id;
    MAP_SIZE = data.mapSize;
    requestAnimationFrame(renderLoop);
});

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
        }
    }
});

// Zemin Izgarası ve Renk Tonu
function drawGrid(scale, me) {
    const gridSize = 70 * scale;
    const offsetX = (canvas.width / 2 - me.x * scale) % gridSize;
    const offsetY = (canvas.height / 2 - me.y * scale) % gridSize;

    // Sploop Orijinal Çim Rengi
    ctx.fillStyle = '#8ecc51';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#7cb942';
    ctx.lineWidth = 3;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

// Birebir Sploop.io Silah Çizimleri & Vuruş Animasyonu
function drawWeapon(type, isAttacking) {
    ctx.save();
    
    // Saldırı Animasyonu (Kavisli Savurma)
    let swingAngle = isAttacking ? Math.sin(performance.now() * 0.04) * 0.9 : 0;
    ctx.rotate(swingAngle);

    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#1d1d1d';

    if (type === 'sword') {
        // Çelik Kılıç
        ctx.fillStyle = '#d0d7de';
        ctx.beginPath();
        ctx.moveTo(15, -6); ctx.lineTo(55, -4); ctx.lineTo(68, 0); ctx.lineTo(55, 4); ctx.lineTo(15, 6);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(12, -12, 6, 24); ctx.strokeRect(12, -12, 6, 24);
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(-6, -4, 18, 8); ctx.strokeRect(-6, -4, 18, 8);
    } else if (type === 'spear') {
        // Mızrak
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-12, -4, 75, 8); ctx.strokeRect(-12, -4, 75, 8);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(60, -10); ctx.lineTo(88, 0); ctx.lineTo(60, 10);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
        // Kazma / Balta
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-5, -4, 45, 8); ctx.strokeRect(-5, -4, 45, 8);
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(36, 0, 18, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(28, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // Eller
    ctx.fillStyle = '#eaaf85';
    ctx.beginPath(); ctx.arc(12, 14, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(30, 8, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.restore();
}

// Kaliteli Oyuncu Çizimi
function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Derin Gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.arc(4, 6, p.radius || 35, 0, Math.PI * 2); ctx.fill();

    // İsim
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(p.name, 0, - (p.radius || 35) - 24);
    ctx.fillText(p.name, 0, - (p.radius || 35) - 24);

    // Can Barı
    const barW = 50;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-barW / 2, - (p.radius || 35) - 14, barW, 7);
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(-barW / 2, - (p.radius || 35) - 14, barW * hpRatio, 7);

    ctx.rotate(p.angle);

    // Silah VE Eller
    const weaponType = (p.selectedSlot === 1 || p.weapon === 'sword') ? 'sword' : (p.weapon === 'spear' ? 'spear' : 'pickaxe');
    drawWeapon(weaponType, p.isAttacking);

    // Karakter Gövdesi (Sploop Ten Rengi)
    ctx.fillStyle = '#eaaf85';
    ctx.beginPath(); ctx.arc(0, 0, p.radius || 35, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#1d1d1d'; ctx.stroke();

    ctx.restore();
}

// Orijinal Sploop Ağaç, Taş ve Maden Çizimleri
function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        const r = res.radius || 45;

        // Gölge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath(); ctx.arc(5, 7, r, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 5; ctx.strokeStyle = '#1d1d1d';

        if (res.type === 'tree') {
            // Katmanlı Detaylı Ağaç
            ctx.fillStyle = '#15803d';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#16a34a';
            ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, r * 0.65, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'stone') {
            // Detaylı Kaya
            ctx.fillStyle = '#64748b';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'gold') {
            // Altın Madeni
            ctx.fillStyle = '#eab308';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.5, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    });
}

function renderLoop(now) {
    const me = gameState.players[myId];
    if (me) {
        const scale = cameraZoom;
        drawGrid(scale, me);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-me.x, -me.y);

        drawResources(gameState.resources);

        for (let id in gameState.players) {
            const p = gameState.players[id];
            if (p.spawned) drawPlayer(p);
        }

        ctx.restore();
    }

    requestAnimationFrame(renderLoop);
}
