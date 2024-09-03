const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected...`)

    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    socket.on('ready-to-call', (room) => {
        console.log(`User ${socket.id} is ready to call in room: ${room}`);
        socket.to(room).emit('ready-to-call', socket.id);  // Notify others in the room
    });

    socket.on('offer', (offer, room) => {
        console.log(`User ${socket.id} sent offer...`)
        socket.to(room).emit('offer', offer, socket.id);  // Emit to everyone in the room except the sender
    });

    socket.on('answer', (answer, room) => {
        console.log(`User ${socket.id} sent answer...`)
        socket.to(room).emit('answer', answer, socket.id);  // Emit to everyone in the room except the sender
    });

    socket.on('ice-candidate', (candidate, room) => {
        console.log(`User ${socket.id} sent Ice Candidate...`)
        socket.to(room).emit('ice-candidate', candidate, socket.id);  // Emit to everyone in the room except the sender
    });

    socket.on('end-call', (room) => {
        console.log(`User ${socket.id} ended the call in room: ${room}`);
        socket.to(room).emit('call-ended', socket.id);
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected...`)
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
