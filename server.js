const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
const resources = [];
const buildings = [];

for (let i = 0; i < 30; i++) {
    resources.push({
        id: i,
        x: Math.random() * 1800 + 100,
        y: Math.random() * 1800 + 100,
        type: Math.random() > 0.4 ? 'wood' : 'stone',
        hp: 100
    });
}

io.on('connection', (socket) => {
    console.log('Yeni oyuncu katıldı:', socket.id);

    players[socket.id] = {
        x: Math.random() * 1000 + 200,
        y: Math.random() * 1000 + 200,
        wood: 50,
        stone: 50,
        hp: 100,
        angle: 0
    };

    socket.emit('init', { id: socket.id, players, resources, buildings });
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    socket.on('playerMove', (data) => {
        const p = players[socket.id];
        if (p) {
            p.x += data.dx;
            p.y += data.dy;
            p.angle = data.angle;
            io.emit('playerMoved', { id: socket.id, x: p.x, y: p.y, angle: p.angle });
        }
    });

    socket.on('hit', () => {
        const p = players[socket.id];
        if (!p) return;

        resources.forEach((res) => {
            const dist = Math.hypot(p.x - res.x, p.y - res.y);
            if (dist < 70) {
                res.hp -= 25;
                if (res.type === 'wood') p.wood += 10;
                if (res.type === 'stone') p.stone += 10;

                socket.emit('updateStats', { wood: p.wood, stone: p.stone, hp: p.hp });

                if (res.hp <= 0) {
                    res.hp = 100;
                    res.x = Math.random() * 1800 + 100;
                    res.y = Math.random() * 1800 + 100;
                }
                io.emit('updateResources', resources);
            }
        });
    });

    socket.on('buildWall', () => {
        const p = players[socket.id];
        if (p && p.wood >= 10) {
            p.wood -= 10;
            const wallX = p.x + Math.cos(p.angle) * 50;
            const wallY = p.y + Math.sin(p.angle) * 50;

            const newBuilding = { id: Date.now(), x: wallX, y: wallY, type: 'wall' };
            buildings.push(newBuilding);

            socket.emit('updateStats', { wood: p.wood, stone: p.stone, hp: p.hp });
            io.emit('newBuilding', newBuilding);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 Oyun Sunucusu Çalışıyor!\nAdres: http://localhost:${PORT}\n`);
});
