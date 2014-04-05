var BoardClient = (function($) {
    var socket = io.connect()
      , board = {}
      , items = {}
      , boardElem
      , statusElem;

    
    socket.on('lock', function(id) {
        items[id].addClass('locked');
        resetItem(items[id]);
    }).on('update', function(data) {
        updateItem(data);
    }).on('connect', function() {
        checkHash();
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
        socket.emit('move', { id: this.id, x: position.left, y: position.top }, updateItem);
    }

    function checkHash() {
        var currentBoard = location.hash.replace( /^#/, '') || '';
        if (currentBoard) {
            console.log('joining board ' + currentBoard);
            socket.emit('join', 
                    { name: currentBoard },
                    updateBoard);
        } else {
            console.log('making board');
            socket.emit('join', {}, updateBoard);
        }
    }
    
    function init() {
        statusElem = $("<div></div>")
                       .attr('id', 'status')
                       .appendTo(document.body);

        boardElem = $("<div></div>")
                      .attr('id', 'board')
                      .appendTo(document.body);

        $(window).on('hashchange', function(e) {
            checkHash();
        });
    }

    function updateItem(data) {
        if (!data) return;
        
        if (!(data._id in items)) {
            items[data._id] = $("<div></div>")
                              .attr('id', data._id)
                              .addClass('item')
                              .appendTo(boardElem)
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
        for (item in items) {
            if (items.hasOwnProperty(item)) {
                toSort[index] = items[item];
                index++;
            }
        }
        
        toSort.sort(function(a, b) {
            return a.data('modified') - b.data('modified');
        });
        
        $(toSort).each(function(i) {
            $(this).css('zIndex', 1 + i);
        });

    }

    function updateBoard(data) {
        if (!data) return;
        
        board = data;
        window.location.hash = "#" + data.name;
        boardElem.width(data.width);
        boardElem.height(data.height);

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

