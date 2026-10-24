const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const gameState = {
  teams: {}, // persistentName -> { persistentName, venueName, ceoId, managerId, cash, assets, debt, ratingL1, ratingL2, ratingL3, currentRating }
  currentLevel: 1,
  gameActive: false
};

io.on('connection', (socket) => {
  socket.on('register_team', ({ persistentName, venueName, role }) => {
    let team = gameState.teams[persistentName];
    if (!team) {
      team = {
        persistentName,
        venueName,
        ceoId: null,
        managerId: null,
        cash: 10000000,
        assets: 0,
        debt: 0,
        ratingL1: 5.0,
        ratingL2: 5.0,
        ratingL3: 5.0,
        currentRating: 5.0,
        hintsUsed: 0,
        skipsUsed: 0
      };
      gameState.teams[persistentName] = team;
    }

    if (role === 'CEO') team.ceoId = socket.id;
    if (role === 'MANAGER') team.managerId = socket.id;

    socket.join(persistentName);
    io.emit('state_update', gameState);
  });

  socket.on('submit_solo_choice', ({ persistentName, choiceIndex, isHintUsed, isSkipUsed }) => {
    const team = gameState.teams[persistentName];
    if (!team) return;

    if (isSkipUsed || choiceIndex === -1) {
      team.cash -= 300000;
      team.skipsUsed++;
    } else {
      if (isHintUsed) {
        team.cash -= 50000;
        team.hintsUsed++;
      }
      if (choiceIndex === 0) {
        team.cash += 250000;
        team.currentRating = Math.min(5.0, team.currentRating + 0.1);
      } else {
        const penalties = [50000, 100000, 150000];
        team.cash -= penalties[choiceIndex - 1] || 100000;
        team.currentRating = Math.max(1.0, team.currentRating - 0.15);
      }
    }

    // Save level rating snapshot
    if (gameState.currentLevel === 1) team.ratingL1 = team.currentRating;
    if (gameState.currentLevel === 2) team.ratingL2 = team.currentRating;
    if (gameState.currentLevel === 3) team.ratingL3 = team.currentRating;

    io.emit('state_update', gameState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
