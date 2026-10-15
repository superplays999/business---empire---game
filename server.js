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

// Cameo Event Pool
const cameos = [
  {
    title: "🎭 DDLJ DDLJ Twist!",
    desc: "Simran missed the train! Footfall drops by 15% for all venues, but marketing hype increases valuation by $500,000!",
    img: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop"
  },
  {
    title: "⚡ SHAZAM Power Boost!",
    desc: "A sudden lightning strike powers up all equipment! Daily organic revenue doubles for the next 3 days!",
    img: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop"
  },
  {
    title: "👨‍🍳 Gordon Ramsay Inspection!",
    desc: "Ramsay visits your venue! Top 2 teams receive $1,000,000 in investor bonus. Bottom team loses $300,000 in food waste!",
    img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop"
  },
  {
    title: "🦈 Shark Tank Blitz!",
    desc: "A Shark investor offers a secret equity deal! All teams gain $2,000,000 cash but accumulate $500,000 extra debt!",
    img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop"
  }
];

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

  // Random Surprise Trigger
  socket.on('triggerRandomCameo', () => {
    const randomEvent = cameos[Math.floor(Math.random() * cameos.length)];
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
