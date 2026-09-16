import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, PauseIcon, PlayIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';

const COLS = 10;
const ROWS = 20;

const PIECES = [
  { type: 'I', color: 'cyan', shape: [[1, 1, 1, 1]] },
  { type: 'O', color: 'yellow', shape: [[1, 1], [1, 1]] },
  { type: 'T', color: 'purple', shape: [[0, 1, 0], [1, 1, 1]] },
  { type: 'S', color: 'green', shape: [[0, 1, 1], [1, 1, 0]] },
  { type: 'Z', color: 'red', shape: [[1, 1, 0], [0, 1, 1]] },
  { type: 'J', color: 'blue', shape: [[1, 0, 0], [1, 1, 1]] },
  { type: 'L', color: 'orange', shape: [[0, 0, 1], [1, 1, 1]] },
];

const createBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const cloneShape = (shape) => shape.map((row) => [...row]);
const createPiece = (definition) => ({
  ...definition,
  shape: cloneShape(definition.shape),
  x: Math.floor((COLS - definition.shape[0].length) / 2),
  y: 0,
});

const randomPiece = () => createPiece(PIECES[Math.floor(Math.random() * PIECES.length)]);

function rotateShape(shape) {
  return shape[0].map((_, index) => shape.map((row) => row[index]).reverse());
}

function cellsFor(piece) {
  const cells = [];
  piece.shape.forEach((row, rowIndex) => row.forEach((filled, colIndex) => {
    if (filled) cells.push({ x: piece.x + colIndex, y: piece.y + rowIndex });
  }));
  return cells;
}

function collides(board, piece) {
  return cellsFor(piece).some(({ x, y }) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x]));
}

function mergePiece(board, piece) {
  const nextBoard = board.map((row) => [...row]);
  cellsFor(piece).forEach(({ x, y }) => {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) nextBoard[y][x] = piece.color;
  });
  return nextBoard;
}

function clearLines(board) {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - remaining.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...remaining],
    cleared,
  };
}

function getDropDistance(board, piece) {
  let distance = 0;
  while (!collides(board, { ...piece, y: piece.y + distance + 1 })) distance += 1;
  return distance;
}

function App() {
  const [game, setGame] = useState(() => ({
    board: createBoard(),
    active: randomPiece(),
    next: randomPiece(),
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    muted: false,
  }));
  const gameRef = useRef(game);
  gameRef.current = game;

  const resetGame = useCallback(() => {
    setGame({
      board: createBoard(),
      active: randomPiece(),
      next: randomPiece(),
      score: 0,
      lines: 0,
      level: 1,
      status: 'playing',
      muted: gameRef.current.muted,
    });
  }, []);

  const togglePause = useCallback(() => {
    setGame((current) => {
      if (current.status === 'gameover') return current;
      return { ...current, status: current.status === 'paused' ? 'playing' : 'paused' };
    });
  }, []);

  const move = useCallback((dx, dy) => {
    setGame((current) => {
      if (current.status !== 'playing') return current;
      const moved = { ...current.active, x: current.active.x + dx, y: current.active.y + dy };
      return collides(current.board, moved) ? current : { ...current, active: moved };
    });
  }, []);

  const rotate = useCallback(() => {
    setGame((current) => {
      if (current.status !== 'playing') return current;
      const rotated = { ...current.active, shape: rotateShape(current.active.shape) };
      const kicks = [0, -1, 1, -2, 2];
      const kicked = kicks.map((offset) => ({ ...rotated, x: rotated.x + offset })).find((candidate) => !collides(current.board, candidate));
      return kicked ? { ...current, active: kicked } : current;
    });
  }, []);

  const lockPiece = useCallback((current, distanceBonus = 0) => {
    const merged = mergePiece(current.board, current.active);
    const { board, cleared } = clearLines(merged);
    const lines = current.lines + cleared;
    const level = Math.floor(lines / 10) + 1;
    const lineScore = [0, 100, 300, 500, 800][cleared] * current.level;
    const active = createPiece(current.next);
    const gameover = collides(board, active);
    return {
      ...current,
      board,
      active,
      next: randomPiece(),
      score: current.score + lineScore + distanceBonus,
      lines,
      level,
      status: gameover ? 'gameover' : 'playing',
    };
  }, []);

  const hardDrop = useCallback(() => {
    setGame((current) => {
      if (current.status !== 'playing') return current;
      const distance = getDropDistance(current.board, current.active);
      return lockPiece({ ...current, active: { ...current.active, y: current.active.y + distance } }, distance * 2);
    });
  }, [lockPiece]);

  const tick = useCallback(() => {
    setGame((current) => {
      if (current.status !== 'playing') return current;
      const moved = { ...current.active, y: current.active.y + 1 };
      return collides(current.board, moved) ? lockPiece(current) : { ...current, active: moved };
    });
  }, [lockPiece]);

  useEffect(() => {
    const interval = window.setInterval(tick, Math.max(110, 820 - (game.level - 1) * 65));
    return () => window.clearInterval(interval);
  }, [game.level, tick]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const controls = {
        ArrowLeft: () => move(-1, 0),
        ArrowRight: () => move(1, 0),
        ArrowDown: () => move(0, 1),
        ArrowUp: rotate,
        x: rotate,
        X: rotate,
        ' ': hardDrop,
        p: togglePause,
        P: togglePause,
      };
      if (controls[event.key]) {
        event.preventDefault();
        controls[event.key]();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hardDrop, move, rotate, togglePause]);

  const displayBoard = useMemo(() => {
    const rendered = game.board.map((row) => [...row]);
    const distance = getDropDistance(game.board, game.active);
    cellsFor({ ...game.active, y: game.active.y + distance }).forEach(({ x, y }) => {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && !rendered[y][x]) rendered[y][x] = `ghost-${game.active.color}`;
    });
    cellsFor(game.active).forEach(({ x, y }) => {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) rendered[y][x] = game.active.color;
    });
    return rendered;
  }, [game.active, game.board]);

  return (
    <main className="game-shell" data-testid="app">
      <div className="game-layout">
        <section className="game-intro">
          <div className="brand-mark" aria-hidden="true">✦</div>
          <p className="eyebrow">ARCADE / 001</p>
          <h1>Russian<br /><span>Blocks</span></h1>
          <p className="intro-copy">Stack smart. Clear lines.<br />Find your flow.</p>
          <div className="keyboard-hint">
            <span className="hint-key">←</span><span className="hint-key">↓</span><span className="hint-key">→</span>
            <span>move</span>
            <span className="hint-key">↑</span><span>rotate</span>
          </div>
        </section>

        <section className="game-card" aria-label="Russian Blocks game">
          <div className="game-card-top">
            <div>
              <span className="live-dot" /> LIVE GAME
            </div>
            <div className="top-actions">
              <button className="icon-button" onClick={() => setGame((current) => ({ ...current, muted: !current.muted }))} aria-label={game.muted ? 'Unmute game' : 'Mute game'}>
                {game.muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
              </button>
              <button className="icon-button" onClick={resetGame} aria-label="Restart game"><ArrowPathIcon /></button>
            </div>
          </div>

          <div className="game-content">
            <div className="board-wrap">
              <div className="board" role="grid" aria-label="Game board">
                {displayBoard.flatMap((row, rowIndex) => row.map((cell, colIndex) => (
                  <div className={`cell ${cell ? `cell-${cell}` : ''}`} key={`${rowIndex}-${colIndex}`} role="gridcell" />
                )))}
                {game.status === 'paused' && (
                  <div className="board-overlay"><PauseIcon /><strong>PAUSED</strong><span>Press P or tap resume</span></div>
                )}
                {game.status === 'gameover' && (
                  <div className="board-overlay"><span className="overlay-kicker">RUN COMPLETE</span><strong>GAME OVER</strong><span>Final score {game.score.toLocaleString()}</span><button onClick={resetGame}>Play again</button></div>
                )}
              </div>
              <div className="board-footer"><span>SPACE <small>hard drop</small></span><span>P <small>pause</small></span></div>
            </div>

            <aside className="game-sidebar">
              <div className="next-panel">
                <span className="panel-label">NEXT BLOCK</span>
                <div className="preview-grid">
                  {Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, col) => {
                    const filled = game.next.shape[row]?.[col];
                    return <div className={`preview-cell ${filled ? `cell-${game.next.color}` : ''}`} key={`${row}-${col}`} />;
                  }))}
                </div>
              </div>
              <div className="stats">
                <div><span>SCORE</span><strong>{game.score.toLocaleString()}</strong></div>
                <div><span>LEVEL</span><strong>{String(game.level).padStart(2, '0')}</strong></div>
                <div><span>LINES</span><strong>{String(game.lines).padStart(2, '0')}</strong></div>
              </div>
              <button className="pause-button" onClick={togglePause} disabled={game.status === 'gameover'}>
                {game.status === 'paused' ? <PlayIcon /> : <PauseIcon />}
                {game.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <div className="mobile-controls" aria-label="Touch controls">
                <button onClick={() => move(-1, 0)} aria-label="Move left">←</button>
                <button onClick={rotate} aria-label="Rotate">↻</button>
                <button onClick={() => move(1, 0)} aria-label="Move right">→</button>
                <button onClick={hardDrop} aria-label="Hard drop">↓</button>
              </div>
            </aside>
          </div>
        </section>
      </div>
      <footer className="game-footer"><span>RUSSIAN BLOCKS</span><span>BUILT FOR THE STACK</span><span>v1.0</span></footer>
    </main>
  );
}

export default App;
