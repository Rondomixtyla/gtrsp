const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
const structures = [];
const resources = [];

// Harita kaynaklarını oluştur
for(let i = 0; i < 150; i++) {
    resources.push({
        id: i,
        x: Math.random() * 3800 + 100,
        y: Math.random() * 3800 + 100,
        type: Math.random() > 0.4 ? 'tree' : 'stone',
        radius: Math.random() > 0.5 ? 40 : 30,
        health: 100
    });
}

// Windmill altın üretimi döngüsü
setInterval(() => {
    for(let id in players) {
        let p = players[id];
        let myWindmills = structures.filter(s => s.ownerId === id && s.type === 'windmill');
        p.gold += myWindmills.length * 2; // Her windmill saniyede 2 altın verir
    }
    io.emit('updatePlayers', players);
}, 1000);

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 3000 + 500,
        y: Math.random() * 3000 + 500,
        radius: 25,
        angle: 0,
        name: "Oyuncu",
        score: 0,
        gold: 0,
        health: 100,
        maxHealth: 100,
        wood: 100,
        stone: 50,
        attacking: false
    };

    socket.emit('initGame', { players, structures, resources });
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].name = data.name;
            players[socket.id].attacking = data.attacking;
        }
    });

    // Kaynak toplama ve Hasar verme
    socket.on('hitAction', () => {
        let p = players[socket.id];
        if(!p) return;

        // Önündeki kaynakları kontrol et
        resources.forEach(res => {
            let dist = Math.hypot(res.x - p.x, res.y - p.y);
            if(dist < p.radius + res.radius + 40) {
                res.health -= 25;
                if(res.health <= 0) {
                    if(res.type === 'tree') { p.wood += 30; p.score += 50; }
                    else { p.stone += 25; p.score += 50; }
                    res.x = Math.random() * 3800 + 100;
                    res.y = Math.random() * 3800 + 100;
                    res.health = 100;
                    io.emit('updateResources', resources);
                }
            }
        });

        // Diğer oyunculara vurma
        for(let id in players) {
            if(id !== socket.id) {
                let target = players[id];
                let dist = Math.hypot(target.x - p.x, target.y - p.y);
                if(dist < 60) {
                    target.health -= 20;
                    if(target.health <= 0) {
                        p.score += Math.floor(target.score / 2) + 100;
                        p.gold += 50;
                        target.health = target.maxHealth;
                        target.x = Math.random() * 3000 + 500;
                        target.y = Math.random() * 3000 + 500;
                        io.emit('playerKilled', { victim: target.id, killer: p.id });
                    }
                }
            }
        }
        io.emit('updatePlayers', players);
    });

    // Yapı Yerleştirme (Wall, Spike, Trap, Windmill)
    socket.on('placeStructure', (data) => {
        let p = players[socket.id];
        if(!p) return;

        let costWood = 0, costStone = 0;
        if(data.type === 'wall') { costWood = 20; }
        else if(data.type === 'spike') { costWood = 15; costStone = 10; }
        else if(data.type === 'trap') { costWood = 20; costStone = 5; }
        else if(data.type === 'windmill') { costWood = 50; costStone = 30; }

        if(p.wood >= costWood && p.stone >= costStone) {
            p.wood -= costWood;
            p.stone -= costStone;
            
            const newStruct = {
                id: Math.random().toString(),
                ownerId: socket.id,
                x: data.x,
                y: data.y,
                type: data.type,
                radius: 25
            };
            structures.push(newStruct);
            io.emit('structurePlaced', newStruct);
            io.emit('updatePlayers', players);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('removePlayer', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
