/*
 * Tafl rules (Tablut-style 9×9, corner escape — the variant research/01-mechanics.md recommends
 * because edge-escape rule sets are too easy for the defenders).
 *   G = Gaul defender (circle), K = Vercingétorix (king), R = Roman attacker (square), . = empty
 * Gauls win if the king reaches a corner. Rome wins if the king is surrounded on 4 sides
 * (or 3 sides + the throne). Ordinary pieces are captured by sandwiching (corners and the empty
 * throne count as hostile). Pieces move like rooks; only the king may stop on throne/corners.
 */
export const N = 9;
export const C = 4; // throne
const START = [
  '...RRR...',
  '....R....',
  '....G....',
  'R...G...R',
  'RRGGKGGRR',
  'R...G...R',
  '....G....',
  '....R....',
  '...RRR...',
];

export const initial = () => ({
  board: START.map((r) => r.split('')),
  turn: 'R', // attackers move first, as in most tafl rules
  winner: null,
  last: null,
  captured: [],
});

export const isCorner = (r, c) => (r === 0 || r === N - 1) && (c === 0 || c === N - 1);
export const isThrone = (r, c) => r === C && c === C;
const inB = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
const sideOf = (p) => (p === 'R' ? 'R' : p === 'G' || p === 'K' ? 'G' : null);

export function movesFrom(board, r, c) {
  const p = board[r][c];
  const out = [];
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let rr = r + dr; let cc = c + dc;
    while (inB(rr, cc) && board[rr][cc] === '.') {
      const special = isCorner(rr, cc) || isThrone(rr, cc);
      if (!special || p === 'K') out.push([rr, cc]);
      rr += dr; cc += dc;
    }
  }
  return out;
}

export function allMoves(board, side) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (sideOf(board[r][c]) === side) for (const to of movesFrom(board, r, c)) out.push({ from: [r, c], to });
  }
  return out;
}

const hostileTo = (board, r, c, victimSide) => {
  if (!inB(r, c)) return false;
  const p = board[r][c];
  if (p === '.') return isCorner(r, c) || isThrone(r, c);
  if (victimSide === 'R') return p === 'G' || p === 'K';
  return p === 'R';
};

export function apply(state, move, full = true) {
  const board = state.board.map((row) => [...row]);
  const [fr, fc] = move.from; const [tr, tc] = move.to;
  const p = board[fr][fc];
  board[fr][fc] = '.'; board[tr][tc] = p;
  const me = sideOf(p);
  const captured = [];
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const r1 = tr + dr; const c1 = tc + dc; const r2 = tr + 2 * dr; const c2 = tc + 2 * dc;
    if (!inB(r1, c1)) continue;
    const v = board[r1][c1];
    if (v === '.' || v === 'K' || sideOf(v) === me) continue;
    if (hostileTo(board, r2, c2, sideOf(v))) { board[r1][c1] = '.'; captured.push([r1, c1]); }
  }
  let winner = null;
  // king escape / king capture
  let kr = -1; let kc = -1;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] === 'K') { kr = r; kc = c; }
  if (kr >= 0 && isCorner(kr, kc)) winner = 'G';
  else if (kr >= 0) {
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dr, dc]) => {
      const r = kr + dr; const c = kc + dc;
      if (!inB(r, c)) return false;
      return board[r][c] === 'R' || (isThrone(r, c) && board[r][c] === '.');
    });
    if (around.every(Boolean)) winner = 'R';
  }
  const next = me === 'R' ? 'G' : 'R';
  if (full && !winner && allMoves(board, next).length === 0) winner = me;
  return { board, turn: next, winner, last: move, captured };
}

/* ── a small AI: 1-ply greedy + checks the opponent's immediate win (2-ply) ── */
function kingPos(board) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] === 'K') return [r, c];
  return null;
}
function kingEscapes(board) {
  const k = kingPos(board);
  if (!k) return 0;
  return movesFrom(board, k[0], k[1]).filter(([r, c]) => isCorner(r, c)).length;
}
function kingFreedom(board) {
  const k = kingPos(board);
  return k ? movesFrom(board, k[0], k[1]).length : 0;
}
function kingPressure(board) {
  const k = kingPos(board);
  if (!k) return 4;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => {
    const r = k[0] + dr; const c = k[1] + dc;
    return inB(r, c) && board[r][c] === 'R';
  }).length;
}
function count(board, p) { let n = 0; for (const row of board) for (const x of row) if (x === p) n++; return n; }

function evaluate(state, side) {
  if (state.winner) return state.winner === side ? 1e6 : -1e6;
  const b = state.board;
  const g = count(b, 'G'); const rr = count(b, 'R');
  const esc = kingEscapes(b); const free = kingFreedom(b); const pres = kingPressure(b);
  const k = kingPos(b);
  const cornerDist = k ? Math.min(...[[0, 0], [0, 8], [8, 0], [8, 8]].map(([r, c]) => Math.abs(r - k[0]) + Math.abs(c - k[1]))) : 0;
  // Rome guards the corners: squares next to each corner block escape lines
  let guards = 0;
  for (const [r, c] of [[0, 1], [1, 0], [0, 7], [1, 8], [7, 0], [8, 1], [7, 8], [8, 7], [1, 1], [1, 7], [7, 1], [7, 7]]) if (b[r][c] === 'R') guards++;
  const gaulScore = g * 12 - rr * 8 + esc * 400 + free * 6 - pres * 30 - cornerDist * 4 - guards * 22;
  return side === 'G' ? gaulScore : -gaulScore;
}

export function aiMove(state, rnd = Math.random) {
  // depth-2 minimax: my move, then the opponent's best reply, judged from my side
  const side = state.turn;
  const moves = allMoves(state.board, side);
  let best = null; let bestScore = -Infinity;
  for (const m of moves) {
    const s1 = apply(state, m, false);
    if (s1.winner === side) return m;
    let worst = Infinity;
    const replies = allMoves(s1.board, s1.turn);
    if (!replies.length) worst = evaluate(s1, side);
    for (const r of replies) {
      const v = evaluate(apply(s1, r, false), side);
      if (v < worst) worst = v;
      if (worst <= -1e6) break;
    }
    const score = worst + rnd() * 4;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
