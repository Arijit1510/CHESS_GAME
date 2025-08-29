$(document).ready(function() {
    var board = null;
    var game = new Chess();
    var $status = $('#status');
    var $fen = $('#fen');
    var $moveCount = $('#move-count');
    var $movesHistory = $('#moves-history');
    var $playerColor = $('#player-color');
    var $aiDifficulty = $('#ai-difficulty');
    var $takebackBtn = $('#takeback-btn');
    var moveNumber = 1;
    var playerColor = 'white'; // Default: player plays white
    var aiDifficulty = 'medium'; // Default: medium difficulty
    var selectedSquare = null;
    var highlightedSquares = [];

    function clearHighlights() {
        // Remove all highlights using multiple selectors
        highlightedSquares.forEach(function(square) {
            // Try multiple ways to find the square
            var $square = $('[data-square="' + square + '"]');
            if ($square.length === 0) $square = $('.square-' + square);
            if ($square.length === 0) $square = $('#board [class*="' + square + '"]');
            if ($square.length === 0) $square = $('#board div').filter(function() {
                return $(this).attr('class') && $(this).attr('class').includes(square);
            });
            
            $square.removeClass('highlight-move highlight-capture highlight-possible');
        });
        
        // Also clear any remaining highlights in the board
        $('#board .highlight-move, #board .highlight-capture, #board .highlight-possible')
            .removeClass('highlight-move highlight-capture highlight-possible');
            
        highlightedSquares = [];
        selectedSquare = null;
    }

    function findSquareElement(square) {
        // Try multiple ways to find the square element
        var $square = $('[data-square="' + square + '"]');
        if ($square.length > 0) return $square;
        
        $square = $('.square-' + square);
        if ($square.length > 0) return $square;
        
        $square = $('#board [class*="' + square + '"]');
        if ($square.length > 0) return $square;
        
        $square = $('#board div').filter(function() {
            var className = $(this).attr('class');
            return className && className.includes(square);
        });
        if ($square.length > 0) return $square;
        
        console.log('Could not find square element for:', square);
        return $();
    }

    function highlightPossibleMoves(square) {
        clearHighlights();
        
        var moves = game.moves({
            square: square,
            verbose: true
        });
        
        console.log('Moves for', square, ':', moves);
        
        if (moves.length === 0) return;
        
        // Highlight the selected square
        var $selectedSquare = findSquareElement(square);
        if ($selectedSquare.length > 0) {
            $selectedSquare.addClass('highlight-possible');
            selectedSquare = square;
            highlightedSquares.push(square);
            console.log('Highlighted selected square:', square);
        }
        
        // Highlight possible moves
        moves.forEach(function(move) {
            var $targetSquare = findSquareElement(move.to);
            if ($targetSquare.length > 0) {
                if (move.flags.includes('c') || move.flags.includes('e')) {
                    // Capture move
                    $targetSquare.addClass('highlight-capture');
                    console.log('Added capture highlight to:', move.to);
                } else {
                    // Regular move
                    $targetSquare.addClass('highlight-move');
                    console.log('Added move highlight to:', move.to);
                }
                highlightedSquares.push(move.to);
            }
        });
        
        console.log('All highlighted squares:', highlightedSquares);
    }

    function onSquareClick(square) {
        // do not respond if game is over
        if (game.game_over()) return;
        
        // check if it's the player's turn
        if ((playerColor === 'white' && game.turn() === 'b') ||
            (playerColor === 'black' && game.turn() === 'w')) {
            return;
        }
        
        var piece = game.get(square);
        
        if (selectedSquare) {
            // If a square is already selected, try to make a move
            if (selectedSquare === square) {
                // Clicking the same square - deselect
                clearHighlights();
                return;
            }
            
            // Try to make the move
            var move = game.move({
                from: selectedSquare,
                to: square,
                promotion: 'q' // always promote to queen for simplicity
            });
            
            if (move) {
                // Move was successful
                clearHighlights();
                
                // Add player move to history
                var isWhiteMove = (playerColor === 'white' && game.turn() === 'b') || (playerColor === 'black' && game.turn() === 'w');
                addMoveToHistory(move, isWhiteMove, false);
                
                updateStatus();
                board.position(game.fen());
                
                // Send move to server
                sendMoveToServer(move);
            } else {
                // Invalid move, check if clicked on own piece
                if (piece && 
                    ((playerColor === 'white' && piece.color === 'w') || 
                     (playerColor === 'black' && piece.color === 'b'))) {
                    // Clicked on own piece, highlight its moves
                    highlightPossibleMoves(square);
                } else {
                    // Invalid move and not own piece, clear highlights
                    clearHighlights();
                }
            }
        } else {
            // No square selected, check if clicked on own piece
            if (piece && 
                ((playerColor === 'white' && piece.color === 'w') || 
                 (playerColor === 'black' && piece.color === 'b'))) {
                highlightPossibleMoves(square);
            }
        }
    }

    function onDragStart(source, piece, position, orientation) {
        // Clear highlights when starting drag
        clearHighlights();
        
        // do not pick up pieces if the game is over
        if (game.game_over()) return false;

        // only pick up pieces for the player's color
        var playerPiece = playerColor === 'white' ? 'w' : 'b';
        if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
            (playerColor === 'black' && piece.search(/^w/) !== -1)) {
            return false;
        }
        
        // check if it's the player's turn
        if ((playerColor === 'white' && game.turn() === 'b') ||
            (playerColor === 'black' && game.turn() === 'w')) {
            return false;
        }
    }

    function addMoveToHistory(move, isWhite, isAI = false) {
        var moveText = '';
        if (isWhite) {
            moveText = moveNumber + '. ' + move.san;
        } else {
            moveText = move.san;
            moveNumber++;
        }
        
        var moveClass = isAI ? 'ai-move' : 'player-move';
        var playerLabel = isAI ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        
        if ($movesHistory.find('.no-moves').length > 0) {
            $movesHistory.empty();
        }
        
        $movesHistory.append(
            '<div class="move-entry ' + moveClass + '">' +
                '<span class="player-icon">' + playerLabel + '</span>' +
                '<span class="move-text">' + moveText + '</span>' +
            '</div>'
        );
        
        // Auto-scroll to bottom
        $movesHistory.scrollTop($movesHistory[0].scrollHeight);
        
        // Update move count - use game history length for accuracy
        $moveCount.text(game.history().length);
        
        // Enable takeback button if there are moves to take back
        $takebackBtn.prop('disabled', game.history().length < 2);
    }

    function sendMoveToServer(move) {
        // send the move to the server
        $.ajax({
            url: '/move',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ move: move.from + move.to + (move.promotion || '') }),
            success: function(response) {
                if (response.status === 'Game Over') {
                    // If there's an AI move, make it first before showing game over
                    if (response.ai_move) {
                        var aiMoveStr = response.ai_move;
                        var aiMove = {
                            from: aiMoveStr.substring(0, 2),
                            to: aiMoveStr.substring(2, 4)
                        };
                        if (aiMoveStr.length > 4) {
                            aiMove.promotion = aiMoveStr.substring(4, 5);
                        }
                        var aiMoveObj = game.move(aiMove);
                        
                        // Add AI move to history
                        if (aiMoveObj) {
                            var isAIWhiteMove = (playerColor === 'black' && game.turn() === 'w') || (playerColor === 'white' && game.turn() === 'b');
                            addMoveToHistory(aiMoveObj, isAIWhiteMove, true);
                        }
                        
                        board.position(game.fen());
                    }
                    
                    // Show the game result
                    alert(response.result);
                    updateStatus();
                    return;
                }
                
                if (response.ai_move) {
                    var aiMoveStr = response.ai_move;
                    var aiMove = {
                        from: aiMoveStr.substring(0, 2),
                        to: aiMoveStr.substring(2, 4)
                    };
                    if (aiMoveStr.length > 4) {
                        aiMove.promotion = aiMoveStr.substring(4, 5);
                    }
                    var aiMoveObj = game.move(aiMove);
                    
                    // Add AI move to history
                    if (aiMoveObj) {
                        var isAIWhiteMove = (playerColor === 'black' && game.turn() === 'w') || (playerColor === 'white' && game.turn() === 'b');
                        addMoveToHistory(aiMoveObj, isAIWhiteMove, true);
                    }
                    
                    board.position(game.fen());
                }
                updateStatus();
            },
            error: function(xhr, status, error) {
                console.error("Error:", error);
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    alert("An error occurred: " + xhr.responseJSON.error);
                } else {
                    alert("An error occurred: " + error);
                }
                // undo the move if the server rejects it
                game.undo();
                board.position(game.fen());
                updateStatus();
            }
        });
    }

    function onDrop(source, target) {
        // Clear highlights
        clearHighlights();
        
        // see if the move is legal
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // NOTE: always promote to a queen for simplicity
        });

        // illegal move
        if (move === null) return 'snapback';

        // Add player move to history
        var isWhiteMove = (playerColor === 'white' && game.turn() === 'b') || (playerColor === 'black' && game.turn() === 'w');
        addMoveToHistory(move, isWhiteMove, false);
        
        updateStatus();

        // make the move on the board
        board.position(game.fen());

        // Send move to server
        sendMoveToServer(move);
    }

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    function onSnapEnd() {
        board.position(game.fen());
    }

    function updateStatus() {
        var status = '';

        var moveColor = 'White';
        if (game.turn() === 'b') {
            moveColor = 'Black';
        }

        // checkmate?
        if (game.in_checkmate()) {
            status = 'Game over, ' + moveColor + ' is in checkmate.';
        }

        // draw?
        else if (game.in_draw()) {
            status = 'Game over, drawn position';
        }

        // game still on
        else {
            status = moveColor + ' to move';

            // check?
            if (game.in_check()) {
                status += ', ' + moveColor + ' is in check';
            }
        }

        $status.html(status);
        $fen.html(game.fen());
    }

    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onSquareClick: onSquareClick,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);

    updateStatus();

    function setPlayerColor(color) {
        playerColor = color;
        $playerColor.text(color.charAt(0).toUpperCase() + color.slice(1));
        
        // Update button active states
        $('#play-white-btn').toggleClass('active', color === 'white');
        $('#play-black-btn').toggleClass('active', color === 'black');
        
        // Set board orientation
        board.orientation(playerColor === 'white' ? 'white' : 'black');
        
        $.ajax({
            url: '/set_color',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ color: color }),
            success: function(response) {
                game.reset();
                moveNumber = 1;
                clearHighlights(); // Clear any existing highlights
                $movesHistory.html('<p class="no-moves">No moves yet. ' + (color === 'white' ? 'White' : 'Black') + ' to start!</p>');
                $moveCount.text('0');
                $takebackBtn.prop('disabled', true);
                
                // Handle AI first move if player is black
                if (response.ai_move) {
                    var aiMove = {
                        from: response.ai_move.substring(0, 2),
                        to: response.ai_move.substring(2, 4)
                    };
                    if (response.ai_move.length > 4) {
                        aiMove.promotion = response.ai_move.substring(4, 5);
                    }
                    var aiMoveObj = game.move(aiMove);
                    if (aiMoveObj) {
                        addMoveToHistory(aiMoveObj, true, true);
                    }
                }
                
                board.position(game.fen());
                updateStatus();
            }
        });
    }

    function setAIDifficulty(difficulty) {
        aiDifficulty = difficulty;
        $aiDifficulty.text(difficulty.charAt(0).toUpperCase() + difficulty.slice(1));
        
        // Update button active states
        $('#easy-btn').toggleClass('active', difficulty === 'easy');
        $('#medium-btn').toggleClass('active', difficulty === 'medium');
        $('#hard-btn').toggleClass('active', difficulty === 'hard');
        
        $.ajax({
            url: '/set_difficulty',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ difficulty: difficulty }),
            success: function(response) {
                console.log('Difficulty set to:', difficulty);
            },
            error: function() {
                alert('Failed to set difficulty');
            }
        });
    }

    $('#easy-btn').on('click', function() {
        setAIDifficulty('easy');
    });
    
    $('#medium-btn').on('click', function() {
        setAIDifficulty('medium');
    });
    
    $('#hard-btn').on('click', function() {
        setAIDifficulty('hard');
    });

    $('#play-white-btn').on('click', function() {
        setPlayerColor('white');
    });
    
    $('#play-black-btn').on('click', function() {
        setPlayerColor('black');
    });

    $('#new-game-btn').on('click', function() {
        $.ajax({
            url: '/reset',
            method: 'POST',
            success: function(response) {
                game.reset();
                moveNumber = 1;
                clearHighlights(); // Clear any existing highlights
                $movesHistory.html('<p class="no-moves">No moves yet. ' + (playerColor === 'white' ? 'White' : 'Black') + ' to start!</p>');
                $moveCount.text('0');
                $takebackBtn.prop('disabled', true);
                
                // Handle AI first move if player is black
                if (response.ai_move) {
                    var aiMove = {
                        from: response.ai_move.substring(0, 2),
                        to: response.ai_move.substring(2, 4)
                    };
                    if (response.ai_move.length > 4) {
                        aiMove.promotion = response.ai_move.substring(4, 5);
                    }
                    var aiMoveObj = game.move(aiMove);
                    if (aiMoveObj) {
                        addMoveToHistory(aiMoveObj, true, true);
                    }
                }
                
                board.position(game.fen());
                updateStatus();
            }
        });
    });
    
    $('#takeback-btn').on('click', function() {
        $.ajax({
            url: '/takeback',
            method: 'POST',
            success: function(response) {
                // Take back last 2 moves from game object
                if (game.history().length >= 2) {
                    game.undo(); // AI move
                    game.undo(); // Player move
                    
                    // Clear highlights
                    clearHighlights();
                    
                    // Remove last 2 moves from history display
                    $movesHistory.find('.move-entry').slice(-2).remove();
                    if ($movesHistory.find('.move-entry').length === 0) {
                        $movesHistory.html('<p class="no-moves">No moves yet. ' + (playerColor === 'white' ? 'White' : 'Black') + ' to start!</p>');
                    }
                    
                    // Update move counter and move number
                    if (game.history().length % 2 === 0) {
                        moveNumber = Math.max(1, moveNumber - 1);
                    }
                    $moveCount.text(game.history().length);
                    
                    board.position(game.fen());
                    updateStatus();
                    
                    // Disable takeback if no more moves
                    $takebackBtn.prop('disabled', game.history().length < 2);
                }
            },
            error: function() {
                alert('Cannot take back moves');
            }
        });
    });
    
    $('#flip-board-btn').on('click', function() {
        board.flip();
    });
});
