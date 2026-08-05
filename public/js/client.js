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
        minimapPlayer.style.left = (me.x / MAP_SIZE * 100) + '%';
        minimapPlayer.style.top = (me.y / MAP_SIZE * 100) + '%';
    }
});

function drawGrid() {
    const me = gameState.players[myId];
    if (!me) return;

    const gridSize = 50;
    const offsetX = (canvas.width / 2 - me.x) % gridSize;
    const offsetY = (canvas.height / 2 - me.y) % gridSize;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1.5;

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
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    ctx.fillText(p.name, 0, -p.radius - 20);
    ctx.shadowBlur = 0;

    // Can Barı
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-22, -p.radius - 12, 44, 6);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(-22, -p.radius - 12, (p.health / p.maxHealth) * 44, 6);

    ctx.rotate(p.angle);

    // Çekiç / Eller
    let attackOffset = p.isAttacking ? 12 : 0;

    ctx.fillStyle = '#e5c158';
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3.5;

    // Sol ve Sağ el
    ctx.beginPath(); ctx.arc(22 + attackOffset, 16, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(22 + attackOffset, -16, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Çekiç Sapı ve Başı (Ataktaysa)
    if (p.selectedSlot === 0) {
        ctx.fillStyle = '#795548';
        ctx.fillRect(15 + attackOffset, 10, 25, 5);
        ctx.fillStyle = '#424242';
        ctx.fillRect(35 + attackOffset, 2, 12, 20);
    }

    // Karakter Gövdesi
    ctx.fillStyle = '#e5c158'; // Sploop ten rengi
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#2b2b2b'; ctx.stroke();

    ctx.restore();
}

function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#2b2b2b';

        if (res.type === 'bush') {
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath(); ctx.arc(-8, -8, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(8, 6, 6, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'tree') {
            ctx.fillStyle = '#388e3c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath(); ctx.arc(0, 0, res.radius * 0.6, 0, Math.PI * 2); ctx.fill();
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

function renderLoop() {
    ctx.fillStyle = '#85ac44'; // Orijinal çim rengi
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = gameState.players[myId];
    if (me) {
        drawGrid();

        ctx.save();
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);

        drawResources(gameState.resources);

        for (let id in gameState.players) {
            drawPlayer(gameState.players[id], id === myId);
        }

        ctx.restore();
    }

    requestAnimationFrame(renderLoop);
}
