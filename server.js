const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
const structures = []; // Haritadaki duvarlar/kapanlar

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 3000 + 500,
        y: Math.random() * 3000 + 500,
        radius: 25,
        angle: 0,
        name: "Oyuncu",
        score: 0,
        wood: 100,
        stone: 50,
        attacking: false
    };

    // İlk bağlanan oyuncuya mevcut durumları gönder
    socket.emit('initGame', { players, structures });
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Oyuncu hareket ve durum güncellemesi
    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            Object.assign(players[socket.id], data);
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Yapı koyma etkinliği (Duvar vb.)
    socket.on('placeStructure', (structData) => {
        structures.push(structData);
        io.emit('structurePlaced', structData);
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
