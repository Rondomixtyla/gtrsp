const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const inputHandler = new InputHandler(canvas);

let myId = null;
let gameState = { players: {}, resources: [], structures: [] };

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

    if (inputHandler.autoAttack) socket.emit('attackAction');

    const me = gameState.players[myId];
    if (me) {
        document.getElementById('res-wood').innerText = me.resources.wood;
        document.getElementById('res-stone').innerText = me.resources.stone;
        document.getElementById('res-gold').innerText = me.resources.gold;
        document.getElementById('res-food').innerText = me.resources.food;

        const hpPercent = (me.health / me.maxHealth) * 100;
        document.getElementById('health-bar').style.width = hpPercent + '%';
        document.getElementById('health-text').innerText = `${me.health} / ${me.maxHealth}`;
    }
});

function drawStructures(structures) {
    structures.forEach(st => {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.beginPath();
        ctx.arc(0, 0, st.radius, 0, Math.PI * 2);

        if (st.type === 'wall') { ctx.fillStyle = '#8d6e63'; ctx.strokeStyle = '#4e342e'; }
        else if (st.type === 'spike') { ctx.fillStyle = '#b0bec5'; ctx.strokeStyle = '#37474f'; }
        else if (st.type === 'trap') { ctx.fillStyle = '#37474f'; ctx.strokeStyle = '#212121'; }
        else if (st.type === 'windmill') { ctx.fillStyle = '#ffb74d'; ctx.strokeStyle = '#e65100'; }

        ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
    });
}

function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);
        ctx.beginPath();
        ctx.arc(0, 0, res.radius, 0, Math.PI * 2);

        if (res.type === 'tree') { ctx.fillStyle = '#2e7d32'; ctx.strokeStyle = '#1b5e20'; }
        else if (res.type === 'stone') { ctx.fillStyle = '#757575'; ctx.strokeStyle = '#424242'; }
        else if (res.type === 'gold') { ctx.fillStyle = '#fbc02d'; ctx.strokeStyle = '#f57f17'; }

        ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
        ctx.restore();
    });
}

function drawPlayer(p, isMe) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    let swing = p.isAttacking ? Math.sin(Date.now() / 30) * 0.8 : 0;

    ctx.save();
    ctx.translate(22, 16);
    ctx.rotate(swing);
    ctx.fillStyle = '#795548'; ctx.fillRect(0, -3, 25, 6);
    ctx.fillStyle = '#424242'; ctx.fillRect(18, -10, 12, 20);
    ctx.restore();

    ctx.fillStyle = '#e5c158'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(22, -16, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.fillStyle = isMe ? '#8bc34a' : '#f44336';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#222'; ctx.stroke();

    ctx.restore();
}

function renderLoop() {
    ctx.fillStyle = '#619639';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = gameState.players[myId];
    if (me) {
        ctx.save();
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);

        drawStructures(gameState.structures);
        drawResources(gameState.resources);

        for (let id in gameState.players) {
            drawPlayer(gameState.players[id], id === myId);
        }

        ctx.restore();
    }

    requestAnimationFrame(renderLoop);
}
