const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const inputHandler = new InputHandler(canvas);

let myId = null;
let gameState = { players: {}, resources: [], structures: [] };
let MAP_SIZE = 4000;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

inputHandler.onAttack = () => socket.emit('attackAction');
inputHandler.onQuickHeal = () => socket.emit('quickHeal');

socket.on('init', (data) => {
    myId = data.id;
    MAP_SIZE = data.mapSize;
    requestAnimationFrame(renderLoop);
});

socket.on('gameState', (state) => {
    gameState = state;

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

        const minimapPlayer = document.getElementById('minimap-player');
        if (minimapPlayer) {
            minimapPlayer.style.left = (me.x / MAP_SIZE * 100) + '%';
            minimapPlayer.style.top = (me.y / MAP_SIZE * 100) + '%';
        }
    }
});

function drawGrid(scale) {
    const me = gameState.players[myId];
    if (!me) return;

    const gridSize = 60 * scale;
    const offsetX = (canvas.width / 2 - me.x * scale) % gridSize;
    const offsetY = (canvas.height / 2 - me.y * scale) % gridSize;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function drawPlayer(p, isMe) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // İsim
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(p.name, 0, -p.radius - 22);
    ctx.shadowBlur = 0;

    // Can Barı
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-24, -p.radius - 14, 48, 7);
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(-24, -p.radius - 14, (p.health / p.maxHealth) * 48, 7);

    // Karakter Yönü Dönüşü
    ctx.rotate(p.angle);

    let attackOffset = p.isAttacking ? 14 : 0;

    // Eller ve Silah (Çekiç)
    ctx.fillStyle = '#e0a96d';
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 4;

    // Sol El
    ctx.beginPath(); 
    ctx.arc(22, -18, 9, 0, Math.PI * 2); 
    ctx.fill(); ctx.stroke();

    // Sağ El ve Çekiç
    ctx.save();
    ctx.translate(22 + attackOffset, 18);
    
    // Çekiç (Sadece çekiç slotu seçiliyken veya boşken)
    if (p.selectedSlot === 0 || p.selectedSlot === undefined) {
        // Çekiç Sapı
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(0, -3, 26, 6);
        ctx.strokeRect(0, -3, 26, 6);

        // Çekiç Başı
        ctx.fillStyle = '#424242';
        ctx.fillRect(22, -14, 14, 28);
        ctx.strokeRect(22, -14, 14, 28);
    }
    
    // Sağ El Dağiresi
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); 
    ctx.arc(0, 0, 9, 0, Math.PI * 2); 
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Karakter Ana Gövdesi (Sploop Ten Rengi)
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); 
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2); 
    ctx.fill();
    ctx.lineWidth = 4.5; 
    ctx.strokeStyle = '#2d2d2d'; 
    ctx.stroke();

    ctx.restore();
}

function drawStructures(structures) {
    structures.forEach(st => {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2d2d2d';

        if (st.type === 'wall') {
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.strokeRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
        } else if (st.type === 'spike') {
            ctx.fillStyle = '#b0bec5';
            ctx.beginPath();
            ctx.arc(0, 0, st.radius, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        } else if (st.type === 'trap') {
            ctx.fillStyle = '#37474f';
            ctx.beginPath();
            ctx.arc(0, 0, st.radius, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        } else if (st.type === 'windmill') {
            ctx.fillStyle = '#ffb74d';
            ctx.beginPath();
            ctx.arc(0, 0, st.radius, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }

        ctx.restore();
    });
}

function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#2d2d2d';

        if (res.type === 'bush') {
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Meyveler
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.arc(-10, -8, 7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(8, 8, 7, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, -6, 6, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'tree') {
            ctx.fillStyle = '#43a047';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath(); ctx.arc(0, 0, res.radius * 0.65, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'stone') {
            ctx.fillStyle = '#78909c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#546e7a';
            ctx.beginPath(); ctx.arc(-5, -5, res.radius * 0.5, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'gold') {
            ctx.fillStyle = '#fbc02d';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f57f17';
            ctx.beginPath(); ctx.arc(-4, -4, res.radius * 0.55, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    });
}

function renderLoop() {
    // Çim Rengi
    ctx.fillStyle = '#7cb342';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = gameState.players[myId];
    if (me) {
        // Kamera ölçeği (Zoom out) - Ekranı biraz daha geniş görmeyi sağlar
        const scale = 0.85;

        drawGrid(scale);

        ctx.save();
        // Kamerayı oyuncuya ortala ve scale uygula
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-me.x, -me.y);

        // Yapıları Çiz
        if (gameState.structures) drawStructures(gameState.structures);

        // Kaynakları Çiz
        drawResources(gameState.resources);

        // Oyuncuları Çiz
        for (let id in gameState.players) {
            drawPlayer(gameState.players[id], id === myId);
        }

        ctx.restore();
    }

    requestAnimationFrame(renderLoop);
}
