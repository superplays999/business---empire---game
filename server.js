const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let gameState = {
  currentLevel: 1,
  simulatedDay: 1,
  maxDays: 30,
  teams: {}
};

io.on('connection', (socket) => {
  socket.emit('stateUpdate', gameState);

  socket.on('joinTeam', ({ groupName, venueName, startingOption, role }) => {
    const teamId = groupName.toLowerCase().replace(/\s+/g, '-');
    
    if (!gameState.teams[teamId]) {
      const startingCash = startingOption === 'B' ? 5000000 : 10000000;
      const startingAssets = startingOption === 'B' ? 5000000 : 0;
      
      gameState.teams[teamId] = {
        id: teamId,
        groupName: groupName,
        venueName: venueName || 'My Business',
        startingOption: startingOption || 'A',
        cash: startingCash,
        inventory: startingAssets,
        debt: 0,
        netWorth: startingCash + startingAssets,
        members: {}
      };
    }
    
    gameState.teams[teamId].members[role] = socket.id;
    socket.join(teamId);
    io.emit('stateUpdate', gameState);
  });

  socket.on('advanceDay', () => {
    if (gameState.simulatedDay < gameState.maxDays) {
      gameState.simulatedDay += 1;
      Object.values(gameState.teams).forEach(team => {
        const yieldAmount = Math.floor(team.netWorth * 0.02);
        team.cash += yieldAmount;
        team.netWorth = team.cash + team.inventory - team.debt;
      });
      io.emit('stateUpdate', gameState);
    }
  });

  socket.on('triggerCameo', (cameoKey) => {
    io.emit('cameoEvent', cameoKey);
  });

  socket.on('makeDecision', ({ teamId, deltaCash, deltaInventory, deltaDebt }) => {
    const team = gameState.teams[teamId];
    if (team) {
      team.cash += (deltaCash || 0);
      team.inventory += (deltaInventory || 0);
      team.debt += (deltaDebt || 0);
      team.netWorth = team.cash + team.inventory - team.debt;
      io.emit('stateUpdate', gameState);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
