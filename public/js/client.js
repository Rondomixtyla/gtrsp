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

// Çift Mobil Joystick Kontrol Değişkenleri
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

// MOBİL ÇİFT JOYSTICK TOUCH MOTORU
window.addEventListener('touchstart', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // UI elemanlarına dokunuluyorsa joystick oluşturma
        if (touch.target.closest('#ui-container, .modal, #start-menu')) continue;

        // Sol Taraf -> Hareket Joystick'i
        if (touch.clientX < window.innerWidth / 2 && leftTouchId === null) {
            leftTouchId = touch.identifier;
            joystickLeftOrigin = { x: touch.clientX, y: touch.clientY };
            joystickLeftCurrent = { x: touch.clientX, y: touch.clientY };
        }
        // Sağ Taraf -> Nişan/Açı Joystick'i
        else if (touch.clientX >= window.innerWidth / 2 && rightTouchId === null && touch.target !== attackBtn) {
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

            inputs.left = dx < -15;
            inputs.right = dx > 15;
            inputs.up = dy < -15;
            inputs.down = dy > 15;
        }

        if (touch.identifier === rightTouchId) {
            joystickRightCurrent = { x: touch.clientX, y: touch.clientY };
            const dx = joystickRightCurrent.x - joystickRightOrigin.x;
            const dy = joystickRightCurrent.y - joystickRightOrigin.y;
            if (Math.hypot(dx, dy) > 10) {
                playerAngle = Math.atan2(dy, dx);
            }
        }
    }
});

function resetJoystick(id) {
    if (id === leftTouchId) {
        leftTouchId = null;
        inputs = { up: false, down: false, left: false, right: false };
    }
    if (id === rightTouchId) {
        rightTouchId = null;
    }
}

window.addEventListener('touchend', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        resetJoystick(e.changedTouches[i].identifier);
    }
});
window.addEventListener('touchcancel', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        resetJoystick(e.changedTouches[i].identifier);
    }
});

// Chat İşlemi
const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        socket.emit('chatMsg', chatInput.value);
        chatInput.value = '';
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

// Joystick Görsel Çizimi
function drawJoysticks() {
    if (leftTouchId !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(joystickLeftOrigin.x, joystickLeftOrigin.y, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.stroke();

        ctx.beginPath();
        ctx.arc(joystickLeftCurrent.x, joystickLeftCurrent.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fill();
        ctx.restore();
    }

    if (rightTouchId !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(joystickRightOrigin.x, joystickRightOrigin.y, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.stroke();

        ctx.beginPath();
        ctx.arc(joystickRightCurrent.x, joystickRightCurrent.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 87, 87, 0.7)'; ctx.fill();
        ctx.restore();
    }
}

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // İsim
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(p.name, 0, -42); ctx.fillText(p.name, 0, -42);

    // Can Barı
    ctx.fillStyle = '#1e293b'; ctx.fillRect(-22, -32, 44, 5);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(-22, -32, (p.health / p.maxHealth) * 44, 5);

    ctx.rotate(p.angle);

    // Elde Tutulan Silah / Obje Çizimi
    ctx.save();
    let swing = p.isAttacking ? Math.sin(performance.now() * 0.08) * 0.9 : 0;
    ctx.rotate(Math.PI / 4 + swing);
    ctx.lineWidth = 4; ctx.strokeStyle = '#1d1d1d';

    if (p.selectedSlot === 0) {
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(50, -6); ctx.lineTo(62, 0); ctx.lineTo(50, 6); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (p.selectedSlot === 1) {
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(28, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.selectedSlot === 2) {
        ctx.fillStyle = '#78350f'; ctx.fillRect(18, -10, 20, 20); ctx.strokeRect(18, -10, 20, 20);
    } else if (p.selectedSlot === 3) {
        ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(26, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Eller
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(10, 10, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(22, 3, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Gövde
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1d1d1d'; ctx.stroke();

    ctx.restore();
}

function render() {
    const me = gameState.players[myId];
    ctx.fillStyle = '#7ca942';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (me) {
        ctx.save();
        ctx.translate(canvas.width / 2 - me.x, canvas.height / 2 - me.y);

        // Kaynaklar
        gameState.resources.forEach(r => {
            ctx.save(); ctx.translate(r.x, r.y);
            ctx.fillStyle = r.type === 'tree' ? '#52b788' : (r.type === 'stone' ? '#6c757d' : '#ffb703');
            ctx.beginPath(); ctx.arc(0, 0, r.radius, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = '#1d1d1d'; ctx.stroke();
            ctx.restore();
        });

        // Yapılar
        gameState.structures.forEach(s => {
            ctx.save(); ctx.translate(s.x, s.y);
            ctx.fillStyle = s.type === 'wall' ? '#78350f' : '#475569';
            ctx.beginPath(); ctx.arc(0, 0, s.radius, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 4; ctx.strokeStyle = '#1d1d1d'; ctx.stroke();
            ctx.restore();
        });

        // Oyuncular
        for (let id in gameState.players) {
            drawPlayer(gameState.players[id]);
        }

        ctx.restore();

        // Dokunulan yere çizilen dinamik joystickler
        drawJoysticks();
    }
    requestAnimationFrame(render);
}
