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

// Level-Specific Story Cameos (No spoilery math or outcomes)
const cameosByLevel = {
  1: [
    {
      title: "🍺 LATE NIGHT KNOCK AT CLOSING TIME",
      desc: "It's past midnight and the store shutters are coming down. A guy named Raj frantically knocks on the shutter holding some cash, asking if you can open up briefly just to give him some aspirin..."
    },
    {
      title: "⚡ SHAZAM & THE ARMED ROBBERY",
      desc: "Armed robbers hold up your cashier! Shazam flies in, beats them up, and saves your cash register, but smashes your front window and glass display in the process. Do you report this to the police or stay quiet and absorb the glass repairs yourself?"
    }
  ],
  2: [
    {
      title: "👨‍🍳 KITCHEN NIGHTMARES MAKES A SURPRISE VISIT",
      desc: "Gordon Ramsay and Shanka Ghosh (the world's most feared food critic) walk into your kitchen with a full camera crew to film an episode of Kitchen Nightmare. Your kitchen team is on the spot..."
    },
    {
      title: "🐀 ANTON EGO DEMANDS AN OFF-MENU SPECIALTY",
      desc: "The legendary, cold-hearted food critic Anton Ego sits at your best table. He refuses the regular menu and demands a simple, rustic countryside dish that reminds him of his childhood..."
    }
  ],
  3: [
    {
      title: "🎄 A YOUNG GUEST NAMED KEVIN CHECKS IN",
      desc: "A clever 10-year-old boy named Kevin McCallister walks up to the front desk of your luxury hotel alone, holding a credit card and asking for the suite room..."
    }
  ]
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

  socket.on('setLevel', (levelNum) => {
    gameState.currentLevel = levelNum;
    gameState.simulatedDay = 1;
    io.emit('stateUpdate', gameState);
  });

  socket.on('resetGame', () => {
    gameState = {
      currentLevel: 1,
      simulatedDay: 1,
      maxDays: 30,
      teams: {}
    };
    io.emit('stateUpdate', gameState);
  });

  // Random Surprise Trigger Filtered by Active Level
  socket.on('triggerRandomCameo', () => {
    const currentPool = cameosByLevel[gameState.currentLevel] || cameosByLevel[1];
    const randomEvent = currentPool[Math.floor(Math.random() * currentPool.length)];
    io.emit('cameoEvent', randomEvent);
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
