var BoardClient = (function($) {
    var socket = io.connect()
      , board = {}
      , items = {}
      , board_elem
      , status_elem;

    socket.on('lock', function(id) {
        items[id].addClass('locked');
        resetItem(items[id]);
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
        elem = this;
        position = $(this).position();
        $(this).removeClass('active');
        socket.emit('move', { id: this.id, x: position.left, y: position.top }, function(ret) {
            if(ret) {
                updateItem(ret);
            } else {
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
            socket.emit('join', 
                    board,
                    updateBoard);
        } else {
            socket.emit('mkboard', updateBoard);
        }
    }

    function updateItem(data) {
        if (!data) return;
        console.log(data);
        if (!(data._id in items)) {
            items[data._id] = $("<div></div>")
                              .attr('id', data._id)
                              .addClass('item')
                              .appendTo(board_elem)
                              .draggable({containment: 'parent',
                                          stack: '#board div',
                                          start: startDrag,
                                          drag: dragX,
                                          stop: stopDrag})
        }
        items[data._id].css({top: data.y, left: data.x})
                       .data('modified', data.modified)
                      .text(data.text);
        if (data.lock) {
            items[data._id].addClass('locked');
        } else {
            items[data._id].removeClass('locked');
        }

        var toSort = []
          , index = 0;
        console.log('items');
        console.log(items);
        for (item in items) {
            if (items.hasOwnProperty(item)) {
                toSort[index] = items[item];
                index++;
            }
        }
        console.log(toSort);
        toSort.sort(function(a, b) {
            return a.data('modified') - b.data('modified');
        });
        console.log(toSort);
        $(toSort).each(function(i) {
            $(this).css('zIndex', 1 + i);
        });

    }

    function updateBoard(data) {
        if (!data) return;
        
        board = data;
        window.location.hash = "#" + data._id;
        board_elem.width(data.width);
        board_elem.height(data.height);
        for (var item = 0; item < data.items.length; item++) {
            updateItem(data.items[item]);
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

