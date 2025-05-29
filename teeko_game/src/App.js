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

// Heuristic: (+∞ = win, -∞ = lose, otherwise count 3s, 2s)
// PUBLIC_INTERFACE
function evaluateBoard(board, player) {
  // Only check for winner, otherwise count #lines of 3 for player - opponent
  if (checkWin(board, player)) return 100000;
  if (checkWin(board, getOpponent(player))) return -100000;
  let score = 0;
  for (const patt of WIN_PATTERNS) {
    let mine = patt.filter(([x,y]) => board[x][y] === player).length;
    let theirs = patt.filter(([x,y]) => board[x][y] === getOpponent(player)).length;
    if (mine > 0 && theirs === 0) {
      if (mine === 3) score += 20;
      if (mine === 2) score += 2;
      if (mine === 1) score += 1;
    }
    if (theirs > 0 && mine === 0) {
      if (theirs === 3) score -= 15;
      if (theirs === 2) score -= 2;
      if (theirs === 1) score -= 1;
    }
  }
  return score;
}

// PUBLIC_INTERFACE
function getValidMoves(board, player) {
  return isDropPhase(board)
    ? availableDrops(board).map(([x,y]) => ({drop: [x, y, player]}))
    : availableMoves(board, player).map(({from, to}) => ({slide: [from, to, player]}));
}

// ------ MINIMAX WITH ALPHA-BETA ------

function minimax(board, player, depth, alpha, beta, maximizing) {
  // Depth and player context set externally
  if (checkWin(board, HUMAN) || checkWin(board, AI) || depth === 0) {
    return [evaluateBoard(board, AI), null];
  }
  const moves = getValidMoves(board, maximizing ? player : getOpponent(player));
  if (moves.length === 0) {
    // No legal moves -- game is a draw
    return [0, null];
  }
  let bestMove = null;
  if (maximizing) {
    let maxEval = -Infinity;
    for (const mv of moves) {
      const nextState = makeMove(board, mv);
      const [evalScore] = minimax(nextState, player, depth - 1, alpha, beta, false);
      if (evalScore > maxEval) {
        maxEval = evalScore;
        bestMove = mv;
      }
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return [maxEval, bestMove];
  } else {
    let minEval = +Infinity;
    for (const mv of moves) {
      const nextState = makeMove(board, mv);
      const [evalScore] = minimax(nextState, player, depth - 1, alpha, beta, true);
      if (evalScore < minEval) {
        minEval = evalScore;
        bestMove = mv;
      }
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return [minEval, bestMove];
  }
}

// PUBLIC_INTERFACE
function getAIMove(board) {
  // Use Minimax: prefer shorter search in drops, longer in moves phase
  const depth = isDropPhase(board) ? 3 : 5;
  const [, bestMove] = minimax(board, AI, depth, -Infinity, +Infinity, true);
  return bestMove;
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
