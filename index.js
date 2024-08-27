const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('offer', (offer, room) => {
    socket.to(room).emit('offer', offer);  // Emit to everyone in the room except the sender
  });

  socket.on('answer', (answer, room) => {
    socket.to(room).emit('answer', answer);  // Emit to everyone in the room except the sender
  });

  socket.on('ice-candidate', (candidate, room) => {
    socket.to(room).emit('ice-candidate', candidate);  // Emit to everyone in the room except the sender
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
