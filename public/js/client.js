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

// Zemin ve Harita Sınırı (Grid & Harita Dışı Beyazlık)
function drawGrid(scale, me) {
    ctx.fillStyle = '#7ca942'; // Sploop çim rengi
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

// Orijinal Sploop Çekiç ve El Çizimi
function drawWeapon(isAttacking) {
    ctx.save();
    let swing = isAttacking ? Math.sin(performance.now() * 0.05) * 0.8 : 0;
    ctx.rotate(swing);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1a1a1a';

    // Çekiç Sapı (Ahşap)
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(10, -5, 38, 10);
    ctx.strokeRect(10, -5, 38, 10);

    // Çekiç Kafası (Koyu Metal)
    ctx.fillStyle = '#4a4e69';
    ctx.beginPath();
    ctx.roundRect(40, -18, 22, 36, 4);
    ctx.fill();
    ctx.stroke();

    // Çekiç Metal Detayı (Açık Çelik Şerit)
    ctx.fillStyle = '#9a8c98';
    ctx.fillRect(45, -18, 12, 36);
    ctx.strokeRect(45, -18, 12, 36);

    // Sol ve Sağ Eller (Gövdenin önünde tutan yumruklar)
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(16, 15, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(28, 6, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.restore();
}

// Orijinal Karakter
function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(3, 5, 35, 0, Math.PI * 2); ctx.fill();

    // İsim
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.strokeText(p.name, 0, -52);
    ctx.fillText(p.name, 0, -52);

    // Can Barı
    const barW = 54;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(-barW / 2, -42, barW, 8, 4); ctx.fill();
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    ctx.fillStyle = hpRatio > 0.5 ? '#57cc99' : hpRatio > 0.25 ? '#ffb703' : '#ff4d6d';
    ctx.beginPath(); ctx.roundRect(-barW / 2, -42, barW * hpRatio, 8, 4); ctx.fill();

    ctx.rotate(p.angle);

    // Silah
    drawWeapon(p.isAttacking);

    // Gövde (Sploop Ten Tonu + Siyah Kalın Kontür)
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#1a1a1a';
    ctx.stroke();

    ctx.restore();
}

// Orijinal Sploop Kayalar, Çalılar ve Meyveler
function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#1a1a1a';

        if (res.type === 'tree') {
            // Meyveli Çalı / Ağaç
            ctx.fillStyle = '#52b788';
            ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#74c69d';
            ctx.beginPath(); ctx.arc(-12, -12, 28, 0, Math.PI * 2); ctx.fill();

            // Kırmızı Böğürtlenler / Meyveler
            ctx.fillStyle = '#d90429';
            [[-18, 10], [12, -18], [15, 15], [-8, -22]].forEach(pt => {
                ctx.beginPath(); ctx.arc(pt[0], pt[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            });
        } else if (res.type === 'stone') {
            // Köşeli Kaya (Polygon Kaya Çizimi)
            ctx.fillStyle = '#6c757d';
            ctx.beginPath();
            ctx.moveTo(-35, -20); ctx.lineTo(-10, -42); ctx.lineTo(30, -30);
            ctx.lineTo(42, 10); ctx.lineTo(20, 38); ctx.lineTo(-25, 35); ctx.lineTo(-40, 5);
            ctx.closePath(); ctx.fill(); ctx.stroke();

            // Kaya Açık Yüzeyi
            ctx.fillStyle = '#adb5bd';
            ctx.beginPath();
            ctx.moveTo(-20, -15); ctx.lineTo(-5, -30); ctx.lineTo(20, -20); ctx.lineTo(10, 5); ctx.lineTo(-15, 10);
            ctx.closePath(); ctx.fill();
        } else if (res.type === 'gold') {
            // Altın Madeni
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
