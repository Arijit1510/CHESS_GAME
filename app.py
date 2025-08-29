from flask import Flask, request, jsonify, send_from_directory
import chess
from engine.engine import get_best_move

app = Flask(__name__, static_url_path='', static_folder='../frontend/static')

# Initialize a new board
board = chess.Board()
player_color = chess.WHITE  # Default: player plays white, AI plays black
ai_difficulty = 'medium'  # Default difficulty

# Serve the main page
@app.route('/')
def index():
    return send_from_directory('../frontend/static', 'index.html')

# API endpoint to make a move
@app.route('/move', methods=['POST'])
def make_move():
    global board, player_color
    # Get the move from the request
    move_uci = request.json.get('move')
    
    print(f"Received move: {move_uci}")
    print(f"Board turn: {board.turn}, Player color: {player_color}")
    print(f"Board FEN: {board.fen()}")
    
    # Check if it's the player's turn
    if board.turn != player_color:
        print(f"Turn error: board.turn={board.turn}, player_color={player_color}")
        return jsonify({'error': f'Not your turn. Board turn: {board.turn}, Your color: {player_color}'}), 400
    
    # Check if the move is valid
    try:
        move = chess.Move.from_uci(move_uci)
    except:
        return jsonify({'error': 'Invalid move format'}), 400

    # If the move is not legal, return an error
    if move not in board.legal_moves:
        return jsonify({'error': 'Illegal move'}), 400

    # Make the player's move
    board.push(move)

    # Check for game over
    if board.is_game_over():
        result = get_game_result(board)
        return jsonify({'status': 'Game Over', 'result': result, 'fen': board.fen()})

    # Get the AI's move based on difficulty
    difficulty_settings = {
        'easy': 1,
        'medium': 3,
        'hard': 5
    }
    depth = difficulty_settings.get(ai_difficulty, 3)
    ai_move = get_best_move(board, depth)
    if ai_move:
        board.push(ai_move)
    else:
        return jsonify({'error': 'AI could not find a valid move'}), 500

    # Check for game over again after AI's move
    if board.is_game_over():
        result = get_game_result(board)
        return jsonify({'status': 'Game Over', 'result': result, 'fen': board.fen(), 'ai_move': ai_move.uci()})

    # Return the new board state and the AI's move
    return jsonify({
        'fen': board.fen(),
        'ai_move': ai_move.uci(),
        'status': 'Success'
    })

# API endpoint to set AI difficulty
@app.route('/set_difficulty', methods=['POST'])
def set_difficulty():
    global ai_difficulty
    difficulty = request.json.get('difficulty')
    if difficulty in ['easy', 'medium', 'hard']:
        ai_difficulty = difficulty
        return jsonify({'status': 'Difficulty set', 'difficulty': difficulty})
    else:
        return jsonify({'error': 'Invalid difficulty'}), 400

# API endpoint to set player color
@app.route('/set_color', methods=['POST'])
def set_color():
    global player_color, board
    color = request.json.get('color')
    if color == 'white':
        player_color = chess.WHITE
    elif color == 'black':
        player_color = chess.BLACK
    else:
        return jsonify({'error': 'Invalid color'}), 400
    
    # Reset board when changing color
    board.reset()
    
    # If player chose black, make AI move first
    ai_move = None
    if player_color == chess.BLACK:
        difficulty_settings = {
            'easy': 1,
            'medium': 3,
            'hard': 5
        }
        depth = difficulty_settings.get(ai_difficulty, 3)
        ai_move = get_best_move(board, depth)
        if ai_move:
            board.push(ai_move)
    
    return jsonify({
        'status': 'Color set',
        'fen': board.fen(),
        'player_color': 'white' if player_color == chess.WHITE else 'black',
        'ai_move': ai_move.uci() if ai_move else None
    })

# API endpoint to reset the board
@app.route('/reset', methods=['POST'])
def reset_board():
    global board, player_color
    board.reset()
    
    # If player is black, make AI move first
    ai_move = None
    if player_color == chess.BLACK:
        difficulty_settings = {
            'easy': 1,
            'medium': 3,
            'hard': 5
        }
        depth = difficulty_settings.get(ai_difficulty, 3)
        ai_move = get_best_move(board, depth)
        if ai_move:
            board.push(ai_move)
    
    return jsonify({
        'status': 'Board reset', 
        'fen': board.fen(),
        'ai_move': ai_move.uci() if ai_move else None
    })

# API endpoint for takeback
@app.route('/takeback', methods=['POST'])
def takeback():
    global board
    if len(board.move_stack) < 2:
        return jsonify({'error': 'Not enough moves to take back'}), 400
    
    # Take back both player and AI moves
    board.pop()  # AI move
    board.pop()  # Player move
    
    return jsonify({
        'status': 'Moves taken back',
        'fen': board.fen()
    })

# Get the game result
def get_game_result(board):
    if board.is_checkmate():
        if board.turn == chess.WHITE:
            return "Black wins by checkmate!"
        else:
            return "White wins by checkmate!"
    elif board.is_stalemate():
        return "Draw by stalemate"
    elif board.is_insufficient_material():
        return "Draw by insufficient material"
    elif board.is_seventyfive_moves():
        return "Draw by 75-move rule"
    elif board.is_fivefold_repetition():
        return "Draw by fivefold repetition"
    else:
        return "Game over"

if __name__ == '__main__':
    app.run(debug=True, port=5001)
