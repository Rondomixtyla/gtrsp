const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 4000;

const players = {};
const resources = [];
const structures = [];

// Haritaya kaynak türetme (Ağaç, Taş, Altın)
for (let i = 0; i < 120; i++) {
    resources.push({
        id: 'res_' + i,
        x: Math.random() * (MAP_SIZE - 400) + 200,
        y: Math.random() * (MAP_SIZE - 400) + 200,
        type: Math.random() > 0.4 ? 'tree' : (Math.random() > 0.5 ? 'stone' : 'gold'),
        radius: 35,
        health: 100
    });
}

// Windmill (Değirmen) Altın Üretimi
setInterval(() => {
    for (let id in players) {
        let p = players[id];
        let myWindmills = structures.filter(s => s.ownerId === id && s.type === 'windmill');
        p.resources.gold += myWindmills.length * 2;
    }
}, 1000);

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * (MAP_SIZE - 400) + 200,
        y: Math.random() * (MAP_SIZE - 400) + 200,
        radius: 35,
        angle: 0,
        speed: 5,
        health: 100,
        maxHealth: 100,
        inputs: { up: false, down: false, left: false, right: false },
        resources: { wood: 100, stone: 50, gold: 0, food: 5 },
        selectedSlot: 0,
        autoAttack: false,
        isAttacking: false
    };

    socket.emit('init', { id: socket.id, mapSize: MAP_SIZE, resources, structures });

    socket.on('playerInput', (data) => {
        const p = players[socket.id];
        if (!p) return;
        p.inputs = data.inputs;
        p.angle = data.angle;
        if (data.selectedSlot !== undefined) p.selectedSlot = data.selectedSlot;
        if (data.autoAttack !== undefined) p.autoAttack = data.autoAttack;
    });

    socket.on('quickHeal', () => {
        const p = players[socket.id];
        if (p && p.resources.food > 0 && p.health < p.maxHealth) {
            p.resources.food--;
            p.health = Math.min(p.maxHealth, p.health + 25);
        }
    });

    socket.on('attackAction', () => {
        const p = players[socket.id];
        if (!p) return;

        p.isAttacking = true;

        if (p.selectedSlot === 0) {
            resources.forEach(res => {
                let dist = Math.hypot(res.x - p.x, res.y - p.y);
                if (dist < p.radius + res.radius + 35) {
                    res.health -= 25;
                    if (res.type === 'tree') p.resources.wood += 20;
                    else if (res.type === 'stone') p.resources.stone += 15;
                    else if (res.type === 'gold') p.resources.gold += 10;

                    if (res.health <= 0) {
                        res.x = Math.random() * (MAP_SIZE - 400) + 200;
                        res.y = Math.random() * (MAP_SIZE - 400) + 200;
                        res.health = 100;
                    }
                }
            });

            for (let id in players) {
                if (id !== socket.id) {
                    let target = players[id];
                    let dist = Math.hypot(target.x - p.x, target.y - p.y);
                    if (dist < p.radius + target.radius + 20) {
                        target.health -= 20;
                        if (target.health <= 0) {
                            target.health = target.maxHealth;
                            target.x = Math.random() * (MAP_SIZE - 400) + 200;
                            target.y = Math.random() * (MAP_SIZE - 400) + 200;
                        }
                    }
                }
            }
        } else if (p.selectedSlot >= 1 && p.selectedSlot <= 4) {
            const costs = [
                {},
                { wood: 20 },
                { wood: 15, stone: 10 },
                { wood: 25, stone: 15 },
                { wood: 50, stone: 30 }
            ];
            const types = ['', 'wall', 'spike', 'trap', 'windmill'];
            const cost = costs[p.selectedSlot];
            const type = types[p.selectedSlot];

            let canAfford = true;
            for (let res in cost) {
                if (p.resources[res] < cost[res]) canAfford = false;
            }

            if (canAfford) {
                for (let res in cost) p.resources[res] -= cost[res];

                const placeX = p.x + Math.cos(p.angle) * 70;
                const placeY = p.y + Math.sin(p.angle) * 70;

                const newStruct = {
                    id: 'st_' + Math.random().toString(36).substr(2, 9),
                    ownerId: socket.id,
                    x: placeX,
                    y: placeY,
                    type: type,
                    radius: 30,
                    health: 150
                };
                structures.push(newStruct);
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    for (let id in players) {
        const p = players[id];
        let moveX = 0, moveY = 0;

        if (p.inputs.up) moveY -= 1;
        if (p.inputs.down) moveY += 1;
        if (p.inputs.left) moveX -= 1;
        if (p.inputs.right) moveX += 1;

        if (moveX !== 0 && moveY !== 0) {
            moveX *= Math.SQRT1_2;
            moveY *= Math.SQRT1_2;
        }

        p.x = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.x + moveX * p.speed));
        p.y = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.y + moveY * p.speed));
    }

    io.emit('gameState', { players, resources, structures });
}, 1000 / 60);

server.listen(PORT, () => console.log(`Sunucu aktif: http://localhost:${PORT}`));
