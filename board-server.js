var express = require('express')
  , app = express()
  , mongoose = require('mongoose').connect('mongodb://localhost/board')
  , db = mongoose.connection
  , server = require('http').createServer(app).listen(5881)
  , io = require('socket.io').listen(server)
  , fs = require('fs')
  , board = {
      connected: 0,
      width: 500, 
      height: 500, 
      items: {}
    }
  , Item;
io.set('log level', '3'); 
db.once('open', function() {
    Item = mongoose.model('item', {x: Number,
                                   y: Number,
                                   text: String,
                                   lock: String});
    Item.find().exec(function(err, items) {
        for(i=0; i<items.length; i++) {
            board.items[items[i]._id] = items[i].toJSON()
        }
    });
    console.log(board);
});


app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    board.connected++;
    socket.emit('board', board);
    socket.broadcast.emit('plusone');

    socket.on('lock', function (id, fn) {
        console.log('pls lock ' + id)
        Item.findOne({'_id': id}).exec(function(err, item) {
            if (item) {
                lock = item.lock;
                if (!lock || !(lock in socket.manager.connected)) {
                    console.log('lock ' + id);
                    item.lock = socket.id;
                    item.save()
                    board.items[item._id] = item.toJSON()
                    socket.broadcast.emit('lock', id);
                    fn(true);
                } else {
                    fn(false);
                }
            } else {
                fn(false);
            }
        });
    })

    socket.on('move', function(id, x, y, fn) {
        Item.findOne({'_id': id}).exec(function(err, item) { 
            if (item) {
                if (item.lock == socket.id) {
                    console.log('move ' + id + ': ' + x + ',' + y);
                    item.x = x
                    item.y = y
                    item.lock = null;
                    item.save();
                    board.items[item._id] = item.toJSON()
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

    socket.on('disconnect', function() {
        board.connected--;
        socket.broadcast.emit('minusone');
    });
});

