const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// Global Game State
const gameState = {
  teams: {}, // roomId -> { persistentName, levelVenue, ceoId, managerId, cash, assets, debt, rating, currentLevel }
  currentLevel: 1,
  gameActive: false
};

// Question Sets (Sample structure for Level 1)
const LEVEL_1_QUESTIONS = {
  ceo: [
    {
      id: "ceo_1",
      title: "Opening Capital Loan",
      concept: "Cost of Capital & Time Value of Money",
      options: [
        { label: "A", text: "Take a 5-year fixed 6% bank loan of $1M", correct: true, penalty: 0 },
        { label: "B", text: "Take a 12% high-yield short-term credit line", correct: false, penalty: 50000 },
        { label: "C", text: "Dilute 30% equity for $1M cash", correct: false, penalty: 100000 },
        { label: "D", text: "Borrow $500k at 18% micro-finance rate", correct: false, penalty: 150000 }
      ]
    }
    // ... 6 more CEO questions
  ],
  manager: [
    {
      id: "mgr_1",
      title: "The Barefoot Customer",
      concept: "Customer Relationship Management (CRM) & Brand Equity",
      options: [
        { label: "A", text: "Enforce 'No Shoes, No Service' safety policy", correct: true, penalty: 0 },
        { label: "B", text: "Serve customer quickly to pocket $50 cash", correct: false, penalty: 50000 },
        { label: "C", text: "Charge a $10 barefoot surcharge", correct: false, penalty: 100000 },
        { label: "D", text: "Give away free disposable slippers", correct: false, penalty: 150000 }
      ]
    }
    // ... 8 more Manager questions
  ]
};

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // 1. Team Registration & Role Selection
  socket.on('register_team', ({ persistentName, venueName, role }) => {
    let team = Object.values(gameState.teams).find(t => t.persistentName === persistentName);
    if (!team) {
      team = {
        persistentName,
        venueName,
        ceoId: null,
        managerId: null,
        cash: 0,
        assets: 0,
        debt: 0,
        rating: 5.0,
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

  // 2. Day 0 Foundational Choice ($10M vs $5M) & Joint Decision Resolution Engine
  socket.on('submit_joint_choice', ({ persistentName, choice, isVerificationCorrect, eventId }) => {
    const team = gameState.teams[persistentName];
    if (!team) return;

    if (!team.jointAnswers) team.jointAnswers = {};
    team.jointAnswers[socket.id] = { choice, isVerificationCorrect };

    // Wait until both CEO and Manager submit
    if (Object.keys(team.jointAnswers).length === 2) {
      const answers = Object.values(team.jointAnswers);
      const p1 = answers[0];
      const p2 = answers[1];
      let selectedChoice = null;
      let newsMessage = "";

      // Resolution Logic Matrix
      if (p1.isVerificationCorrect && p2.isVerificationCorrect) {
        // Coin Toss
        selectedChoice = Math.random() > 0.5 ? p1.choice : p2.choice;
        newsMessage = `Clash at ${persistentName}! Both answered correctly; Coin Toss forced Option ${selectedChoice}!`;
      } else if (p1.isVerificationCorrect && !p2.isVerificationCorrect) {
        selectedChoice = p1.choice;
        newsMessage = `${persistentName}: Correct player's decision (Option ${selectedChoice}) executed!`;
      } else if (!p1.isVerificationCorrect && p2.isVerificationCorrect) {
        selectedChoice = p2.choice;
        newsMessage = `${persistentName}: Correct player's decision (Option ${selectedChoice}) executed!`;
      } else {
        // Both Wrong: Random choice
        selectedChoice = Math.random() > 0.5 ? 'A' : 'B';
        if (eventId !== 'day_0_setup') {
          team.cash -= 300000; // Deduct Skip Penalty only during operations
        }
        newsMessage = `Both failed verification at ${persistentName}! Option ${selectedChoice} randomly executed.`;
      }

      // Execute Day 0 Capital Setup
      if (eventId === 'day_0_setup') {
        if (selectedChoice === 'A') {
          team.cash = 10000000;
          team.assets = 0;
        } else {
          team.cash = 5000000;
          team.assets = 2000000;
          team.rating = 4.8;
        }
      }

      team.jointAnswers = {}; // Reset container
      io.to(persistentName).emit('joint_resolved', { selectedChoice });
      io.emit('host_news_ticker', newsMessage);
      io.emit('state_update', gameState);
    }
  });

  // 3. Solo Decision Processing
  socket.on('submit_solo_choice', ({ persistentName, questionId, choiceIndex, isHintUsed, isSkipUsed }) => {
    const team = gameState.teams[persistentName];
    if (!team) return;

    if (isSkipUsed) {
      team.cash -= 300000; // Skip penalty
      team.skipsUsed++;
    } else {
      if (isHintUsed) {
        team.cash -= 50000; // Hint cost
        team.hintsUsed++;
      }
      // Apply weighted penalty if wrong
      if (choiceIndex !== 0) { // Assuming index 0 is correct answer in our data
        const penalties = [50000, 100000, 150000];
        team.cash -= penalties[choiceIndex - 1] || 100000;
        team.rating = Math.max(1.0, team.rating - 0.1);
      } else {
        team.cash += 150000; // Success revenue
        team.rating = Math.min(5.0, team.rating + 0.1);
      }
    }

    io.emit('state_update', gameState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
