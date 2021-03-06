var boardClient = (function($) {
    var socket = io.connect()
      , board = {}
      , items = {}
      , boardElem
      , statusElem
      , lastDrag = 0;

    
    socket.on('lock', function(data) {
        items[data.id].addClass('locked');
    }).on('update', function(data) {
        console.log('update');
        console.log(data);
        updateItem(data);
    }).on('connect', function() {
        checkHash();
    }).on('plusone', function() { 
        board.count++;
        console.log('++');
        statusElem.text('connected: ' + board.count);
    }).on('minusone', function() {
        board.count--;
        console.log('--');
        statusElem.html('connected: ' + board.count);
    });
  
    function addItem(item, secret) {
        socket.emit('add', { board: board._id, item: item, secret: secret }, updateItem);
    }

    function startDrag() {
        elem = this;
        socket.emit('lock', { id: this.id }, function(ret) { 
            if (ret) { 
                $(elem).addClass('active'); 
                lastDrag = Date.now();
            } else {
                resetItem($(elem));
            }
        });
    }
    function dragX() {
        if (Date.now() > lastDrag + 100) {
            var position = $(this).position();
            socket.emit('drag', { id: this.id, x: position.left, y: position.top });
            lastDrag = Date.now();
        }
    }

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
        statusElem = $("#status");
        
        boardElem = $("#board");

        $(window).on('hashchange', function(e) {
            checkHash();
        });

        $("#addBtn").on('click', function() {
            addItem($("#addText").val(), $("#addSecret").val());
        });
    }

    function updateItem(data) {
        if (!data) return;
        
        if (!(data._id in items)) {
            items[data._id] = $("<div></div>")
                              .attr('id', data._id)
                              .addClass('item')
                              .appendTo(boardElem)
                              .css({ top: data.y, left:data.x })
                              .draggable({containment: 'parent',
                                          stack: '#board div',
                                          start: startDrag,
                                          drag: dragX,
                                          stop: stopDrag})
        }
        
        items[data._id].animate({ top: data.y, left: data.x }, { duration: 100 })
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
        console.log(board);
        window.location.hash = "#" + data.name;
        boardElem.width(data.width);
        boardElem.height(data.height);
        statusElem.text('connected: ' + board.count);

        if (board.realSecret) {
            $("#addSecret").val(board.realSecret);
        }

        for (item in items) {
            if (items.hasOwnProperty(item)) {
                items[item].remove();
            }
        }
        for (var item = 0; item < data.items.length; item++) {
            updateItem(data.items[item]);
        }
    }


    return {
        init: init,
        socket: socket,
        addItem: addItem,
        updateBoard: updateBoard,
        updateItem: updateItem
    }
})(jQuery);

$(document).ready(function() {
    boardClient.init();
});

