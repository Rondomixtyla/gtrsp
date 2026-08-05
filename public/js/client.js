const socket = io();
const canvas = document.createElement('canvas');
canvas.id = 'gameCanvas';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

let myId = null;
let gameState = { players: {}, resources: [], structures: [] };
let selectedSlot = 0;
let inputs = { up: false, down: false, left: false, right: false };
let playerAngle = 0;

// Mobil Joystick Değişkenleri
let leftTouchId = null;
let rightTouchId = null;
let joystickLeftOrigin = { x: 0, y: 0 };
let joystickLeftCurrent = { x: 0, y: 0 };
let joystickRightOrigin = { x: 0, y: 0 };
let joystickRightCurrent = { x: 0, y: 0 };

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

document.getElementById('play-normal').onclick = () => startGame(false);
document.getElementById('play-sandbox').onclick = () => startGame(true);

function startGame(isSandbox) {
    const name = document.getElementById('nickname-input').value;
    socket.emit('joinGame', { name, isSandbox });
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    if (isSandbox) document.getElementById('sandbox-btn').classList.remove('hidden');
}

function selectSlot(slot) {
    selectedSlot = slot;
    document.querySelectorAll('.slot').forEach((el, idx) => {
        if (idx === slot) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function toggleModal(id) { document.getElementById(id).classList.toggle('active'); }
function giveSandboxRes() { socket.emit('sandboxGiveRes'); }
function buyHat(hat) { socket.emit('buyHat', hat); toggleModal('shop-modal'); }
function createClan() {
    const name = document.getElementById('clan-name-input').value;
    if (name) { socket.emit('createClan', name); toggleModal('clan-modal'); }
}

// Mobil Saldırı Butonu
const attackBtn = document.getElementById('attack-btn');
attackBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    socket.emit('action');
});

// MOBİL TOUCH EVENTLERİ
window.addEventListener('touchstart', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.target.closest('#ui-container, .modal, #start-menu')) continue;

        if (touch.clientX < window.innerWidth / 2 && leftTouchId === null) {
            leftTouchId = touch.identifier;
            joystickLeftOrigin = { x: touch.clientX, y: touch.clientY };
            joystickLeftCurrent = { x: touch.clientX, y: touch.clientY };
        } else if (touch.clientX >= window.innerWidth / 2 && rightTouchId === null && touch.target !== attackBtn) {
            rightTouchId = touch.identifier;
            joystickRightOrigin = { x: touch.clientX, y: touch.clientY };
            joystickRightCurrent = { x: touch.clientX, y: touch.clientY };
        }
    }
});

window.addEventListener('touchmove', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === leftTouchId) {
            joystickLeftCurrent = { x: touch.clientX, y: touch.clientY };
            const dx = joystickLeftCurrent.x - joystickLeftOrigin.x;
            const dy = joystickLeftCurrent.y - joystickLeftOrigin.y;
            inputs.left = dx < -15; inputs.right = dx > 15;
            inputs.up = dy < -15; inputs.down = dy > 15;
        }
        if (touch.identifier === rightTouchId) {
            joystickRightCurrent = { x: touch.clientX, y: touch.clientY };
            const dx = joystickRightCurrent.x - joystickRightOrigin.x;
            const dy = joystickRightCurrent.y - joystickRightOrigin.y;
            if (Math.hypot(dx, dy) > 10) playerAngle = Math.atan2(dy, dx);
        }
    }
});

function resetJoystick(id) {
    if (id === leftTouchId) { leftTouchId = null; inputs = { up: false, down: false, left: false, right: false }; }
    if (id === rightTouchId) { rightTouchId = null; }
}
window.addEventListener('touchend', e => { for (let i = 0; i < e.changedTouches.length; i++) resetJoystick(e.changedTouches[i].identifier); });
window.addEventListener('touchcancel', e => { for (let i = 0; i < e.changedTouches.length; i++) resetJoystick(e.changedTouches[i].identifier); });

// Chat İşlemi
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        socket.emit('chatMsg', chatInput.value); chatInput.value = '';
    }
});
socket.on('chatMessage', data => {
    const box = document.getElementById('chat-messages');
    box.innerHTML += `<div><b>${data.name}:</b> ${data.text}</div>`;
    box.scrollTop = box.scrollHeight;
});

socket.on('init', data => { myId = data.id; requestAnimationFrame(render); });
socket.on('gameState', state => {
    gameState = state;
    socket.emit('playerInput', { inputs, angle: playerAngle, selectedSlot });
});

// ==========================================
// PROFESSIONAL SPLOOP.IO DETAILED GRAPHICS
// ==========================================

// Zemin Çizimi (Grid + Izgara)
function drawEnvironment(me) {
    ctx.fillStyle = '#6b8e23'; // Sploop Yeşil Zemin
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 2;
    const gridSize = 80;
    const offsetX = (canvas.width / 2 - me.x) % gridSize;
    const offsetY = (canvas.height / 2 - me.y) % gridSize;

    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

// Gerçekçi Ağaç Çizimi
function drawTree(r) {
    ctx.save();
    ctx.translate(r.x, r.y);

    // Dış Gölge
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(5, 5, r.radius, 0, Math.PI * 2); ctx.fill();

    // Ana Yeşil Gövde Yaprak Katmanları (3 Katmanlı Fırfırlı Yapı)
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath(); ctx.arc(0, 0, r.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#1b4332'; ctx.stroke();

    ctx.fillStyle = '#40916c';
    ctx.beginPath(); ctx.arc(-5, -5, r.radius * 0.7, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#52b788';
    ctx.beginPath(); ctx.arc(-10, -10, r.radius * 0.4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

// Gerçekçi Kaya / Taş Çizimi
function drawStone(r) {
    ctx.save();
    ctx.translate(r.x, r.y);

    // Koyu Taban & Gölge
    ctx.fillStyle = '#495057';
    ctx.beginPath(); ctx.arc(0, 0, r.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#212529'; ctx.stroke();

    // İç Köşeli Kaya Desenleri
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.moveTo(-r.radius*0.5, -r.radius*0.5);
    ctx.lineTo(r.radius*0.4, -r.radius*0.6);
    ctx.lineTo(r.radius*0.7, r.radius*0.3);
    ctx.lineTo(-r.radius*0.2, r.radius*0.7);
    ctx.closePath();
    ctx.fill();

    // Işık Yansıması
    ctx.fillStyle = '#adb5bd';
    ctx.beginPath(); ctx.arc(-r.radius*0.3, -r.radius*0.3, r.radius*0.25, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

// Gerçekçi Altın Madeni Çizimi
function drawGold(r) {
    ctx.save();
    ctx.translate(r.x, r.y);

    // Koyu Taban
    ctx.fillStyle = '#d97706';
    ctx.beginPath(); ctx.arc(0, 0, r.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#78350f'; ctx.stroke();

    // Parlak Altın Yüzey
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(-2, -2, r.radius * 0.75, 0, Math.PI * 2); ctx.fill();

    // Altın Parıltı Noktaları
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(-r.radius*0.3, -r.radius*0.3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r.radius*0.2, r.radius*0.2, 4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

// Yapılar (Spike & Ahşap Duvar)
function drawStructure(s) {
    ctx.save();
    ctx.translate(s.x, s.y);

    if (s.type === 'wall') {
        // Ahşap Duvar Katmanları
        ctx.fillStyle = '#854d0e';
        ctx.beginPath(); ctx.arc(0, 0, s.radius, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#451a03'; ctx.stroke();
        
        ctx.fillStyle = '#a16207';
        ctx.fillRect(-s.radius+6, -s.radius+6, (s.radius-6)*2, (s.radius-6)*2);
    } else if (s.type === 'spike') {
        // Dikenli Tuzak (Spike)
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.arc(0, 0, s.radius, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#0f172a'; ctx.stroke();

        // Sivri Dikenler (8 Yöne Sivri Uç)
        ctx.fillStyle = '#94a3b8';
        for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(0, -s.radius);
            ctx.lineTo(-6, -s.radius - 12);
            ctx.lineTo(6, -s.radius - 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    ctx.restore();
}

// Oyuncu ve Eller
function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Oyuncu İsmi
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 3.5;
    ctx.strokeText(p.name, 0, -42); ctx.fillText(p.name, 0, -42);

    // Can Barı
    ctx.fillStyle = '#0f172a'; ctx.fillRect(-22, -33, 44, 6);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(-22, -33, (p.health / p.maxHealth) * 44, 6);

    ctx.rotate(p.angle);

    // Elde Tutulan Eşya & Vuruş
    ctx.save();
    let swing = p.isAttacking ? Math.sin(performance.now() * 0.1) * 0.8 : 0;
    ctx.rotate(swing);

    ctx.lineWidth = 4; ctx.strokeStyle = '#1e293b';

    if (p.selectedSlot === 0) {
        // Detaylı Çelik Kılıç
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(15, -6); ctx.lineTo(55, -7); ctx.lineTo(68, 0); ctx.lineTo(55, 7); ctx.lineTo(15, 6);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // Kılıç Kabzası
        ctx.fillStyle = '#b45309';
        ctx.fillRect(10, -10, 6, 20); ctx.strokeRect(10, -10, 6, 20);
    } else if (p.selectedSlot === 1) {
        // Elma
        ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(30, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.selectedSlot === 2) {
        // Duvar Mini Görseli
        ctx.fillStyle = '#854d0e'; ctx.fillRect(20, -10, 20, 20); ctx.strokeRect(20, -10, 20, 20);
    } else if (p.selectedSlot === 3) {
        // Spike Mini Görseli
        ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(28, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Sol ve Sağ El (Hands)
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath(); ctx.arc(14, 16, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(26, 4, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Oyuncu Gövdesi
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#1e293b'; ctx.stroke();

    ctx.restore();
}

function drawJoysticks() {
    if (leftTouchId !== null) {
        ctx.save();
        ctx.beginPath(); ctx.arc(joystickLeftOrigin.x, joystickLeftOrigin.y, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.beginPath(); ctx.arc(joystickLeftCurrent.x, joystickLeftCurrent.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.fill();
        ctx.restore();
    }
    if (rightTouchId !== null) {
        ctx.save();
        ctx.beginPath(); ctx.arc(joystickRightOrigin.x, joystickRightOrigin.y, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.beginPath(); ctx.arc(joystickRightCurrent.x, joystickRightCurrent.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; ctx.fill();
        ctx.restore();
    }
}

function render() {
    const me = gameState.players[myId];
    if (me) {
        drawEnvironment(me);

        ctx.save();
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);

        // 1. Kaynaklar (Ağaç, Taş, Altın)
        gameState.resources.forEach(r => {
            if (r.type === 'tree') drawTree(r);
            else if (r.type === 'stone') drawStone(r);
            else if (r.type === 'gold') drawGold(r);
        });

        // 2. Yapılar (Duvar & Spike)
        gameState.structures.forEach(s => drawStructure(s));

        // 3. Oyuncular
        for (let id in gameState.players) {
            drawPlayer(gameState.players[id]);
        }

        ctx.restore();
        drawJoysticks();
    }
    requestAnimationFrame(render);
}
