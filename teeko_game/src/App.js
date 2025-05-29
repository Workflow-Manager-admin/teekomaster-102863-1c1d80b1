import React, { useState, useEffect } from 'react';
import './App.css';

// -- CONSTANTS --
const BOARD_SIZE = 5;
const HUMAN = 'R'; // Human: Red
const AI = 'B';    // AI: Black
const EMPTY = null;
const DROP_COUNT = 4;  // Pieces to drop per player
const DELAYS = {
  ai: 600 // AI "thinking" delay in ms
};
const COLORS = {
  R: 'var(--kavia-orange)', // red/orange
  B: '#23272f',             // dark (for black)
};

// -- HELPERS --

// PUBLIC_INTERFACE
function initBoard() {
  // Returns a new empty 5x5 board
  return Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
}

// PUBLIC_INTERFACE
function countPieces(board, player) {
  // Returns number of pieces a player has on the board
  return board.flat().filter(x => x === player).length;
}

// PUBLIC_INTERFACE
function cloneBoard(board) {
  return board.map(row => [...row]);
}

// PUBLIC_INTERFACE
function isDropPhase(board) {
  // Drop phase: both players have placed <= DROP_COUNT pieces
  return (
    countPieces(board, HUMAN) < DROP_COUNT ||
    countPieces(board, AI) < DROP_COUNT
  );
}

// Returns all winning positions (vertical/horizontal/diag 4 and 2x2 square)
function getWinningPatterns() {
  const wins = [];
  // Lines of 4: Horizontal, Vertical, Diagonal
  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j <= BOARD_SIZE - 4; ++j) {
      // Horizontal rows
      wins.push([[i, j],[i, j+1],[i, j+2],[i, j+3]]);
    }
  }
  for (let j = 0; j < BOARD_SIZE; ++j) {
    for (let i = 0; i <= BOARD_SIZE - 4; ++i) {
      // Vertical cols
      wins.push([[i, j],[i+1, j],[i+2, j],[i+3, j]]);
    }
  }
  // Diagonals
  for (let i = 0; i <= BOARD_SIZE - 4; ++i) {
    for (let j = 0; j <= BOARD_SIZE - 4; ++j) {
      wins.push([[i, j],[i+1, j+1],[i+2, j+2],[i+3, j+3]]);
      wins.push([[i+3, j],[i+2, j+1],[i+1, j+2],[i, j+3]]);
    }
  }
  // 2x2 Squares
  for (let i = 0; i < BOARD_SIZE - 1; ++i) {
    for (let j = 0; j < BOARD_SIZE - 1; ++j) {
      wins.push([[i,j],[i+1,j],[i,j+1],[i+1,j+1]]);
    }
  }
  return wins;
}
const WIN_PATTERNS = getWinningPatterns();

// PUBLIC_INTERFACE
function checkWin(board, player) {
  // Returns true if the player has a winning configuration
  for (const pattern of WIN_PATTERNS) {
    if (pattern.every(([x,y]) => board[x][y] === player)) return true;
  }
  return false;
}

// PUBLIC_INTERFACE
function availableDrops(board) {
  // Drop: any empty square
  const choices = [];
  for (let i = 0; i < BOARD_SIZE; ++i)
    for (let j = 0; j < BOARD_SIZE; ++j)
      if (board[i][j] === EMPTY)
        choices.push([i, j]);
  return choices;
}

// PUBLIC_INTERFACE
function availableMoves(board, player) {
  // Move: for each player's piece, try to slide it to any neighbor empty cell (8 directions)
  const moves = [];
  for (let i = 0; i < BOARD_SIZE; ++i)
    for (let j = 0; j < BOARD_SIZE; ++j)
      if (board[i][j] === player) {
        for (let dx = -1; dx <= 1; ++dx)
          for (let dy = -1; dy <= 1; ++dy) {
            if (dx === 0 && dy === 0) continue;
            let nx = i + dx, ny = j + dy;
            if (
              nx >= 0 &&
              nx < BOARD_SIZE &&
              ny >= 0 &&
              ny < BOARD_SIZE &&
              board[nx][ny] === EMPTY
            ) {
              moves.push({from:[i,j], to:[nx,ny]});
            }
          }
      }
  return moves;
}

// PUBLIC_INTERFACE
function makeMove(board, move) {
  // Modifies board: either drop or slide
  const next = cloneBoard(board);
  if (move.drop) {
    const [x, y, who] = move.drop;
    next[x][y] = who;
  } else if (move.slide) {
    const [[fx,fy],[tx,ty],who] = move.slide;
    next[fx][fy] = EMPTY;
    next[tx][ty] = who;
  }
  return next;
}

// PUBLIC_INTERFACE
function getOpponent(player) {
  return (player === HUMAN) ? AI : HUMAN;
}

// Heuristic: (+∞ = win, -∞ = lose, with sophisticated pattern evaluation)
// PUBLIC_INTERFACE
function evaluateBoard(board, player) {
  const opponent = getOpponent(player);
  
  // Terminal states
  if (checkWin(board, player)) return 100000;
  if (checkWin(board, opponent)) return -100000;
  
  // Initialize score
  let score = 0;
  
  // --- Strategic position evaluation ---
  // Center control is important in Teeko
  const centerPositions = [[2,2], [1,2], [2,1], [3,2], [2,3]];
  for (const [x, y] of centerPositions) {
    if (board[x][y] === player) {
      score += (x === 2 && y === 2) ? 15 : 8; // Center is most valuable
    } else if (board[x][y] === opponent) {
      score -= (x === 2 && y === 2) ? 15 : 8;
    }
  }
  
  // Positional evaluation based on board regions
  // The corners and edges are less valuable than more central positions
  const positionValue = [
    [1, 2, 3, 2, 1],
    [2, 5, 6, 5, 2],
    [3, 6, 10, 6, 3],
    [2, 5, 6, 5, 2],
    [1, 2, 3, 2, 1]
  ];
  
  // Apply positional values to both players
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === player) {
        score += positionValue[i][j] / 2;
      } else if (board[i][j] === opponent) {
        score -= positionValue[i][j] / 2;
      }
    }
  }
  
  // --- Mobility evaluation ---
  // More available moves is better
  if (!isDropPhase(board)) {
    const myMoves = availableMoves(board, player).length;
    const theirMoves = availableMoves(board, opponent).length;
    score += (myMoves - theirMoves) * 3; // Increased weight for mobility
  }
  
  // --- Pattern recognition ---
  // Advanced pattern evaluation with weights based on piece proximity and tactical value
  for (const patt of WIN_PATTERNS) {
    const positions = patt.map(([x, y]) => board[x][y]);
    const myCount = positions.filter(pos => pos === player).length;
    const theirCount = positions.filter(pos => pos === opponent).length;
    const emptyCount = positions.filter(pos => pos === EMPTY).length;
    
    // Only evaluate patterns where victory is still possible for either player
    if (myCount > 0 && theirCount === 0) {
      // My potential winning patterns
      switch (myCount) {
        case 3: score += 80;  // Near win - extremely high priority
          break;
        case 2: score += 15;  // Strong position
          if (isAdjacentPair(patt, board, player)) score += 10;  // Adjacent pieces are stronger
          break;
        case 1: score += 3;   // Minor advantage
          break;
      }
    }
    
    if (theirCount > 0 && myCount === 0) {
      // Opponent's potential winning patterns - block them!
      switch (theirCount) {
        case 3: score -= 75;  // Imminent threat - must block!
          break;
        case 2: score -= 12;   // Emerging threat
          if (isAdjacentPair(patt, board, opponent)) score -= 8;  // Adjacent pairs are dangerous
          break;
        case 1: score -= 2;   // Minor disadvantage
          break;
      }
    }
    
    // Special case: squares are very powerful in Teeko
    if (isSquarePattern(patt)) {
      if (myCount === 3 && theirCount === 0) score += 25;  // Near square completion
      if (theirCount === 3 && myCount === 0) score -= 25;  // Threat of opponent square
      
      // Partial square formations are valuable too
      if (myCount === 2 && theirCount === 0 && isCornerAdjacentPair(patt, board, player)) {
        score += 8; // Corner-adjacent pieces in a square pattern
      }
    }
  }
  
  // --- Piece configuration evaluation ---
  score += evaluatePieceFormation(board, player);
  score -= evaluatePieceFormation(board, opponent);
  
  return score;
}

// Helper function to check if two pieces form an adjacent corner (diagonal) in a square pattern
function isCornerAdjacentPair(pattern, board, player) {
  if (!isSquarePattern(pattern)) return false;
  
  // For a square pattern, check if two opposite corners are occupied
  const occupied = pattern.filter(([x, y]) => board[x][y] === player);
  if (occupied.length !== 2) return false;
  
  // Check if the occupied positions are diagonal to each other
  const [p1, p2] = occupied;
  return Math.abs(p1[0] - p2[0]) === 1 && Math.abs(p1[1] - p2[1]) === 1;
}

// Helper function to check if pieces in a pattern are adjacent to each other
function isAdjacentPair(pattern, board, player) {
  for (let i = 0; i < pattern.length; i++) {
    for (let j = i + 1; j < pattern.length; j++) {
      const [x1, y1] = pattern[i];
      const [x2, y2] = pattern[j];
      if (
        board[x1][y1] === player && 
        board[x2][y2] === player &&
        Math.abs(x1 - x2) <= 1 && 
        Math.abs(y1 - y2) <= 1
      ) {
        return true;
      }
    }
  }
  return false;
}

// Helper function to detect if a pattern is a 2x2 square
function isSquarePattern(pattern) {
  if (pattern.length !== 4) return false;
  
  // Check if the pattern forms a square by ensuring all coordinates differ by at most 1
  const xs = pattern.map(p => p[0]);
  const ys = pattern.map(p => p[1]);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return maxX - minX === 1 && maxY - minY === 1;
}

// Evaluate the overall formation of pieces (compactness, control)
function evaluatePieceFormation(board, player) {
  let score = 0;
  let positions = [];
  
  // Collect all piece positions
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === player) {
        positions.push([i, j]);
      }
    }
  }
  
  // No pieces or just one piece
  if (positions.length <= 1) return 0;
  
  // Calculate piece cohesion (prefer pieces that are closer together)
  // This encourages forming patterns that could lead to wins
  let totalDistance = 0;
  let connections = 0;
  let adjacentPairs = 0;
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [x1, y1] = positions[i];
      const [x2, y2] = positions[j];
      const distance = Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
      
      // Consider pieces as "connected" if they're at most 2 steps away
      if (distance <= 2) {
        connections++;
        
        // Adjacent pieces are especially valuable
        if (distance === 1) {
          adjacentPairs++;
          score += 4;
        }
      }
      
      totalDistance += distance;
    }
  }
  
  // Prefer formations with more connections between pieces
  score += connections * 2;
  
  // Check for specific formation patterns
  if (adjacentPairs >= 2 && positions.length >= 3) {
    // Potential for forming winning patterns
    score += 5;
  }
  
  // L-shapes and diagonal patterns are strong in Teeko
  if (positions.length >= 3 && detectStrongFormation(positions)) {
    score += 8;
  }
  
  // Prefer compact formations over spread out ones
  if (positions.length > 1) {
    const avgDistance = totalDistance / (positions.length * (positions.length - 1) / 2);
    score -= Math.round(avgDistance * 2);
  }
  
  return score;
}

// Detect strong formations like L-shapes or diagonal sequences
function detectStrongFormation(positions) {
  // Check for L-shapes (3 pieces where 2 form a corner)
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      if (i === j) continue;
      
      const [x1, y1] = positions[i];
      const [x2, y2] = positions[j];
      
      // Check if i and j form a corner
      if ((Math.abs(x1 - x2) === 1 && Math.abs(y1 - y2) === 0) || 
          (Math.abs(x1 - x2) === 0 && Math.abs(y1 - y2) === 1)) {
        
        // Look for a third piece that completes an L with these two
        for (let k = 0; k < positions.length; k++) {
          if (k === i || k === j) continue;
          
          const [x3, y3] = positions[k];
          
          // Check if k forms an L with i and j
          if ((x3 === x1 && Math.abs(y3 - y1) === 1 && x2 !== x3) || 
              (y3 === y1 && Math.abs(x3 - x1) === 1 && y2 !== y3) ||
              (x3 === x2 && Math.abs(y3 - y2) === 1 && x1 !== x3) ||
              (y3 === y2 && Math.abs(x3 - x2) === 1 && y1 !== y3)) {
            return true;
          }
        }
      }
    }
  }
  
  // Check for diagonal sequences (3 in a diagonal)
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      if (i === j) continue;
      
      const [x1, y1] = positions[i];
      const [x2, y2] = positions[j];
      
      // Check if i and j are on a diagonal
      if (Math.abs(x1 - x2) === 1 && Math.abs(y1 - y2) === 1) {
        // Look for a third piece that extends this diagonal
        for (let k = 0; k < positions.length; k++) {
          if (k === i || k === j) continue;
          
          const [x3, y3] = positions[k];
          
          // Check if k continues the diagonal from i through j
          if ((x3 - x2 === x2 - x1 && y3 - y2 === y2 - y1) || 
              (x1 - x2 === x2 - x3 && y1 - y2 === y2 - y3)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// PUBLIC_INTERFACE
function getValidMoves(board, player) {
  return isDropPhase(board)
    ? availableDrops(board).map(([x,y]) => ({drop: [x, y, player]}))
    : availableMoves(board, player).map(({from, to}) => ({slide: [from, to, player]}));
}

// ------ MINIMAX WITH ALPHA-BETA ------

// Enhanced minimax with more sophisticated move evaluation and pruning
function minimax(board, player, depth, alpha, beta, maximizing) {
  // Check for terminal states first for immediate cutoffs
  if (checkWin(board, player)) return [100000, null];
  if (checkWin(board, getOpponent(player))) return [-100000, null];
  
  // Depth limit reached
  if (depth === 0) {
    return [evaluateBoard(board, player), null];
  }
  
  // Get valid moves for the current player
  const currentPlayer = maximizing ? player : getOpponent(player);
  const moves = getValidMoves(board, currentPlayer);
  
  if (moves.length === 0) {
    // No legal moves -- game is a draw
    return [0, null];
  }
  
  // Pre-evaluate moves for move ordering (search better moves first for better pruning)
  const scoredMoves = moves.map(move => {
    const nextState = makeMove(board, move);
    const quickScore = quickEvaluate(nextState, maximizing ? player : getOpponent(player));
    return { move, score: quickScore };
  });
  
  // Sort moves by potential (maximize or minimize based on current player)
  if (maximizing) {
    scoredMoves.sort((a, b) => b.score - a.score); // Best moves first for maximizing player
  } else {
    scoredMoves.sort((a, b) => a.score - b.score); // Best moves first for minimizing player
  }
  
  let bestMove = null;
  
  if (maximizing) {
    let maxEval = -Infinity;
    
    for (const { move } of scoredMoves) {
      const nextState = makeMove(board, move);
      
      // Check for immediate win after this move
      if (checkWin(nextState, currentPlayer)) {
        return [100000, move]; // Return immediately on a winning move
      }
      
      const [evalScore] = minimax(nextState, player, depth - 1, alpha, beta, false);
      
      if (evalScore > maxEval) {
        maxEval = evalScore;
        bestMove = move;
      }
      
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    
    return [maxEval, bestMove];
  } else {
    let minEval = +Infinity;
    
    for (const { move } of scoredMoves) {
      const nextState = makeMove(board, move);
      
      // Check for immediate win after this move
      if (checkWin(nextState, currentPlayer)) {
        return [-100000, move]; // Return immediately on a winning move for opponent
      }
      
      const [evalScore] = minimax(nextState, player, depth - 1, alpha, beta, true);
      
      if (evalScore < minEval) {
        minEval = evalScore;
        bestMove = move;
      }
      
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Alpha-beta pruning
    }
    
    return [minEval, bestMove];
  }
}

// Quick evaluation function for move ordering (simpler than full evaluation)
function quickEvaluate(board, player) {
  const opponent = getOpponent(player);
  
  // Win/loss detection
  if (checkWin(board, player)) return 1000;
  if (checkWin(board, opponent)) return -1000;
  
  let score = 0;
  
  // Basic pattern counting with emphasis on near-wins
  for (const patt of WIN_PATTERNS) {
    let myCount = patt.filter(([x,y]) => board[x][y] === player).length;
    let theirCount = patt.filter(([x,y]) => board[x][y] === opponent).length;
    
    // Only count patterns where victory is still possible
    if (myCount > 0 && theirCount === 0) {
      // Exponential scoring - heavily favor patterns with more pieces
      score += myCount * myCount * 2;
    }
    if (theirCount > 0 && myCount === 0) {
      // Defensive scoring - prioritize blocking near-wins
      score -= theirCount * theirCount * 2;
    }
  }
  
  // Positional evaluation
  if (board[2][2] === player) score += 5; // Center
  
  // Count adjacent pairs (important for forming winning patterns)
  const positions = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === player) {
        positions.push([i, j]);
      }
    }
  }
  
  // Count adjacent pairs
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [x1, y1] = positions[i];
      const [x2, y2] = positions[j];
      if (Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1) {
        score += 3;
      }
    }
  }
  
  return score;
}

// PUBLIC_INTERFACE
function getAIMove(board) {
  // First, check for immediate wins or blocks with a quick 1-ply search
  const validMoves = getValidMoves(board, AI);
  
  // Check for immediate win
  for (const move of validMoves) {
    const nextBoard = makeMove(board, move);
    if (checkWin(nextBoard, AI)) {
      return move; // Return immediately if we can win in one move
    }
  }
  
  // Check for immediate blocks (opponent's potential wins)
  const opponentMoves = getValidMoves(board, HUMAN);
  const threatMoves = [];
  
  for (const oppMove of opponentMoves) {
    const nextBoard = makeMove(board, oppMove);
    if (checkWin(nextBoard, HUMAN)) {
      // Find our move that blocks this threat
      for (const myMove of validMoves) {
        const afterMyMove = makeMove(board, myMove);
        // After my move, recheck the opponent's winning move
        let stillWins = false;
        
        for (const checkMove of getValidMoves(afterMyMove, HUMAN)) {
          const afterCheck = makeMove(afterMyMove, checkMove);
          if (checkWin(afterCheck, HUMAN)) {
            stillWins = true;
            break;
          }
        }
        
        if (!stillWins) {
          threatMoves.push(myMove); // This move blocks the threat
        }
      }
    }
  }
  
  // If there's exactly one blocking move, make it
  if (threatMoves.length === 1) {
    return threatMoves[0];
  }
  
  // If it's the first move, use strategic opening moves
  if (isDropPhase(board) && countPieces(board, AI) === 0 && countPieces(board, HUMAN) <= 1) {
    return getStrategicOpeningMove(board);
  }

  // Adjust depth based on game phase, number of pieces, and available moves
  let depth;
  
  if (isDropPhase(board)) {
    // During drop phase, adjust depth based on the number of pieces
    const totalPieces = countPieces(board, HUMAN) + countPieces(board, AI);
    
    if (totalPieces <= 2) {
      depth = 5; // Early game, we can search deeper
    } else if (totalPieces <= 5) {
      depth = 4; // Mid-drop phase
    } else {
      depth = 3; // Late drop phase, more complex positions
    }
  } else {
    // Movement phase - complexity increases but we need deeper search
    if (validMoves.length <= 8) {
      depth = 5; // Fewer options, search deeper
    } else if (validMoves.length <= 12) {
      depth = 4; // Moderate complexity
    } else {
      depth = 3; // High complexity
    }
  }
  
  // If we're in a critical situation with blocking moves, search deeper
  if (threatMoves.length > 0) {
    depth += 1; // Search one level deeper when facing threats
  }
  
  // Use iterative deepening when many options exist
  if (validMoves.length > 12) {
    return iterativeDeepeningSearch(board, depth);
  }
  
  // Standard minimax search with the calculated depth
  const [, bestMove] = minimax(board, AI, depth, -Infinity, +Infinity, true);
  return bestMove;
}

// Strategic opening move selection with improved tactics
function getStrategicOpeningMove(board) {
  const center = [2, 2];
  const nearCenter = [[1,2], [2,1], [2,3], [3,2]]; // Adjacent to center
  const strongCorners = [[1,1], [1,3], [3,1], [3,3]]; // Diagonal from center
  
  const humanPieces = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === HUMAN) {
        humanPieces.push([i, j]);
      }
    }
  }
  
  // FIRST MOVE STRATEGY
  if (countPieces(board, AI) === 0) {
    // First AI move - prefer the center if available
    if (board[center[0]][center[1]] === EMPTY) {
      return {drop: [center[0], center[1], AI]};
    }
    
    // If center taken, choose a corner position (diagonal from center)
    // This is the optimal second-player opening in Teeko
    for (const [x, y] of strongCorners) {
      if (board[x][y] === EMPTY) {
        return {drop: [x, y, AI]};
      }
    }
  }
  
  // SECOND+ MOVE STRATEGY - more complex analysis
  
  // First look for potential winning patterns for the human and block them
  // For each pattern, check if human has multiple pieces
  let blockingMove = null;
  for (const pattern of WIN_PATTERNS) {
    const humanCount = pattern.filter(([x, y]) => board[x][y] === HUMAN).length;
    const aiCount = pattern.filter(([x, y]) => board[x][y] === AI).length;
    const emptyPositions = pattern.filter(([x, y]) => board[x][y] === EMPTY);
    
    // If human has multiple pieces in pattern and AI has none, consider blocking
    if (humanCount >= 2 && aiCount === 0 && emptyPositions.length > 0) {
      // Prioritize blocking based on threat level
      if (humanCount === 3) {
        // Critical - block immediately
        return {drop: [emptyPositions[0][0], emptyPositions[0][1], AI]};
      } else if (humanCount === 2) {
        // Significant threat - record for consideration
        blockingMove = {drop: [emptyPositions[0][0], emptyPositions[0][1], AI]};
        
        // Check if the 2 human pieces are adjacent (stronger threat)
        const [p1, p2] = pattern.filter(([x, y]) => board[x][y] === HUMAN);
        if (Math.abs(p1[0] - p2[0]) <= 1 && Math.abs(p1[1] - p2[1]) <= 1) {
          return blockingMove; // Adjacent pieces are more dangerous, block immediately
        }
      }
    }
  }
  
  // Now look for opportunities to advance AI's position
  // Look for patterns where AI has pieces and human has none
  let opportunisticMove = null;
  for (const pattern of WIN_PATTERNS) {
    const humanCount = pattern.filter(([x, y]) => board[x][y] === HUMAN).length;
    const aiCount = pattern.filter(([x, y]) => board[x][y] === AI).length;
    const emptyPositions = pattern.filter(([x, y]) => board[x][y] === EMPTY);
    
    // If AI has pieces in pattern and human has none, build on it
    if (aiCount >= 1 && humanCount === 0 && emptyPositions.length > 0) {
      const [x, y] = emptyPositions[0];
      opportunisticMove = {drop: [x, y, AI]};
      
      // If AI already has 2+ pieces in pattern, prioritize completing it
      if (aiCount >= 2) {
        return opportunisticMove;
      }
    }
  }
  
  // If we found a blocking move earlier, use it
  if (blockingMove) {
    return blockingMove;
  }
  
  // If we found an opportunity to advance, use it
  if (opportunisticMove) {
    return opportunisticMove;
  }
  
  // Otherwise use positional strategy - try to maintain control of good positions
  
  // If center is available, take it
  if (board[center[0]][center[1]] === EMPTY) {
    return {drop: [center[0], center[1], AI]};
  }
  
  // Next, prioritize spots that create good formations with existing pieces
  // Look for empty spaces adjacent to our pieces
  const aiPieces = [];
  const adjacentToAI = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === AI) {
        aiPieces.push([i, j]);
        
        // Check all 8 adjacent spots
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = i + dx;
            const ny = j + dy;
            
            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && 
                board[nx][ny] === EMPTY) {
              adjacentToAI.push([nx, ny]);
            }
          }
        }
      }
    }
  }
  
  // Filter unique adjacent positions
  const uniqueAdjacent = adjacentToAI.filter((pos, index, self) => 
    index === self.findIndex(p => p[0] === pos[0] && p[1] === pos[1]));
  
  if (uniqueAdjacent.length > 0) {
    // Sort by position value
    uniqueAdjacent.sort((a, b) => {
      const aValue = a[0] === 2 && a[1] === 2 ? 10 : // center
                    (a[0] === 1 || a[0] === 3) && (a[1] === 1 || a[1] === 3) ? 8 : // near corners
                    (a[0] === 2 || a[1] === 2) ? 7 : // middle positions
                    5; // remaining positions
                    
      const bValue = b[0] === 2 && b[1] === 2 ? 10 :
                    (b[0] === 1 || b[0] === 3) && (b[1] === 1 || b[1] === 3) ? 8 :
                    (b[0] === 2 || b[1] === 2) ? 7 :
                    5;
                    
      return bValue - aValue; // Higher value first
    });
    
    return {drop: [uniqueAdjacent[0][0], uniqueAdjacent[0][1], AI]};
  }
  
  // Then try near-center positions 
  for (const [x, y] of nearCenter) {
    if (board[x][y] === EMPTY) {
      return {drop: [x, y, AI]};
    }
  }
  
  // Then try corners
  for (const [x, y] of strongCorners) {
    if (board[x][y] === EMPTY) {
      return {drop: [x, y, AI]};
    }
  }
  
  // Fallback: choose any available move
  const validMoves = getValidMoves(board, AI);
  return validMoves[0];
}

// Iterative deepening search with enhanced move selection and evaluation
function iterativeDeepeningSearch(board, maxDepth) {
  let bestMove = null;
  let bestScore = -Infinity;
  let previousBestMoves = [];
  
  // First check for any immediate winning move
  const moves = getValidMoves(board, AI);
  for (const move of moves) {
    const nextBoard = makeMove(board, move);
    if (checkWin(nextBoard, AI)) {
      return move; // Return winning move immediately
    }
  }
  
  // Check for moves that block opponent's immediate win
  const blockingMoves = [];
  for (const move of moves) {
    // Simulate opponent's next move options if we make this move
    const nextBoard = makeMove(board, move);
    const oppMoves = getValidMoves(nextBoard, HUMAN);
    let canWin = false;
    
    // Check if opponent has any winning move after our move
    for (const oppMove of oppMoves) {
      const oppNext = makeMove(nextBoard, oppMove);
      if (checkWin(oppNext, HUMAN)) {
        canWin = true;
        break;
      }
    }
    
    // If the opponent cannot win after this move, it's a good blocking move
    if (!canWin) {
      blockingMoves.push(move);
    }
  }
  
  // If we found exactly one blocking move, return it immediately
  if (blockingMoves.length === 1) {
    return blockingMoves[0];
  }
  
  // Pre-evaluate all moves quickly for initial ordering
  const scoredMoves = moves.map(move => {
    const nextBoard = makeMove(board, move);
    const quickScore = quickEvaluate(nextBoard, AI);
    return { move, score: quickScore };
  }).sort((a, b) => b.score - a.score);
  
  // If we're at depth 1, return the best move from the quick evaluation
  if (maxDepth === 1) {
    return scoredMoves[0].move;
  }
  
  // Start with a limited set of promising moves for deeper searches
  const candidateMoves = scoredMoves.slice(0, Math.min(7, scoredMoves.length));
  
  // Proceed with iterative deepening
  for (let depth = 1; depth <= maxDepth; depth++) {
    let currentBestMove = null;
    let currentBestScore = -Infinity;
    
    // For deeper searches, prioritize moves that were good at shallower depths
    const movesToSearch = depth <= 2 ? candidateMoves 
                         : scoredMoves.sort((a, b) => {
                             // Prioritize moves that were best at previous depths
                             const aIsPrevious = previousBestMoves.some(m => 
                               (m.drop && a.move.drop && m.drop[0] === a.move.drop[0] && m.drop[1] === a.move.drop[1]) ||
                               (m.slide && a.move.slide && m.slide[0][0] === a.move.slide[0][0] && m.slide[0][1] === a.move.slide[0][1])
                             );
                             const bIsPrevious = previousBestMoves.some(m => 
                               (m.drop && b.move.drop && m.drop[0] === b.move.drop[0] && m.drop[1] === b.move.drop[1]) ||
                               (m.slide && b.move.slide && m.slide[0][0] === b.move.slide[0][0] && m.slide[0][1] === b.move.slide[0][1])
                             );
                             
                             if (aIsPrevious && !bIsPrevious) return -1;
                             if (!aIsPrevious && bIsPrevious) return 1;
                             return b.score - a.score;
                           });
    
    // Only search the top N moves for deeper depths to save computation
    const searchLimit = depth <= 2 ? movesToSearch.length 
                      : Math.max(5, Math.min(10, Math.ceil(movesToSearch.length / 2)));
    
    for (let i = 0; i < searchLimit; i++) {
      const { move } = movesToSearch[i];
      const nextBoard = makeMove(board, move);
      const [score] = minimax(nextBoard, AI, depth, -Infinity, +Infinity, false);
      
      if (score > currentBestScore) {
        currentBestScore = score;
        currentBestMove = move;
      }
      
      // Early termination if we found a winning move
      if (score > 90000) {
        return move;
      }
    }
    
    // Update best move if we found a better one at this depth
    if (currentBestMove && currentBestScore > bestScore) {
      bestScore = currentBestScore;
      bestMove = currentBestMove;
      previousBestMoves.unshift(currentBestMove); // Add to start of previous best moves
      if (previousBestMoves.length > 3) {
        previousBestMoves.pop(); // Keep only the 3 most recent best moves
      }
    }
    
    // If time is a concern, we could add a time check here to terminate early if needed
  }
  
  // Use blocking moves if available and if our best move isn't already blocking
  if (blockingMoves.length > 0 && bestMove) {
    const isBlocking = blockingMoves.some(bMove => 
      (bMove.drop && bestMove.drop && bMove.drop[0] === bestMove.drop[0] && bMove.drop[1] === bestMove.drop[1]) ||
      (bMove.slide && bestMove.slide && bMove.slide[0][0] === bestMove.slide[0][0] && bMove.slide[0][1] === bestMove.slide[0][1])
    );
    
    if (!isBlocking) {
      // Score all blocking moves and take the best one
      const scoredBlockingMoves = blockingMoves.map(move => {
        const nextBoard = makeMove(board, move);
        return { move, score: evaluateBoard(nextBoard, AI) };
      }).sort((a, b) => b.score - a.score);
      
      if (scoredBlockingMoves.length > 0) {
        return scoredBlockingMoves[0].move;
      }
    }
  }
  
  return bestMove || (moves.length > 0 ? moves[0] : null);
}

// ------------- MAIN COMPONENT --------------

function TeekoMaster() {
  const [board, setBoard] = useState(initBoard());
  const [turn, setTurn] = useState(HUMAN);
  const [phase, setPhase] = useState('drop'); // drop | move
  const [dragging, setDragging] = useState(null); // for move phase: {from:[x,y]}
  const [winner, setWinner] = useState(null);

  // --- EFFECT: Update phase and winner when board/turn changes ---
  useEffect(() => {
    // Phase
    if (isDropPhase(board)) setPhase('drop');
    else setPhase('move');
    // Winner
    if (checkWin(board, HUMAN)) setWinner(HUMAN);
    else if (checkWin(board, AI)) setWinner(AI);
    else setWinner(null);
  }, [board]);

  // --- AI Move effect ---
  useEffect(() => {
    if (winner || turn === HUMAN) return;
    // Delay AI move to look more natural
    const aiTimeout = setTimeout(() => {
      const aiMove = getAIMove(board);
      if (!aiMove) return; // should never happen
      const board2 = makeMove(board, aiMove);
      setBoard(board2);
      setTurn(HUMAN);
    }, DELAYS.ai);
    return () => clearTimeout(aiTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, turn, winner]);

  // --- Handler Helpers ---

  // PUBLIC_INTERFACE
  function handleSquareClick(i, j) {
    if (winner || turn !== HUMAN) return;
    if (phase === 'drop') {
      // Drop: can place if < DROP_COUNT and cell empty
      if (board[i][j] !== EMPTY || countPieces(board, HUMAN) >= DROP_COUNT) return;
      const newBoard = cloneBoard(board);
      newBoard[i][j] = HUMAN;
      setBoard(newBoard);
      setTurn(AI);
    } else if (phase === 'move') {
      // Start drag: select own piece
      if (!dragging) {
        if (board[i][j] !== HUMAN) return;
        setDragging({from: [i, j]});
      } else {
        // Complete move: must slide to a neighboring empty square
        const [fx, fy] = dragging.from;
        if (Math.abs(fx - i) <= 1 && Math.abs(fy - j) <= 1
          && !(fx === i && fy === j) && board[i][j] === EMPTY) {
          // Valid move
          let next = cloneBoard(board);
          next[fx][fy] = EMPTY;
          next[i][j] = HUMAN;
          setBoard(next);
          setTurn(AI);
          setDragging(null);
        } else {
          // Invalid move, reset
          setDragging(null);
        }
      }
    }
  }

  // For drag & drop (optional on desktop)
  function handleDragStart(i, j, e) {
    if (phase !== 'move' || board[i][j] !== HUMAN || winner || turn !== HUMAN) return;
    e.dataTransfer.effectAllowed = 'move';
    setDragging({from: [i, j]});
  }
  function handleDragEnd() {
    setDragging(null);
  }
  function handleDragOver(i, j, e) {
    if (!dragging || winner || board[i][j] !== EMPTY) return;
    e.preventDefault();
  }
  function handleDrop(i, j, e) {
    e.preventDefault();
    if (
      dragging &&
      Math.abs(dragging.from[0] - i) <= 1 && Math.abs(dragging.from[1] - j) <= 1 &&
      !(dragging.from[0] === i && dragging.from[1] === j) &&
      board[i][j] === EMPTY
    ) {
      // Valid drop
      let next = cloneBoard(board);
      next[dragging.from[0]][dragging.from[1]] = EMPTY;
      next[i][j] = HUMAN;
      setBoard(next);
      setTurn(AI);
    }
    setDragging(null);
  }
  function handleRestart() {
    setBoard(initBoard());
    setTurn(HUMAN);
    setDragging(null);
    setWinner(null);
  }

  // --- RENDER ---
  // BOARD RENDER LOGIC
  function renderPiece(cell) {
    if (cell === HUMAN) {
      return <div style={{
        width: '70%',
        height: '70%',
        background: COLORS.R,
        borderRadius: "50%",
        boxShadow: "0 2px 8px rgba(232,122,65,0.2)"
      }}></div>;
    }
    if (cell === AI) {
      return <div style={{
        width: '70%',
        height: '70%',
        background: COLORS.B,
        borderRadius: "50%",
        border: "2.5px solid #ccc",
        boxShadow: "0 2px 8px #222"
      }}></div>;
    }
    return null;
  }

  // Board cell style
  function cellStyle(i, j) {
    let highlight = (dragging && dragging.from && dragging.from[0] === i && dragging.from[1] === j) ? '0 0 0 2px var(--kavia-orange) inset' : undefined;
    return {
      width: "48px",
      height: "48px",
      background: "var(--secondary, #f7fafc)",
      border: "1.5px solid #908a8a",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: 0,
      cursor: winner || (phase === 'drop'
                          ? (board[i][j] !== EMPTY ? 'not-allowed':'pointer')
                          : (dragging
                              ? ((board[i][j] === EMPTY && Math.abs(dragging.from[0]-i)<=1 && Math.abs(dragging.from[1]-j)<=1 && !(dragging.from[0]===i && dragging.from[1]===j))?'pointer':'not-allowed')
                              : (board[i][j] === HUMAN ? 'grab' : 'not-allowed')
                            )),
      boxShadow: highlight
    };
  }

  // Status string
  function statusText() {
    if (winner === HUMAN) return 'You win!';
    if (winner === AI) return 'AI wins!';
    if (!winner && !getValidMoves(board, turn).length)
      return "Draw!";
    if (phase === 'drop')
      return (turn === HUMAN)
        ? `Your turn: Place piece (${countPieces(board, HUMAN) + 1} of ${DROP_COUNT})`
        : `AI is placing a piece...`;
    return (turn === HUMAN)
      ? "Your turn: Move a piece"
      : "AI is moving a piece...";
  }

  // Responsive board/grid size
  const gridSize = Math.min(window.innerWidth * 0.9, 340);

  return (
    <div className="app">
      <nav className="navbar" style={{ background: "#2d3748" }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div className="logo">
              <span className="logo-symbol" style={{ color: COLORS.R, fontWeight:900 }}>*</span> TeekoMaster
            </div>
            <button className="btn" onClick={handleRestart}>Restart Game</button>
          </div>
        </div>
      </nav>

      <main>
        <div className="container" style={{ paddingTop: 90, paddingBottom: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 15 }}>
            <div className="subtitle" style={{ color: COLORS.R }}>Play Teeko vs AI</div>
            <div className="description" style={{ color: "var(--text-secondary)" }}>
              Teeko: Form a line of four or a 2x2 square first! <br />
              <b>Your pieces:</b> <span style={{color:COLORS.R}}>●</span> | <b>AI:</b> <span style={{color:COLORS.B}}>●</span>
            </div>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div
              className="teeko-board"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
                gap: "7px",
                margin: "0 auto",
                background: "var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                boxShadow: "0 4px 32px 0px rgba(44,62,80,0.10)",
                width: gridSize+"px",
                height: gridSize+"px",
                maxWidth: "96vw",
                maxHeight: "69vw",
                position: "relative"
              }}
            >
              {board.map((row, i) =>
                row.map((cell, j) => (
                  <div
                    key={i + "," + j}
                    tabIndex={0}
                    style={cellStyle(i, j)}
                    onClick={() => handleSquareClick(i, j)}
                    draggable={
                      phase === 'move' &&
                      board[i][j] === HUMAN &&
                      turn === HUMAN &&
                      !winner
                    }
                    onDragStart={e => handleDragStart(i, j, e)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleDragOver(i, j, e)}
                    onDrop={e => handleDrop(i, j, e)}
                    aria-label={`Teeko board cell ${i+1},${j+1}`}
                  >
                    {renderPiece(cell)}
                  </div>
                ))
              )}
            </div>
            <div style={{
              marginTop: 25,
              fontWeight: 600,
              fontSize: "1.1rem",
              color: winner
                ? (winner === HUMAN ? COLORS.R : COLORS.B)
                : "var(--kavia-dark)"
            }}>
              {statusText()}
            </div>
            <button className="btn" style={{marginTop: 18, fontSize:"0.98rem"}} onClick={handleRestart}>
              {winner ? "Play Again" : "Restart"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default TeekoMaster;
