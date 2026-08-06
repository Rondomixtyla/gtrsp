const socket = io();
const canvas = document.createElement('canvas');
canvas.id = 'gameCanvas';
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d', { alpha: false });
const dpr = window.devicePixelRatio || 1;

let myId = null;
let gameState = { players: {}, resources: [], structures: [], animals: [], leaderboard: [] };
let selectedSlot = 0;
let inputs = { up: false, down: false, left: false, right: false };
let playerAngle = 0;
let isAttacking = false;
let selectedSkinColor = '#fbc093';
let activeChatMessages = [];
let floatingTexts = []; // Kaynak toplama yazıları (+15 Wood vb.)

let leftTouch = { id: null, originX: 0, originY: 0, currX: 0, currY: 0, active: false };
let rightTouch = { id: null, originX: 0, originY: 0, currX: 0, currY: 0, active: false };

function resize() { 
    canvas.width = window.innerWidth * dpr; 
    canvas.height = window.innerHeight * dpr; 
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resize); 
resize();

document.querySelectorAll('.color-option').forEach(el => {
    el.onclick = () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        selectedSkinColor = el.getAttribute('data-color');
    };
});

document.getElementById('play-btn').onclick = () => {
    const name = document.getElementById('nickname-input').value || 'gtrsp player';
    socket.emit('joinGame', { name, color: selectedSkinColor, isSandbox: false });
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
};

window.selectSlot = function(slot) {
    selectedSlot = slot;
    document.querySelectorAll('.slot').forEach((el, idx) => {
        if (idx === slot) el.classList.add('active');
        else el.classList.remove('active');
    });
};
window.toggleModal = function(id) {};

const chatInput = document.getElementById('chat-input');
if(chatInput) {
    chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            socket.emit('chatMsg', chatInput.value); 
            chatInput.value = '';
            chatInput.blur();
        }
    });
}

socket.on('chatMessage', data => {
    activeChatMessages.push({
        id: data.id,
        text: data.text,
        name: data.name,
        expireTime: Date.now() + 5500
    });
});

window.addEventListener('touchstart', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.target.closest('#ui-container, .modal')) continue;

        if (t.clientX < window.innerWidth / 2 && !leftTouch.active) {
            leftTouch = { id: t.identifier, originX: t.clientX, originY: t.clientY, currX: t.clientX, currY: t.clientY, active: true };
        } else if (t.clientX >= window.innerWidth / 2 && !rightTouch.active) {
            rightTouch = { id: t.identifier, originX: t.clientX, originY: t.clientY, currX: t.clientX, currY: t.clientY, active: true };
            isAttacking = true;
            socket.emit('action');
        }
    }
}, {passive: false});

window.addEventListener('touchmove', e => {
    e.preventDefault(); 
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === leftTouch.id) {
            leftTouch.currX = t.clientX; leftTouch.currY = t.clientY;
            const dx = leftTouch.currX - leftTouch.originX;
            const dy = leftTouch.currY - leftTouch.originY;
            inputs.left = dx < -20; inputs.right = dx > 20;
            inputs.up = dy < -20; inputs.down = dy > 20;
        } else if (t.identifier === rightTouch.id) {
            rightTouch.currX = t.clientX; rightTouch.currY = t.clientY;
            const dx = rightTouch.currX - rightTouch.originX;
            const dy = rightTouch.currY - rightTouch.originY;
            if (Math.hypot(dx, dy) > 10) {
                playerAngle = Math.atan2(dy, dx);
                isAttacking = true;
                socket.emit('action');
            }
        }
    }
}, {passive: false});

function handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === leftTouch.id) {
            leftTouch.active = false; leftTouch.id = null;
            inputs = { up: false, down: false, left: false, right: false };
        } else if (t.identifier === rightTouch.id) {
            rightTouch.active = false; rightTouch.id = null;
            isAttacking = false;
        }
    }
}
window.addEventListener('touchend', handleTouchEnd);
window.addEventListener('touchcancel', handleTouchEnd);

socket.on('init', data => { myId = data.id; requestAnimationFrame(render); });
socket.on('gameState', state => {
    gameState = state;
    socket.emit('playerInput', { inputs, angle: playerAngle, selectedSlot });
});

function drawGrid(me) {
    ctx.fillStyle = '#78b546'; 
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    ctx.strokeStyle = '#6eab3c'; 
    ctx.lineWidth = 2;
    const gridSize = 120;
    const offsetX = (window.innerWidth / 2 - me.x) % gridSize;
    const offsetY = (window.innerHeight / 2 - me.y) % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < window.innerWidth; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, window.innerHeight); }
    for (let y = offsetY; y < window.innerHeight; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(window.innerWidth, y); }
    ctx.stroke();
}

function drawSploopTree(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.arc(0, radius * 0.3, radius + 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#3e6b23';
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#234011'; ctx.stroke();
    ctx.restore();
}

function drawSploopStone(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.arc(0, radius * 0.3, radius + 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#757575';
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

// Optimize Edilmiş Karakter Tasarımı (Küçük Kafa, Büyük Eller, Mükemmel Tutuş)
function drawSploopPlayer(p, isMe) {
    ctx.save(); ctx.translate(p.x, p.y);

    let r = p.radius || 19; // Daha orantılı ve küçük gövde/kafa

    let isLeader = false;
    if (gameState.leaderboard && gameState.leaderboard.length > 0) {
        if (p.id === gameState.leaderboard[0].id) isLeader = true;
    }

    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    
    let displayName = p.name;
    if (isLeader) displayName = "👑 " + displayName;

    ctx.strokeText(displayName, 0, -r - 14);
    ctx.fillText(displayName, 0, -r - 14);

    ctx.rotate(p.angle);

    // İri ve Dikkat Çekici Eller
    ctx.fillStyle = p.color || '#fbc093'; 
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5;
    
    // Sağ El
    ctx.beginPath(); ctx.arc(r - 1, 13, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Sol El
    ctx.beginPath(); ctx.arc(r - 1, -13, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Kafa / Gövde
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Gözler
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(r * 0.35, -5.5, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.35, 5.5, 2.8, 0, Math.PI * 2); ctx.fill();

    // Slot Ekipmanları & Savurma Animasyonu
    ctx.save();
    let swingAngle = (isMe && isAttacking) ? Math.sin(Date.now() / 40) * 0.9 : 0;
    ctx.translate(r + 4, 13);
    ctx.rotate(swingAngle + Math.PI / 4);

    if (p.selectedSlot === 0) {
        // Kılıç
        ctx.fillStyle = '#e0e0e0'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(-4, -48, 8, 48); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(-8, -10, 16, 6);
    } else if (p.selectedSlot === 1) {
        // Elma
        ctx.fillStyle = '#ff4747';
        ctx.beginPath(); ctx.arc(0, -15, 11, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    } else if (p.selectedSlot === 2) {
        // Odun
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(-6, -26, 12, 26);
        ctx.strokeRect(-6, -26, 12, 26);
    } else if (p.selectedSlot === 3) {
        // Kalkan
        ctx.fillStyle = '#4682b4';
        ctx.beginPath(); ctx.arc(0, -15, 13, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    } else {
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath(); ctx.arc(0, -15, 11, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    ctx.restore();

    // Can Barı ve Age (Karakterin Altında)
    ctx.save();
    ctx.translate(p.x, p.y + r + 8);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-22, 0, 44, 7);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(-21, 1, Math.max(0, (p.health / p.maxHealth) * 42), 5);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Age ${p.age || 1}`, 0, 18);
    ctx.restore();
}

function drawUIOverlay() {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(window.innerWidth - 190, 60, 175, 130);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LİDERLİK TABLOSU', window.innerWidth - 102, 82);

    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    let rankY = 105;
    if (gameState.leaderboard && gameState.leaderboard.length > 0) {
        gameState.leaderboard.forEach((entry, idx) => {
            let prefix = idx === 0 ? "👑 " : "";
            ctx.fillText(`${prefix}${idx + 1}. ${entry.name} - ${entry.score}`, window.innerWidth - 180, rankY);
            rankY += 20;
        });
    } else {
        ctx.fillText('1. gtrsp - 100', window.innerWidth - 180, rankY);
    }
    ctx.restore();

    // Minimap
    ctx.save();
    const mapSize = 110;
    const mapX = 20;
    const mapY = window.innerHeight - mapSize - 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2; ctx.stroke();
    
    if (gameState.leaderboard && gameState.leaderboard.length > 0) {
        let topId = gameState.leaderboard[0].id;
        let leaderObj = gameState.players[topId];
        if (leaderObj) {
            let lX = mapX + (leaderObj.x / 4000) * mapSize;
            let lY = mapY + (leaderObj.y / 4000) * mapSize;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath(); ctx.arc(lX, lY, 4, 0, Math.PI*2); ctx.fill();
        }
    }

    const me = gameState.players[myId];
    if (me) {
        let dotX = mapX + (me.x / 4000) * mapSize;
        let dotY = mapY + (me.y / 4000) * mapSize;
        ctx.fillStyle = '#ff4747';
        ctx.beginPath(); ctx.arc(dotX, dotY, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    const now = Date.now();
    activeChatMessages = activeChatMessages.filter(msg => msg.expireTime > now);

    activeChatMessages.forEach(msg => {
        let targetPlayer = gameState.players[msg.id];
        if (targetPlayer) {
            ctx.save();
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffff00';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(`${msg.name}: ${msg.text}`, targetPlayer.x, targetPlayer.y - targetPlayer.radius - 30);
            ctx.fillText(`${msg.name}: ${msg.text}`, targetPlayer.x, targetPlayer.y - targetPlayer.radius - 30);
            ctx.restore();
        }
    });
}

function render() {
    const me = gameState.players[myId];
    if (me) {
        drawGrid(me);

        ctx.save();
        ctx.translate(window.innerWidth / 2 - me.x, window.innerHeight / 2 - me.y);

        gameState.structures.forEach(s => {
            ctx.fillStyle = '#8d5524';
            ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = '#4e2f13'; ctx.stroke();
        });

        gameState.resources.forEach(r => {
            if (r.type === 'tree') drawSploopTree(r.x, r.y, r.radius);
            else if (r.type === 'stone') drawSploopStone(r.x, r.y, r.radius);
        });

        if (gameState.animals) {
            gameState.animals.forEach(a => {
                ctx.fillStyle = '#a0522d';
                ctx.beginPath(); ctx.arc(a.x, a.y, a.radius, 0, Math.PI*2); ctx.fill();
            });
        }

        for (let id in gameState.players) {
            drawSploopPlayer(gameState.players[id], id === myId);
        }

        ctx.restore();
        
        drawUIOverlay();
        drawJoysticks();
    }
    requestAnimationFrame(render);
}

function drawJoysticks() {
    if (leftTouch.active) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath(); ctx.arc(leftTouch.originX, leftTouch.originY, 50, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath(); ctx.arc(leftTouch.currX, leftTouch.currY, 20, 0, Math.PI*2); ctx.fill();
    }
    if (rightTouch.active) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.1)';
        ctx.beginPath(); ctx.arc(rightTouch.originX, rightTouch.originY, 50, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
        ctx.beginPath(); ctx.arc(rightTouch.currX, rightTouch.currY, 20, 0, Math.PI*2); ctx.fill();
    }
}
