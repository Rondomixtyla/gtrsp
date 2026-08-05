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
EOF

git add .
git commit -m "Sploop.io grafik kaplamalari, pervaneler, dikenler ve golgeler eklendi"
git push
#!/data/data/com.termux/files/usr/bin/bash
set -e
cat << 'EOF' > public/js/client.js
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
let camShake = { x: 0, y: 0, t: 0 };
let cameraZoom = 0.85;
let targetZoom = 0.85;

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

// --- Hasar / öldürme olaylarından partikül ve yazı üretimi ---
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
        particles.push({
            x, y,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            life: 1,
            color
        });
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

            const minimapPlayer = document.getElementById('minimap-player');
            if (minimapPlayer) {
                minimapPlayer.style.left = (me.x / MAP_SIZE * 100) + '%';
                minimapPlayer.style.top = (me.y / MAP_SIZE * 100) + '%';
            }

            // Yavaş hareket ederken hafif zoom-in, hızlı koşarken zoom-out
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

// --- Interpolasyon: sunucudan gelen state'ler arasında yumuşak geçiş ---
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

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 2;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function isOnScreen(x, y, radius, me, scale) {
    const margin = radius * scale + 40;
    const sx = canvas.width / 2 + (x - me.x) * scale;
    const sy = canvas.height / 2 + (y - me.y) * scale;
    return sx > -margin && sx < canvas.width + margin && sy > -margin && sy < canvas.height + margin;
}

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Yer gölgesi
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath(); ctx.arc(3, 5, p.radius, 0, Math.PI * 2); ctx.fill();

    // İsim
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(p.name, 0, -p.radius - 22);
    ctx.shadowBlur = 0;

    // Can barı (arka + dolgu + kenarlık)
    const barW = 48;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW / 2, -p.radius - 14, barW, 7);
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    const hpColor = hpRatio > 0.5 ? '#66bb6a' : hpRatio > 0.25 ? '#ffb74d' : '#ef5350';
    ctx.fillStyle = hpColor;
    ctx.fillRect(-barW / 2, -p.radius - 14, barW * hpRatio, 7);

    ctx.rotate(p.angle);

    let attackOffset = p.isAttacking ? 14 : 0;

    ctx.fillStyle = '#e0a96d';
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 3.5;

    // Sol el
    ctx.beginPath(); ctx.arc(22, -18, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Sağ el ve alet
    ctx.save();
    ctx.translate(22 + attackOffset, 18);

    if (p.selectedSlot === 0 || p.selectedSlot === undefined) {
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(0, -3, 28, 6);
        ctx.strokeRect(0, -3, 28, 6);
        ctx.fillStyle = '#546e7a';
        ctx.fillRect(22, -15, 12, 30);
        ctx.strokeRect(22, -15, 12, 30);
    } else if (p.selectedSlot === 1) {
        // Kılıç
        ctx.fillStyle = '#b0bec5';
        ctx.fillRect(10, -4, 34, 8);
        ctx.strokeRect(10, -4, 34, 8);
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(0, -5, 12, 10);
        ctx.strokeRect(0, -5, 12, 10);
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
function drawStructures(structures, me, scale) {
    millAngle += 0.03;
    structures.forEach(st => {
        if (!isOnScreen(st.x, st.y, st.radius, me, scale)) return;
        ctx.save();
        ctx.translate(st.x, st.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath(); ctx.arc(3, 4, st.radius, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4; ctx.strokeStyle = '#2d2d2d';

        if (st.type === 'wall') {
            ctx.fillStyle = '#a1887f';
            ctx.fillRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.strokeRect(-st.radius, -st.radius, st.radius * 2, st.radius * 2);
            ctx.beginPath();
            ctx.moveTo(-st.radius + 6, -st.radius / 2); ctx.lineTo(st.radius - 6, -st.radius / 2);
            ctx.moveTo(-st.radius + 6, st.radius / 2); ctx.lineTo(st.radius - 6, st.radius / 2);
            ctx.stroke();
        } else if (st.type === 'spike') {
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

        ctx.lineWidth = 4.5; ctx.strokeStyle = '#2d2d2d';

        if (res.type === 'bush') {
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e53935';
            ctx.beginPath(); ctx.arc(-10, -8, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 6, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-4, 10, 5, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'tree') {
            ctx.fillStyle = '#388e3c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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

    // Sunucu tikleri arasında yumuşak interpolasyon
    const t = Math.min(1, (now - lastStateTime) / 100);
    const players = getInterpolatedPlayers(t);

    cameraZoom += (targetZoom - cameraZoom) * 0.05;

    ctx.fillStyle = '#7cb342';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = players[myId];
    if (me) {
        const scale = cameraZoom;
        drawGrid(scale, me);

        ctx.save();
        ctx.translate(canvas.width / 2 + camShake.x, canvas.height / 2 + camShake.y);
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
EOF

git add .
git commit -m "Sploop.io grafik iyilestirmeleri: interpolasyon, kamera zoom, partikul efektleri, hasar yazilari"
git push
bash update_client.sh
