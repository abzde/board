var express = require('express')
  , app = express()
  , mongoose = require('mongoose').connect('mongodb://localhost/board')
  , db = mongoose.connection
  , server = require('http').createServer(app).listen(5880)
  , io = require('socket.io').listen(server)
  , crypto = require('crypto')
  , boards = {}
  , cachedItems = {}
  , boardSchema = {
      name: String,
      secret: String,
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
      board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
      modified: { type: Number, default: Date.now }
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

function doCallback(callback, response) {
    if (typeof callback === "function") {
        callback(response);
    }
}

function genName(callback, cur) {
    var possible = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      , cur = cur || '';

    Board.count({ name: cur }, function (err, count) {
        if (err) throw err;

        if (count == 0 && cur) {
            doCallback(callback, cur);
        } else {
            cur += possible.charAt(Math.floor(Math.random() * possible.length))
            genName(callback, cur);
        }
    });
}

io.sockets.on('connection', function (socket) {
    
        
    socket.on('join', function (data, fn) {
        if (inRoom(socket)) return doCallback(fn, false);
        if (!data) return doCallback(fn, false);
        
        Board.findOne({name: data.name || ''}).populate('items').exec(function (err, board) {
            if (err) throw err;
            
            if (board) {
                socket.join('board:' + board._id);
                console.log(board);
                doCallback(fn, board.toJSON());
            } else {
                genName(function(name) {
                    var secret = crypto.randomBytes(10).toString('hex'),
                        board = new Board({
                            name: name,
                            creator: socket.id,
                            secret: crypto.createHash('sha1').update(secret).digest('hex'),
                            height: data.height || 500,
                            width: data.width || 500
                        }),
                        ret;
                        
                    board.save();
                    socket.join('board:' + board._id);

                    ret = board.toJSON();
                    ret['realSecret'] = secret;
                     
                    doCallback(fn, ret);
                }, data.name || '');
            }
        });
    });

    socket.on('leave', function (data, fn) {
        if(!data || !data.id) return doCallback(fn, false);

        if ('/board:' + data.id in io.sockets.manager.roomClients[socket.id]) {
            socket.leave('/board:' + data.id);
            doCallback(fn, true);
        } else {
            doCallback(fn, false);
        }
    });

    socket.on('add', function(data, fn) {
        if (!data || !data.item || !data.secret) return doCallback(fn, false);

        Board.findOne({_id: data.board}, function (err, board) {
            if (err) throw err;

            if (!board) return doCallback(fn, false);
            console.log(board);
            if (board.secret == crypto.createHash('sha1').update(data.secret).digest('hex')) {
                var item = new Item({
                    x: 0,
                    y: 0,
                    text: data.item,
                    board: data.board,
                    modified: Date.now()
                });
                item.save()
                board.items.push(item);
                board.save();
                
                var json = item.toJSON()
                
                doCallback(fn, json);
                socket.broadcast.to('board:' + board._id).emit('update', json);
            } else {
                doCallback(fn, false);
            }
        });
    });

    socket.on('lock', function (data, fn) {
        if (!data || !data.id) return doCallback(fn, false);
        
        Item.findOne({ _id: data.id })
            .select('lock board')
            .exec(function (err, item) {
                if (err) throw err;
                
                if (!item) return doCallback(fn, false);

                if (!('/board:' + item.board in io.sockets.manager.roomClients[socket.id])) 
                    return doCallback(fn, false);
                
                if (!item.lock || !(item.lock in socket.manager.connected)) {
                    Item.update({ _id: data.id }, {lock: socket.id}, function (err, num, raw) {
                        if (err) throw err;
                        socket.broadcast.to('board:' + item.board).emit('lock', { id: data.id });
                        doCallback(fn, true);
                    });
                } else {
                    doCallback(fn, false);
                }
            });
    });

    function doDrag(item, x, y) {
        console.log(item, x, y);
        if (item && item.lock == socket.id) {
            item.x = parseInt(x) || item.x;
            item.y = parseInt(y) || item.y;
            console.log('broadcasting'); 
            socket.broadcast.to('board:' + item.board).emit('update', item.toJSON());
        }
    }

    socket.on('drag', function(data) {
        console.log('drag');
        if (!data || !data.id || !data.x || !data.y) return;

        if (!(data.id in cachedItems)) {
            Item.findOne({ _id: data.id }, function (err, item) {
                if (err) throw err; 

                if (item) {
                    cachedItems[data.id] = item;
                    doDrag(item, data.x, data.y);
                }
            });
        } else {
            doDrag(cachedItems[data.id], data.x, data.y);
        }
    });


    socket.on('move', function(data, fn) {
        if (!data || !data.id || !data.x || !data.y) return doCallback(fn, false);

        Item.findOne({_id: data.id}, function (err, item) {
            if (err) throw err;

            if (item) {
                if (item.lock == socket.id) {
                    item.x = data.x;
                    item.y = data.y;
                    item.lock = '';
                    item.modified = Date.now();
                    item.save();
                    
                    var json = item.toJSON();
                    delete cachedItems[item.id];
                    socket.broadcast.to('board:' + item.board)
                                 .emit('update', item.toJSON());
                    doCallback(fn, json);
                } else {
                    doCallback(fn, item.toJSON());
                }
            } else {
                doCallback(fn, false);
            }
        });
    });

});
