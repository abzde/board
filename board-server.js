var express = require('express')
  , app = express()
  , server = require('http').createServer(app).listen(5881)
  , io = require('socket.io').listen(server)
  , fs = require('fs')
  , board = {
      width: 500, 
      height: 500, 
      items: {
                1: {id: 1, x: 0, y: 0, text: 'foo'},
                2: {id: 2, x: 20, y: 20, text: 'bar'},
                3: {id: 3, x: 20, y: 20, text: 'game'},
                4: {id: 4, x: 20, y: 20, text: 'the'},
                5: {id: 5, x: 20, y: 20, text: 'baz'},
                6: {id: 6, x: 20, y: 20, text: '<3'}
      }
    };


app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    socket.emit('board', board);
    socket.on('lock', function (id, fn) {
        if (board.items.hasOwnProperty(id)) {
            lock = board.items[id].lock;
            if (!lock || !(lock in socket.manager.connected)) {
                console.log('lock ' + id);
                board.items[id].lock = socket.id;
                socket.broadcast.emit('lock', id);
                fn(true);
            } else {
                fn(false);
            }
        } else {
            fn(false);
        }
    })
    socket.on('move', function(id, x, y, fn) {
        if (board.items.hasOwnProperty(id)) {
            if (board.items[id].lock == socket.id) {
                console.log('move ' + id + ': ' + x + ',' + y);
                board.items[id].x = x
                board.items[id].y = y
                console.log(board.items[id])
                board.items[id].lock = false;
                io.sockets.emit('update', board.items[id]);
                fn(true);
            } else {
                fn(board.items[id]);
            }
        } else {
            fn(board.items[id]);
        }
    });
});

