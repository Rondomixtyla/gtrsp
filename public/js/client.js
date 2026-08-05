const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const inputHandler = new InputHandler(canvas);

let myId = null;
let gameState = { players: {}, resources: [], structures: [], leaderboard: [] };
let MAP_SIZE = 4000;
let isPlaying = false;
let floatingTexts = [];

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

            const minimapPlayer = document.getElementById('minimap-player');
            if (minimapPlayer) {
                minimapPlayer.style.left = (me.x / MAP_SIZE * 100) + '%';
                minimapPlayer.style.top = (me.y / MAP_SIZE * 100) + '%';
            }
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

function drawGrid(scale) {
    const me = gameState.players[myId];
    if (!me) return;

    const gridSize = 60 * scale;
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

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Karakter Yer Gölgesi
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath(); ctx.arc(3, 5, p.radius, 0, Math.PI * 2); ctx.fill();

    // Nickname & Can Barı
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(p.name, 0, -p.radius - 22);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-24, -p.radius - 14, 48, 7);
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(-24, -p.radius - 14, (p.health / p.maxHealth) * 48, 7);

    ctx.rotate(p.angle);

    let attackOffset = p.isAttacking ? 14 : 0;

    // Eller ve Silah
    ctx.fillStyle = '#e0a96d';
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 3.5;

    // Sol El
    ctx.beginPath(); ctx.arc(22, -18, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Sağ El ve Kazma
    ctx.save();
    ctx.translate(22 + attackOffset, 18);
    
    if (p.selectedSlot === 0 || p.selectedSlot === undefined) {
        // Kazma Sapı
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(0, -3, 28, 6);
        ctx.strokeRect(0, -3, 28, 6);
        // Kazma Başı
        ctx.fillStyle = '#546e7a';
        ctx.fillRect(22, -15, 12, 30);
        ctx.strokeRect(22, -15, 12, 30);
    }
    
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Gövde
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#2d2d2d'; ctx.stroke();

    ctx.restore();
}

let millAngle = 0;
function drawStructures(structures) {
    millAngle += 0.03;
    structures.forEach(st => {
        ctx.save();
        ctx.translate(st.x, st.y);

        // Gölge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath(); ctx.arc(3, 4, st.radius, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4; ctx.strokeStyle = '#2d2d2d';

        if (st.type === 'wall') {
            ctx.fillStyle = '#a1887f';
            ctx.fillRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.strokeRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            // Ahşap detaylar
            ctx.beginPath();
            ctx.moveTo(-st.radius + 6, -st.radius / 2); ctx.lineTo(st.radius - 6, -st.radius / 2);
            ctx.moveTo(-st.radius + 6, st.radius / 2); ctx.lineTo(st.radius - 6, st.radius / 2);
            ctx.stroke();
        } else if (st.type === 'spike') {
            // Dikenli Yapı
            ctx.fillStyle = '#78909c';
            ctx.beginPath(); ctx.arc(0, 0, st.radius - 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            for (let i = 0; i < 8; i++) {
                let ang = (i * Math.PI) / 4;
                ctx.save();
                ctx.rotate(ang);
                ctx.fillStyle = '#b0bec5';
                ctx.beginPath();
                ctx.moveTo(st.radius - 6, -6);
                ctx.lineTo(st.radius + 8, 0);
                ctx.lineTo(st.radius - 6, 6);
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
            // Değirmen Gövdesi
            ctx.fillStyle = '#d7ccc8';
            ctx.beginPath(); ctx.arc(0, 0, st.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Dönen Pervane
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

function drawResources(resources) {
    resources.forEach(res => {
        ctx.save();
        ctx.translate(res.x, res.y);

        // Gölge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath(); ctx.arc(4, 5, res.radius, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4.5; ctx.strokeStyle = '#2d2d2d';

        if (res.type === 'bush') {
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Çilekler
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.arc(-10, -8, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 6, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-4, 10, 5, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'tree') {
            // Dış Katman
            ctx.fillStyle = '#388e3c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // İç Katman Yapraklar
            ctx.fillStyle = '#1b5e20';
            ctx.beginPath(); ctx.arc(0, 0, res.radius * 0.65, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'stone') {
            ctx.fillStyle = '#78909c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#90a4ae';
            ctx.beginPath(); ctx.arc(-6, -6, res.radius * 0.4, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'gold') {
            ctx.fillStyle = '#fbc02d';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff59d';
            ctx.beginPath(); ctx.arc(-6, -6, res.radius * 0.35, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    });
}

function renderLoop() {
    ctx.fillStyle = '#7cb342';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = gameState.players[myId];
    if (me) {
        const scale = 0.85;
        drawGrid(scale);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-me.x, -me.y);

        if (gameState.structures) drawStructures(gameState.structures);
        drawResources(gameState.resources);

        for (let id in gameState.players) {
            if (gameState.players[id].spawned) {
                drawPlayer(gameState.players[id]);
            }
        }

        ctx.restore();
    }

    requestAnimationFrame(renderLoop);
}
