const socket = io();
const canvas = document.createElement('canvas');
canvas.id = 'gameCanvas';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d', { alpha: false }); // Performans için alpha kapalı

// Yüksek Çözünürlük (Retina/Mobil Ekranlar İçin Keskinlik)
const dpr = window.devicePixelRatio || 1;

let myId = null;
let gameState = { players: {}, resources: [], structures: [] };
let selectedSlot = 0;
let inputs = { up: false, down: false, left: false, right: false };
let playerAngle = 0;
let isAttacking = false;

// Profesyonel Mobil Joystick Kontrolleri
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

// UI Bağlantıları
document.getElementById('play-normal').onclick = () => startGame(false);
document.getElementById('play-sandbox').onclick = () => startGame(true);

function startGame(isSandbox) {
    const name = document.getElementById('nickname-input').value || 'Splooper';
    socket.emit('joinGame', { name, isSandbox });
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    if (isSandbox && document.getElementById('sandbox-btn')) {
        document.getElementById('sandbox-btn').classList.remove('hidden');
    }
}

// HTML'den çağrılan buton fonksiyonları
window.selectSlot = function(slot) {
    selectedSlot = slot;
    document.querySelectorAll('.slot').forEach((el, idx) => {
        if (idx === slot) el.classList.add('active');
        else el.classList.remove('active');
    });
};
window.toggleModal = function(id) { document.getElementById(id).classList.toggle('active'); };
window.giveSandboxRes = function() { socket.emit('sandboxGiveRes'); };
window.buyHat = function(hat) { socket.emit('buyHat', hat); window.toggleModal('shop-modal'); };
window.createClan = function() {
    const name = document.getElementById('clan-name-input').value;
    if (name) { socket.emit('createClan', name); window.toggleModal('clan-modal'); }
};

// Chat İşlemleri
const chatInput = document.getElementById('chat-input');
if(chatInput) {
    chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            socket.emit('chatMsg', chatInput.value); chatInput.value = '';
        }
    });
}
socket.on('chatMessage', data => {
    const box = document.getElementById('chat-messages');
    if(box) {
        box.innerHTML += `<div><b>${data.name}:</b> ${data.text}</div>`;
        box.scrollTop = box.scrollHeight;
    }
});

// === GELİŞMİŞ MOBİL KONTROLLER (Çift Joystick) ===
window.addEventListener('touchstart', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.target.closest('#ui-container, .modal')) continue;

        if (t.clientX < window.innerWidth / 2 && !leftTouch.active) {
            leftTouch = { id: t.identifier, originX: t.clientX, originY: t.clientY, currX: t.clientX, currY: t.clientY, active: true };
        } else if (t.clientX >= window.innerWidth / 2 && !rightTouch.active) {
            rightTouch = { id: t.identifier, originX: t.clientX, originY: t.clientY, currX: t.clientX, currY: t.clientY, active: true };
            isAttacking = true; 
            socket.emit('action'); // Vur/İnşa Et tetikle
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
            if (Math.hypot(dx, dy) > 10) playerAngle = Math.atan2(dy, dx);
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

// ==========================================
// SPLOOP.IO PROFESYONEL GRAFİK MOTORU
// ==========================================

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

// 1. Ağaç Çizimi (Katmanlı ve Gölgeli)
function drawSploopTree(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(0, radius * 0.3, radius + 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#3e6b23';
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#234011'; ctx.stroke();

    ctx.fillStyle = '#548f2e';
    ctx.beginPath(); ctx.arc(-radius*0.1, -radius*0.1, radius * 0.75, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = '#65a639';
    ctx.beginPath(); ctx.arc(-radius*0.25, -radius*0.25, radius * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// 2. Taş/Kaya Çizimi (Asimetrik)
function drawSploopStone(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(0, radius * 0.3, radius + 5, 0, Math.PI * 2); ctx.fill();

    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    grad.addColorStop(0, '#9e9e9e');
    grad.addColorStop(1, '#616161');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 4;

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        let angle = (i / 8) * Math.PI * 2;
        let dist = radius * (0.85 + Math.random() * 0.15); 
        if (i === 0) ctx.moveTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
        else ctx.lineTo(Math.cos(angle) * dist, Math.sin(angle) * dist);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-radius*0.4, -radius*0.2); ctx.lineTo(radius*0.3, radius*0.4); ctx.stroke();
    ctx.restore();
}

// 3. Altın Madeni Çizimi (Sploop Stil)
function drawSploopGold(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.arc(0, radius * 0.3, radius + 5, 0, Math.PI * 2); ctx.fill();

    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    grad.addColorStop(0, '#ffd54f');
    grad.addColorStop(1, '#f57f17');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#bc5100';
    ctx.lineWidth = 4;

    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#ffecb3';
    ctx.beginPath(); ctx.arc(-radius*0.3, -radius*0.3, radius*0.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

// 4. Metal Spike (Diken)
function drawSploopSpike(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#2c2c2c'; ctx.stroke();

    ctx.fillStyle = '#d4d4d4'; 
    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-radius * 0.2, -radius * 0.5);
        ctx.lineTo(radius * 0.2, -radius * 0.5);
        ctx.lineTo(0, -radius - 5); 
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

// 5. Trap (Tuzak) Çizimi (Gizli Çukur ve Dişler)
function drawSploopTrap(x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#5c4033'; 
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#38251b'; ctx.stroke();

    ctx.fillStyle = '#241a14';
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#a8a8a8';
    ctx.strokeStyle = '#4f4f4f';
    for (let i = 0; i < 8; i++) {
        ctx.rotate((Math.PI * 2) / 8);
        ctx.beginPath();
        ctx.moveTo(-8, -radius * 0.9);
        ctx.lineTo(8, -radius * 0.9);
        ctx.lineTo(0, -radius * 0.3); 
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}

// 6. Oyuncu, Kılıç ve Eller
function drawSploopPlayer(p, isMe) {
    ctx.save(); ctx.translate(p.x, p.y);

    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(p.name, 0, -p.radius - 25);
    ctx.fillText(p.name, 0, -p.radius - 25);

    ctx.fillStyle = '#333'; ctx.fillRect(-25, -p.radius - 15, 50, 8);
    ctx.fillStyle = '#4caf50'; ctx.fillRect(-25, -p.radius - 15, (p.health / p.maxHealth) * 50, 8);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(-25, -p.radius - 15, 50, 8);

    ctx.rotate(p.angle);

    let weaponExtend = p.isAttacking ? 15 : 0; 
    let handPunch = p.isAttacking ? 8 : 0;

    ctx.save();
    ctx.translate(0, weaponExtend); 

    if (p.selectedSlot === 0) {
        ctx.translate(p.radius + 10, 0); 
        ctx.rotate(Math.PI / 4); 

        let swordGrad = ctx.createLinearGradient(0, 0, 0, -50);
        swordGrad.addColorStop(0, '#e0e0e0');
        swordGrad.addColorStop(1, '#fafafa');
        
        ctx.fillStyle = swordGrad;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        
        ctx.beginPath(); 
        ctx.moveTo(-6, -10);
        ctx.lineTo(-4, -55);
        ctx.lineTo(0, -65); 
        ctx.lineTo(4, -55);
        ctx.lineTo(6, -10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#cfb53b'; 
        ctx.fillRect(-12, -10, 24, 6);
        ctx.strokeRect(-12, -10, 24, 6);

        ctx.fillStyle = '#5c4033';
        ctx.fillRect(-4, -4, 8, 16);
        ctx.strokeRect(-4, -4, 8, 16);
    } else if (p.selectedSlot === 1) {
        ctx.fillStyle = '#ff4747'; ctx.strokeStyle = '#8a1111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.radius + 15, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2e8a11'; 
        ctx.beginPath(); ctx.ellipse(p.radius + 15, -10, 6, 3, Math.PI/4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = '#fbc093'; 
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;

    ctx.beginPath(); ctx.arc(p.radius - 5, p.radius - 5 + handPunch, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.radius - 5, -p.radius + 5, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function render() {
    const me = gameState.players[myId];
    if (me) {
        drawGrid(me);

        ctx.save();
        ctx.translate(window.innerWidth / 2 - me.x, window.innerHeight / 2 - me.y);

        gameState.structures.forEach(s => {
            if (s.type === 'trap') drawSploopTrap(s.x, s.y, s.radius);
            else if (s.type === 'spike') drawSploopSpike(s.x, s.y, s.radius);
            else if (s.type === 'wall') {
                ctx.fillStyle = '#8d5524';
                ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2); ctx.fill();
                ctx.lineWidth = 3; ctx.strokeStyle = '#4e2f13'; ctx.stroke();
            }
        });

        gameState.resources.forEach(r => {
            if (r.type === 'tree') drawSploopTree(r.x, r.y, r.radius);
            else if (r.type === 'stone') drawSploopStone(r.x, r.y, r.radius);
            else if (r.type === 'gold') drawSploopGold(r.x, r.y, r.radius);
        });

        for (let id in gameState.players) {
            drawSploopPlayer(gameState.players[id], id === myId);
        }

        ctx.restore();
        drawJoysticks();
    }
    requestAnimationFrame(render);
}

function drawJoysticks() {
    if (leftTouch.active) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath(); ctx.arc(leftTouch.originX, leftTouch.originY, 60, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath(); ctx.arc(leftTouch.currX, leftTouch.currY, 25, 0, Math.PI*2); ctx.fill();
    }
    if (rightTouch.active) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.1)';
        ctx.beginPath(); ctx.arc(rightTouch.originX, rightTouch.originY, 60, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
        ctx.beginPath(); ctx.arc(rightTouch.currX, rightTouch.currY, 25, 0, Math.PI*2); ctx.fill();
    }
}
