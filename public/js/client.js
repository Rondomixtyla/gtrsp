const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const inputHandler = new InputHandler(canvas);

let myId = null;
let gameState = { players: {}, resources: [], structures: [], leaderboard: [] };
let MAP_SIZE = 4000;
let isPlaying = false;
let cameraZoom = 0.85;

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
    gameState = state;
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

function drawGrid(scale, me) {
    ctx.fillStyle = '#7ca942';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = 65 * scale;
    const offsetX = (canvas.width / 2 - me.x * scale) % gridSize;
    const offsetY = (canvas.height / 2 - me.y * scale) % gridSize;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 2;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

// Görseldeki Birebir Silah Yapıları ve Çapraz Açı Sistemi
function drawWeapon(type, isAttacking) {
    ctx.save();

    // Sploop.io'da silahlar varsayılan olarak hafif çapraz durur (~35 derece)
    let baseAngle = Math.PI / 5;
    let swing = isAttacking ? Math.sin(performance.now() * 0.06) * 1.1 : 0;
    ctx.rotate(baseAngle + swing);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineJoin = 'round';

    if (type === 'sword') {
        // Çift Kenarlı Kılıç
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(10, -5);
        ctx.lineTo(52, -6);
        ctx.lineTo(66, 0);
        ctx.lineTo(52, 6);
        ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Kılıç Kabzası ve Koruması
        ctx.fillStyle = '#475569';
        ctx.fillRect(8, -11, 6, 22); ctx.strokeRect(8, -11, 6, 22);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-8, -4, 16, 8); ctx.strokeRect(-8, -4, 16, 8);

    } else if (type === 'spear') {
        // Uzun Mızrak
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-15, -4, 80, 8); ctx.strokeRect(-15, -4, 80, 8);

        // Mızrak Ucu
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(65, -11); ctx.lineTo(92, 0); ctx.lineTo(65, 11);
        ctx.closePath(); ctx.fill(); ctx.stroke();

    } else {
        // Balyoz / Çekiç (Görseldeki "Choose Item" 2. Silah)
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(-5, -5, 48, 10);
        ctx.strokeRect(-5, -5, 48, 10);

        // Koyu Balyoz Kafası
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(38, -18, 24, 36, 4);
        ctx.fill(); ctx.stroke();

        // Balyoz Metal Şeridi
        ctx.fillStyle = '#64748b';
        ctx.fillRect(44, -18, 12, 36);
        ctx.strokeRect(44, -18, 12, 36);
    }

    // Eller (Silahı Tam Kavrayan Çift Yumruk)
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(12, 12, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(26, 4, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.restore();
}

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(3, 5, 33, 0, Math.PI * 2); ctx.fill();

    // İsim
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.strokeText(p.name, 0, -50);
    ctx.fillText(p.name, 0, -50);

    // Can Barı
    const barW = 50;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(-barW / 2, -40, barW, 7, 3); ctx.fill();
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
    ctx.beginPath(); ctx.roundRect(-barW / 2, -40, barW * hpRatio, 7, 3); ctx.fill();

    ctx.rotate(p.angle);

    // Seçilen slot'a göre silahı çiz
    const weaponType = (p.selectedSlot === 1) ? 'sword' : ((p.selectedSlot === 3) ? 'spear' : 'hammer');
    drawWeapon(weaponType, p.isAttacking);

    // Karakter Gövdesi
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#1d1d1d';
    ctx.stroke();

    ctx.restore();
}

function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#1d1d1d';

        if (res.type === 'tree') {
            ctx.fillStyle = '#52b788';
            ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#74c69d';
            ctx.beginPath(); ctx.arc(-12, -12, 28, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#d90429';
            [[-18, 10], [12, -18], [15, 15], [-8, -22]].forEach(pt => {
                ctx.beginPath(); ctx.arc(pt[0], pt[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            });
        } else if (res.type === 'stone') {
            ctx.fillStyle = '#6c757d';
            ctx.beginPath();
            ctx.moveTo(-35, -20); ctx.lineTo(-10, -42); ctx.lineTo(30, -30);
            ctx.lineTo(42, 10); ctx.lineTo(20, 38); ctx.lineTo(-25, 35); ctx.lineTo(-40, 5);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#adb5bd';
            ctx.beginPath();
            ctx.moveTo(-20, -15); ctx.lineTo(-5, -30); ctx.lineTo(20, -20); ctx.lineTo(10, 5); ctx.lineTo(-15, 10);
            ctx.closePath(); ctx.fill();
        } else if (res.type === 'gold') {
            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.moveTo(-28, -15); ctx.lineTo(0, -35); ctx.lineTo(32, -18);
            ctx.lineTo(35, 18); ctx.lineTo(5, 35); ctx.lineTo(-30, 20);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        ctx.restore();
    });
}

function renderLoop() {
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
