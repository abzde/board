var BoardClient = (function($) {
    var socket = io.connect()
      , board = {}
      , board_elem
      , status_elem;

    socket.on('lock', function(id) {
        console.log(board)
        board[id].addClass('locked');
        resetItem(board[id]);
    }).on('update', function(data) {
        updateItem(data);
    });
/*    .on('plusone', function() { 
        board.connected++;
        status_elem.html('connected: ' + board.connected);
    }).on('minusone', function() {
        board.connected--;
        status_elem.html('connected: ' + board.connected);
    });*/
  
    function addItem(item) {
        console.log(board);
        socket.emit('add', { board: board._id, item: item }, updateItem);
    }

    function resetItem(item) { 
        item.draggable('option', 'revert', true)
            .trigger('mouseup')
            .draggable('option', 'revert', false);
    }
    
    function startDrag() {
        elem = this;
        socket.emit('lock', this.id, function(ret) { 
            if (ret) { 
                $(elem).addClass('active'); 
            } else {
                resetItem($(elem));
            }
        });
    }
    function dragX() {}
    function stopDrag() {
        console.log('stopdrag');
        elem = this;
        position = $(this).position();
        console.log(position);
        $(this).removeClass('active');
        socket.emit('move', { id: this.id, x: position.left, y: position.top }, function(ret) {
            if(ret) {
                updateItem(ret);
            } else {
                console.log('resetting' + ret);
                updateItem(ret);
            }
        });
    }

    function init() {
        status_elem = $("<div></div>")
                       .attr('id', 'status')
                       .appendTo(document.body);

        board_elem = $("<div></div>")
                      .attr('id', 'board')
                      .appendTo(document.body);

        if (window.location.hash) {
            board = window.location.hash;
            board = board.substr(1, board.length-1);
            console.log('joining boad ' + board);
            socket.emit('join', 
                    board,
                    updateBoard);
        } else {
            console.log('making board');
            socket.emit('mkboard', updateBoard);
        }
    }

    function updateItem(data) {
        if (!data) return;
        console.log(data);
        if (!(data._id in board)) {
            board[data._id] = $("<div></div>")
                              .attr('id', data._id)
                              .addClass('item')
                              .appendTo(board_elem)
                              .draggable({containment: 'parent',
                                          stack: '#board div',
                                          start: startDrag,
                                          drag: dragX,
                                          stop: stopDrag})
        }
        board[data._id].css({top: data.y, left: data.x})
                      .html(data.text)
        if (data.lock) {
            board[data._id].addClass('locked');
        } else {
            board[data._id].removeClass('locked');
        }

    }

    function updateBoard(data) {
        if (!data) return;
        
        board = data;
        window.location.hash = "#" + data._id;
        
        board_elem.width(data.width);
        board_elem.height(data.height);
        console.log(data.items);
        for (i = 0; i < data.items.length; i++) {
            updateItem(data.items[i]);
        }
    }


    return {
        init: init,
        socket: socket,
        addItem: addItem
    }
})(jQuery);

$(document).ready(function() {
    BoardClient.init();
});

