const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
let board, current, gameOver;
const scores = { X: 0, O: 0, tie: 0 };

const cells = document.querySelectorAll('.cell');
const status = document.getElementById('status');

function init() {
  board = Array(9).fill(null);
  current = 'X';
  gameOver = false;
  cells.forEach(c => { c.textContent = ''; c.className = 'cell'; });
  status.textContent = "X's turn";
}

function checkWin() {
  for (const [a, b, c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return null;
}

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const i = +cell.dataset.i;
    if (gameOver || board[i]) return;

    board[i] = current;
    cell.textContent = current;
    cell.classList.add(current.toLowerCase(), 'taken');

    const win = checkWin();
    if (win) {
      gameOver = true;
      win.forEach(idx => cells[idx].classList.add('win'));
      status.textContent = `${current} wins!`;
      scores[current]++;
      updateScores();
    } else if (board.every(Boolean)) {
      gameOver = true;
      status.textContent = "It's a tie!";
      scores.tie++;
      updateScores();
    } else {
      current = current === 'X' ? 'O' : 'X';
      status.textContent = `${current}'s turn`;
    }
  });
});

function updateScores() {
  document.getElementById('score-x').textContent = scores.X;
  document.getElementById('score-o').textContent = scores.O;
  document.getElementById('score-tie').textContent = scores.tie;
}

document.getElementById('reset').addEventListener('click', init);

init();
