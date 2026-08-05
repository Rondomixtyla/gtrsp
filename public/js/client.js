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
        selectedSlot: inputHandler.selectedSlot,
        autoAttack: inputHandler.autoAttack
    });

    const me = gameState.players[myId];
    if (me) {
        document.getElementById('res-food').innerText = me.resources.food;
        document.getElementById('res-wood').innerText = me.resources.wood;
        document.getElementById('res-stone').innerText = me.resources.stone;
        document.getElementById('res-gold').innerText = me.resources.gold;

        // Mini harita oyuncu konumu
        const minimapPlayer = document.getElementById('minimap-player');
        minimapPlayer.style.left = (me.x / MAP_SIZE * 100) + '%';
        minimapPlayer.style.top = (me.y / MAP_SIZE * 100) + '%';
    }
});

function drawGrid() {
    const me = gameState.players[myId];
    if (!me) return;

    const gridSize = 60;
    const offsetX = (canvas.width / 2 - me.x) % gridSize;
    const offsetY = (canvas.height / 2 - me.y) % gridSize;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
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

    // İsim & Can Barı
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 0, -p.radius - 22);

    // Can Barı
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-25, -p.radius - 15, 50, 8);
    ctx.fillStyle = '#76ff03';
    ctx.fillRect(-25, -p.radius - 15, (p.health / p.maxHealth) * 50, 8);

    ctx.rotate(p.angle);

    // Eller / Silah
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath(); ctx.arc(24, 15, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(24, -15, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Gövde
    ctx.fillStyle = isMe ? '#e0a96d' : '#d32f2f';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#2d2d2d'; ctx.stroke();

    ctx.restore();
}

function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        ctx.beginPath();
        ctx.arc(0, 0, res.radius, 0, Math.PI * 2);

        if (res.type === 'bush') { ctx.fillStyle = '#388e3c'; ctx.strokeStyle = '#1b5e20'; }
        else if (res.type === 'tree') { ctx.fillStyle = '#2e7d32'; ctx.strokeStyle = '#0d3c10'; }
        else if (res.type === 'stone') { ctx.fillStyle = '#78909c'; ctx.strokeStyle = '#37474f'; }
        else if (res.type === 'gold') { ctx.fillStyle = '#fbc02d'; ctx.strokeStyle = '#f57f17'; }

        ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
        ctx.restore();
    });
}

function renderLoop() {
    ctx.fillStyle = '#689f38'; // Sploop çim rengi
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
