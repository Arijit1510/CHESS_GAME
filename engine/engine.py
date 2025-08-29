import chess
import random
import os
from stockfish import Stockfish

# Initialize Stockfish engine
stockfish_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stockfish', 'stockfish-ubuntu-x86-64-avx2')
stockfish = None

def init_stockfish():
    global stockfish
    try:
        stockfish = Stockfish(path=stockfish_path, parameters={
            "Threads": 2,
            "Minimum Thinking Time": 500,
            "Hash": 16
        })
        return True
    except Exception as e:
        print(f"Failed to initialize Stockfish: {e}")
        return False

# Find the best move using Stockfish with difficulty-based parameters
def get_best_move(board, depth=3):
    global stockfish
    
    # Initialize Stockfish if not already done
    if stockfish is None:
        if not init_stockfish():
            # Fallback to random or simple move if Stockfish fails
            return get_fallback_move(board, depth)
    
    try:
        # Configure Stockfish based on difficulty (depth)
        if depth <= 1:
            # Easy - very limited search, add some randomness
            stockfish.set_depth(1)
            moves = list(board.legal_moves)
            if len(moves) > 3 and random.random() < 0.3:
                # 30% chance to play a random move for easy mode
                return random.choice(moves)
        elif depth <= 3:
            # Medium - balanced play
            stockfish.set_depth(depth)
        else:
            # Hard - strong play
            stockfish.set_depth(min(depth, 8))  # Cap at 8 for performance
        
        # Set the current position
        stockfish.set_fen_position(board.fen())
        
        # Get the best move
        best_move_uci = stockfish.get_best_move()
        
        if best_move_uci:
            # Convert UCI string to chess.Move object
            best_move = chess.Move.from_uci(best_move_uci)
            
            # Verify the move is legal
            if best_move in board.legal_moves:
                return best_move
    
    except Exception as e:
        print(f"Stockfish error: {e}")
    
    # Fallback to simpler move selection if Stockfish fails
    return get_fallback_move(board, depth)

def get_fallback_move(board, depth):
    """Fallback move selection when Stockfish is unavailable"""
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        return None
    
    if depth <= 1:
        # Easy - random move
        return random.choice(legal_moves)
    elif depth <= 3:
        # Medium - prefer captures and checks
        captures = [move for move in legal_moves if board.is_capture(move)]
        checks = [move for move in legal_moves if board.gives_check(move)]
        
        if captures and random.random() < 0.7:
            return random.choice(captures)
        elif checks and random.random() < 0.5:
            return random.choice(checks)
        else:
            return random.choice(legal_moves)
    else:
        # Hard - prefer good moves (captures, checks, center control)
        scored_moves = []
        for move in legal_moves:
            score = 0
            if board.is_capture(move):
                score += 10
            if board.gives_check(move):
                score += 5
            # Prefer center squares
            if move.to_square in [chess.E4, chess.E5, chess.D4, chess.D5]:
                score += 3
            scored_moves.append((move, score))
        
        # Sort by score and pick from top moves
        scored_moves.sort(key=lambda x: x[1], reverse=True)
        top_moves = [move for move, score in scored_moves[:3]]
        return random.choice(top_moves) if top_moves else random.choice(legal_moves)
