const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log(`Oyuncu bağlandı: ${socket.id}`);

    players[socket.id] = {
        x: Math.random() * 3000 + 500,
        y: Math.random() * 3000 + 500,
        radius: 25,
        angle: 0,
        name: "Misafir",
        id: "#" + Math.floor(1000 + Math.random() * 9000),
        score: 0,
        attacking: false
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].name = data.name;
            players[socket.id].score = data.score;
            players[socket.id].attacking = data.attacking;
            socket.broadcast.emit('playerMoved', { id: socket.id, player: players[socket.id] });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Oyuncu ayrıldı: ${socket.id}`);
        delete players[socket.id];
        io.emit('removePlayer', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});
