var BoardClient = (function($) {
    var socket = io.connect()
      , board = {}
      , board_elem
      , status_elem;

    socket.on('board', function(rcv_board) {
        updateBoard(rcv_board);
        board.connected = rcv_board.connected;
        status_elem.html('connected: ' + board.connected);
    }).on('lock', function(id) {
        board[id].addClass('locked');
        resetItem(board[id]);
    }).on('update', function(data) {
        updateItem(data);
    }).on('plusone', function() { 
        board.connected++;
        status_elem.html('connected: ' + board.connected);
    }).on('minusone', function() {
        board.connected--;
        status_elem.html('connected: ' + board.connected);
    });
   
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
        position = board[this.id].position();
        console.log(position);
        socket.emit('move', this.id, position.left, position.top, function(ret) {
            if(ret == true) { 
                $(elem).removeClass('active');
            } else {
                console.log('resetting' + ret);
                $(elem).css({top: ret.y, left: ret.x });
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
    }

    function updateItem(data) {
        console.log(data.lock?'locked':'')
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
        board_elem.width(data.width);
        board_elem.height(data.height);
        for (item in data.items) {
            if (data.items.hasOwnProperty(item)) { 
                updateItem(data.items[item]);
            }
        }
    }


    return {
        init: init,
        socket: socket
    }
})(jQuery);

$(document).ready(function() {
    BoardClient.init();
});

