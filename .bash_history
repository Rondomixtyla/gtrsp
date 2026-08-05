        const card = document.createElement('div');
        card.style.cssText = `
            background: #252529; color: white; border: 2px solid #fbc02d;
            border-radius: 12px; padding: 14px 22px; text-align: center;
            cursor: pointer; user-select: none; transition: transform 0.15s;
        `;
        card.innerHTML = `
            <div style="font-size:38px">${item.icon}</div>
            <div style="font-weight:bold; margin-top:6px; font-size:14px;">${item.name}</div>
            <div style="font-size:11px; color:#aaa;">${item.desc}</div>
        `;
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
    const margin = radius * scale + 60;
    const sx = canvas.width / 2 + (x - me.x) * scale;
    const sy = canvas.height / 2 + (y - me.y) * scale;
    return sx > -margin && sx < canvas.width + margin && sy > -margin && sy < canvas.height + margin;
}

// Birebir Sploop.io Şapka Çizim Motoru
function drawHat(hatId, radius) {
    if (!hatId || hatId === 'none') return;

    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#141414';

    if (hatId === 'bush') {
        ctx.fillStyle = '#2e7d32';
        for (let i = 0; i < 6; i++) {
            let ang = (i * Math.PI) / 3;
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * (radius * 0.7), Math.sin(ang) * (radius * 0.7), 12, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
    } else if (hatId === 'bumber') {
        ctx.fillStyle = '#558b2f';
        ctx.beginPath(); ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#33691e';
        ctx.fillRect(-radius * 0.85, -3, radius * 1.7, 6);
    } else if (hatId === 'bull') {
        ctx.fillStyle = '#3e2723';
        ctx.beginPath(); ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Boynuzlar
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.moveTo(-radius * 0.7, -10); ctx.quadraticCurveTo(-radius * 1.4, -22, -radius * 1.2, -32); ctx.quadraticCurveTo(-radius * 0.5, -20, -radius * 0.4, -10); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(radius * 0.7, -10); ctx.quadraticCurveTo(radius * 1.4, -22, radius * 1.2, -32); ctx.quadraticCurveTo(radius * 0.5, -20, radius * 0.4, -10); ctx.fill(); ctx.stroke();
    } else if (hatId === 'boost') {
        ctx.fillStyle = '#fbc02d';
        ctx.beginPath(); ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff6f00';
        ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(4, -2); ctx.lineTo(-2, 0); ctx.lineTo(6, 12); ctx.lineTo(-4, 2); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();
    } else if (hatId === 'winter') {
        ctx.fillStyle = '#0288d1';
        ctx.beginPath(); ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    ctx.restore();
}

// Birebir Sploop.io Silah Çizimi ve Dairesel Vuruş Animasyonu
function drawWeapon(type, isAttacking) {
    ctx.save();
    let swingAngle = isAttacking ? Math.sin(performance.now() * 0.03) * 0.6 : 0;
    ctx.rotate(swingAngle);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#141414';

    if (type === 'sword') {
        // Sploop Çelik Kılıç
        ctx.fillStyle = '#cfd8dc';
        ctx.beginPath();
        ctx.moveTo(15, -7); ctx.lineTo(54, -4); ctx.lineTo(64, 0); ctx.lineTo(54, 4); ctx.lineTo(15, 7);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#fbc02d';
        ctx.fillRect(10, -10, 6, 20); ctx.strokeRect(10, -10, 6, 20);
        ctx.fillStyle = '#37474f';
        ctx.fillRect(-4, -4, 14, 8); ctx.strokeRect(-4, -4, 14, 8);
    } else if (type === 'spear') {
        // Uzun Mızrak
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-10, -3, 62, 6); ctx.strokeRect(-10, -3, 62, 6);
        ctx.fillStyle = '#b0bec5';
        ctx.beginPath();
        ctx.moveTo(52, -8); ctx.lineTo(76, 0); ctx.lineTo(52, 8);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
        // Orijinal Kazma
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-2, -3, 38, 6); ctx.strokeRect(-2, -3, 38, 6);
        ctx.fillStyle = '#78909c';
        ctx.beginPath();
        ctx.arc(32, 0, 16, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(26, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // El Çizimi
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); ctx.arc(10, 12, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(3, 5, p.radius, 0, Math.PI * 2); ctx.fill();

    // İsim
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
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(22, -16, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Sağ El & Silah
    const weaponType = (p.selectedSlot === 1 || p.weapon === 'sword') ? 'sword' : (p.weapon === 'spear' ? 'spear' : 'pickaxe');
    drawWeapon(weaponType, p.isAttacking);

    // Gövde
    ctx.fillStyle = '#e0a96d';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#141414'; ctx.stroke();

    // Şapka
    drawHat(p.hatId, p.radius);

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

        ctx.lineWidth = 4; ctx.strokeStyle = '#141414';

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

// Detaylı Sploop Ağaç & Taş Katmanlı Çizimleri
function drawResources(resources, me, scale) {
    resources.forEach(res => {
        if (!isOnScreen(res.x, res.y, res.radius, me, scale)) return;
        ctx.save();
        ctx.translate(res.x, res.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath(); ctx.arc(4, 5, res.radius, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4.5; ctx.strokeStyle = '#141414';

        if (res.type === 'tree') {
            // Katmanlı Ağaç
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#388e3c';
            ctx.beginPath(); ctx.arc(-5, -5, res.radius * 0.7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#43a047';
            ctx.beginPath(); ctx.arc(-10, -10, res.radius * 0.4, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'stone') {
            // Kaya Dokusu
            ctx.fillStyle = '#78909c';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#90a4ae';
            ctx.beginPath(); ctx.arc(-6, -6, res.radius * 0.55, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'gold') {
            ctx.fillStyle = '#fbc02d';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff59d';
            ctx.beginPath(); ctx.arc(-6, -6, res.radius * 0.5, 0, Math.PI * 2); ctx.fill();
        } else if (res.type === 'bush') {
            ctx.fillStyle = '#33691e';
            ctx.beginPath(); ctx.arc(0, 0, res.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#d50000';
            ctx.beginPath(); ctx.arc(-12, -8, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 8, 6, 0, Math.PI * 2); ctx.fill();
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
EOF

cat << 'EOF' > server/physics.js
function checkCircleCollision(c1, c2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = c1.radius + c2.radius;

    if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        return { collision: true, nx, ny, overlap };
    }
    return { collision: false };
}

function handlePhysics(player, resources, structures, players) {
    // 1. Ağaç, Taş ve Maden Çarpışması
    resources.forEach(res => {
        const resCol = checkCircleCollision(player, res);
        if (resCol.collision) {
            player.x -= resCol.nx * resCol.overlap;
            player.y -= resCol.ny * resCol.overlap;
        }
    });

    // 2. Yapı (Duvar, Diken) Çarpışması
    structures.forEach(st => {
        const stCol = checkCircleCollision(player, st);
        if (stCol.collision) {
            player.x -= stCol.nx * stCol.overlap;
            player.y -= stCol.ny * stCol.overlap;
        }
    });

    // 3. Oyuncu - Oyuncu Çarpışması
    for (let id in players) {
        if (id !== player.id) {
            const other = players[id];
            if (other.spawned) {
                const pCol = checkCircleCollision(player, other);
                if (pCol.collision) {
                    player.x -= pCol.nx * (pCol.overlap * 0.5);
                    player.y -= pCol.ny * (pCol.overlap * 0.5);
                }
            }
        }
    }
}

module.exports = { handlePhysics };
EOF

