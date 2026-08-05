const socket = io();
const canvas = document.createElement('canvas');
canvas.id = 'gameCanvas';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

let myId = null;
let gameState = { players: {}, resources: [], structures: [] };
let selectedSlot = 0;
let inputs = { up: false, down: false, left: false, right: false };
let mouseAngle = 0;
let isSandboxMode = false;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

document.getElementById('play-normal').onclick = () => startGame(false);
document.getElementById('play-sandbox').onclick = () => startGame(true);

function startGame(isSandbox) {
    isSandboxMode = isSandbox;
    const name = document.getElementById('nickname-input').value;
    socket.emit('joinGame', { name, isSandbox });
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('ui-container').classList.remove('hidden');
    if (isSandbox) document.getElementById('sandbox-btn').classList.remove('hidden');
}

window.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'W') inputs.up = true;
    if (e.key === 's' || e.key === 'S') inputs.down = true;
    if (e.key === 'a' || e.key === 'A') inputs.left = true;
    if (e.key === 'd' || e.key === 'D') inputs.right = true;
    if (['1','2','3','4','5'].includes(e.key)) selectSlot(parseInt(e.key) - 1);
});

window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'W') inputs.up = false;
    if (e.key === 's' || e.key === 'S') inputs.down = false;
    if (e.key === 'a' || e.key === 'A') inputs.left = false;
    if (e.key === 'd' || e.key === 'D') inputs.right = false;
});

window.addEventListener('mousemove', e => {
    mouseAngle = Math.atan2(e.clientY - canvas.height / 2, e.clientX - canvas.width / 2);
});

window.addEventListener('mousedown', () => {
    socket.emit('action');
});

function selectSlot(slot) {
    selectedSlot = slot;
    document.querySelectorAll('.slot').forEach((el, idx) => {
        if (idx === slot) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function toggleModal(id) {
    document.getElementById(id).classList.toggle('active');
}

function giveSandboxRes() { socket.emit('sandboxGiveRes'); }
function buyHat(hat) { socket.emit('buyHat', hat); toggleModal('shop-modal'); }
function createClan() {
    const name = document.getElementById('clan-name-input').value;
    if (name) { socket.emit('createClan', name); toggleModal('clan-modal'); }
}

// Chat Girişi
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
    socket.emit('playerInput', { inputs, angle: mouseAngle, selectedSlot });
});

// Çizim Fonksiyonları
function drawWeaponOrItem(slot, isAttacking) {
    ctx.save();
    let swing = isAttacking ? Math.sin(performance.now() * 0.08) * 0.9 : 0;
    ctx.rotate(Math.PI / 4 + swing);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1d1d1d';

    if (slot === 0) {
        // Silah (Kılıç)
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(55, -6); ctx.lineTo(68, 0); ctx.lineTo(55, 6); ctx.lineTo(10, 5); ctx.closePath();
        ctx.fill(); ctx.stroke();
    } else if (slot === 1) {
        // Elde Elma Gösterme
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(32, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (slot === 2) {
        // Elde Odun Duvar
        ctx.fillStyle = '#78350f';
        ctx.fillRect(20, -12, 24, 24); ctx.strokeRect(20, -12, 24, 24);
    } else if (slot === 3) {
        // Elde Spike (Dikenli Tuzak)
        ctx.fillStyle = '#475569';
        ctx.beginPath(); ctx.arc(30, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.arc(30, 0, 7, 0, Math.PI * 2); ctx.fill();
    }

    // Eller
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(24, 4, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    ctx.restore();
}

function drawPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // İsim
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(p.name, 0, -45); ctx.fillText(p.name, 0, -45);

    // Can Barı
    ctx.fillStyle = '#1e293b'; ctx.fillRect(-25, -35, 50, 6);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(-25, -35, (p.health / p.maxHealth) * 50, 6);

    ctx.rotate(p.angle);

    // Elde ne varsa onu çiz
    drawWeaponOrItem(p.selectedSlot, p.isAttacking);

    // Gövde
    ctx.fillStyle = '#e6b88a';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#1d1d1d'; ctx.stroke();

    // Şapka Efekti
    if (p.hat === 'boost') {
        ctx.fillStyle = '#eab308';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
}

function render() {
    const me = gameState.players[myId];
    if (me) {
        ctx.fillStyle = '#7ca942';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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

        // Yapılar (Spike / Duvarlar)
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
    }
    requestAnimationFrame(render);
}
