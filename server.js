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

// Level-Specific Story Cameos
const cameosByLevel = {
  1: [
    {
      title: "🍺 DDLJ: Raj Knocks at Closing Time",
      desc: "Raj knocks at your store door late at night asking for aspirin. If you trust him and open, he steals a crate of beer, smashes shelves, and throws cash/aspirin at you! Loss of respect and -$400,000 in store repairs. Refusing keeps your store safe.",
      img: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop"
    },
    {
      title: "⚡ Shazam: Convenience Store Robbery",
      desc: "Armed robbers hold up the cashier! Shazam intervenes and beats them up, saving your cash register, but smashes your front window and glass display in the process. Do you report to police or absorb glass repair costs?",
      img: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop"
    }
  ],
  2: [
    {
      title: "👨‍🍳 Gordon Ramsay & Shanka Ghosh (Kitchen Nightmares)",
      desc: "Gordon Ramsay and Shanka Ghosh (World's biggest food critic) arrive to shoot Kitchen Nightmares! Good food yields +$2,000,000 investment & goodwill. Bad food causes -$4,000,000 loss (double investment penalty) & massive goodwill hit!",
      img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop"
    },
    {
      title: "🐀 Ratatouille Off-Menu Challenge",
      desc: "A top culinary critic arrives demanding an off-menu specialty dish: Ratatouille. Preparing it perfectly grants +$1,500,000 in VIP bookings, while declining causes reputation loss.",
      img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop"
    }
  ],
  3: [
    {
      title: "🎄 Home Alone 2: Kevin Checks In",
      desc: "Young Kevin McCallister attempts to check into your luxury hotel using a stolen credit card. Letting him stay leads to room booby-traps & -$1,200,000 in property damage! Turning him away incurs zero losses.",
      img: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop"
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

  // Random Surprise Trigger Filtered by Current Active Level
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
