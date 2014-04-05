var express = require('express')
  , app = express()
  , mongoose = require('mongoose').connect('mongodb://localhost/board')
  , db = mongoose.connection
  , server = require('http').createServer(app).listen(5880)
  , io = require('socket.io').listen(server)
  , fs = require('fs')
  , boards = {}
  , boardSchema = {
      creator: String, 
      width: Number, 
      height: Number, 
      items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }]
  }
  , itemSchema = {
      x: Number, 
      y: Number, 
      text: String, 
      lock: String, 
      board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' }
  }
  , Board
  , Item;

db.once('open', function() {
    Board = mongoose.model('Board', boardSchema);
    Item = mongoose.model('Item', itemSchema);
});


app.enable('trust proxy')

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});



function inRoom(socket) {
    var rooms = io.sockets.manager.roomClients[socket.id];
    for (room in rooms) {
        if (room.hasOwnProperty(room) && room != '') {
            return true;
        }
    }
    return false;
}

io.sockets.on('connection', function (socket) {
    
    socket.on('mkboard', function(fn) {
        if (inRoom(socket)) return fn && fn(false);

        var board = new Board({
            creator: socket.id,
            width: 500,
            height: 500,
        });
        board.save();
        socket.join('board:' + board._id);
        fn && fn(board.toJSON()); 
    });
        
    socket.on('join', function (id, fn) {
        if (inRoom(socket)) return fn && fn(false);
        if (!id) return fn && fn(false);
        
        Board.findOne({_id: id}).populate('items').exec(function (err, board) {
            if (err) throw err;

            if (board) {
                socket.join('board:' + board._id);
                fn && fn(board.toJSON());
            } else {
                fn && fn(false);
            }
        });
    });

    socket.on('add', function(data, fn) {
        if (!data) return fn && fn(false);
        Board.findOne({_id: data.board}, function (err, board) {
            if (err ) throw err;

            if (!board) return fn && fn(false);
            
            if (board.creator == socket.id || !(board.creator in socket.manager.connected)) {
                var item = new Item({
                    x: 0,
                    y: 0,
                    text: data.item,
                    board: data.board
                });
                item.save()
                board.items.push(item);
                board.save();
                
                var json = item.toJSON()
                
                fn && fn(json);
                socket.broadcast.to('board:' + board._id).emit('update', json);
            } else {
                fn && fn(false);
            }
        });
    });

    socket.on('lock', function (id, fn) {
        if (!id) return fn && fn(false);
        Item.findOne({_id: id})
            .select('lock board')
            .exec(function (err, item) {
                if (err) throw err;
                
                if (!('/board:' + item.board in io.sockets.manager.roomClients[socket.id])) 
                    return fn && fn(false);
                
                if (!item.lock || !(item.lock in socket.manager.connected)) {
                    Item.update({_id: id}, {lock: socket.id}, function (err, num, raw) {
                        if (err) throw err;
                        socket.broadcast.to('board:' + item.board).emit('lock', id);
                        fn && fn(true);
                    });
                } else {
                    fn && fn(false);
                }
            });
    });

    socket.on('move', function(data, fn) {
        if (!data) return;

        Item.findOne({_id: data.id}, function (err, item) {
            if (err) throw err;

            if (item) {
                if (item.lock == socket.id) {
                    item.x = data.x;
                    item.y = data.y;
                    item.lock = '';
                    item.save();
                    
                    var json = item.toJSON();

                    socket.broadcast.to('board:' + item.board)
                                 .emit('update', item.toJSON());
                    fn && fn(json);
                } else {
                    fn && fn(item.toJSON());
                }
            } else {
                fn && fn(false);
            }
        });
    });
});
