const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const _ = require('lodash');

const Snake = require('./snake');
const Apple = require('./apple');

const app = express();
const server = http.Server(app);
const io = socketIo(server);

let autoId = 0;
const GRID_SIZE = 40;

const rooms = {
  10: [],
  40: [],
  80: []
}; // Rooms for different bet amounts

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/select.html');
});

app.get('/game', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (client) => {
  let player;
  let id;
  let room;

  client.on('auth', (opts, cb) => {
    const { nickname, bet } = opts;

    room = rooms[bet].find(r => r.players.length < 2);

    if (!room) {
      room = {
        id: rooms[bet].length + 1,
        players: [],
        apples: Array.from({ length: 4 }, () => new Apple({
          gridSize: GRID_SIZE,
          snakes: [],
          apples: []
        }))
      };
      rooms[bet].push(room);
    }

    id = ++autoId;
    player = new Snake({
      id,
      dir: 'right',
      gridSize: GRID_SIZE,
      snakes: room.players,
      apples: room.apples,
      nickname
    });
    room.players.push(player);

    cb({ id });

    if (room.players.length === 2) {
      io.to(room.id).emit('start', { players: room.players, apples: room.apples });
    }

    client.join(room.id);
  });

  client.on('key', (key) => {
    if (player) {
      player.changeDirection(key);
    }
  });

  client.on('disconnect', () => {
    if (room) {
      _.remove(room.players, player);
      if (room.players.length === 0) {
        _.remove(rooms[player.bet], room);
      }
    }
  });
});

// Main game loop
setInterval(() => {
  Object.values(rooms).forEach(betRooms => {
    betRooms.forEach(room => {
      room.players.forEach((p) => {
        p.move();
      });

      io.to(room.id).emit('state', {
        players: room.players.map((p) => ({
          x: p.x,
          y: p.y,
          id: p.id,
          points: p.points,
          tail: p.tail,
          nickname: p.nickname
        })),
        apples: room.apples.map((a) => ({
          x: a.x,
          y: a.y
        }))
      });
    });
  });
}, 100);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
