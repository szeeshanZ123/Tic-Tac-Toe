const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const resetBtn = document.getElementById("reset");
const popup = document.getElementById("popup");
const newGameBtn = document.getElementById("newGame");

let currentPlayer = "X";
let board = ["", "", "", "", "", "", "", "", ""];
let running = true;

// Winning patterns (rows, columns, diagonals)
const winConditions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Add click events
cells.forEach((cell) => cell.addEventListener("click", cellClicked));
resetBtn.addEventListener("click", resetGame);
newGameBtn.addEventListener("click", newGame);

function cellClicked() {
  const index = this.dataset.index;

  if (board[index] !== "" || !running) return;

  board[index] = currentPlayer;
  this.textContent = currentPlayer;
  this.classList.add("filled");

  checkWinner();
}

function checkWinner() {
  let roundWon = false;

  for (let condition of winConditions) {
    const [a, b, c] = condition;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      roundWon = true;
      highlightWinner(a, b, c);
      break;
    }
  }

  if (roundWon) {
    statusText.textContent = `🎉 Player ${currentPlayer} Wins!`;
    showPopup(`🏆 Player ${currentPlayer} Wins!`);
    running = false;
  } else if (!board.includes("")) {
    statusText.textContent = "🤝 It's a Draw!";
    showPopup("🤝 It's a Draw!");
    running = false;
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusText.textContent = `Player ${currentPlayer}'s turn`;
  }
}

function highlightWinner(a, b, c) {
  [a, b, c].forEach((i) => {
    cells[i].style.background = "linear-gradient(135deg, #f1c40f, #e67e22)";
    cells[i].style.transform = "scale(1.1)";
  });
}

function resetGame() {
  board = ["", "", "", "", "", "", "", "", ""];
  currentPlayer = "X";
  running = true;
  statusText.textContent = `Player X's turn`;

  cells.forEach((cell) => {
    cell.textContent = "";
    cell.style.background = "rgba(255,255,255,0.1)";
    cell.style.transform = "scale(1)";
  });
}

function showPopup(message) {
  popup.textContent = message;
  popup.classList.add("show");

  setTimeout(() => {
    popup.classList.remove("show");
  }, 1500);
}
function newGame() {
  resetGame(); // just call the reset function
  showPopup("🆕 New Game Started!");
}
