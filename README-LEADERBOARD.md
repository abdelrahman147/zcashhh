# Leaderboard API Setup

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

## Running the Backend API

Start the leaderboard API server:
```bash
npm start
```

Or directly:
```bash
node leaderboard-api.js
```

The API will run on `http://localhost:3001`

## Features

- **Secure Score Submission**: Scores are hashed and validated server-side
- **Anti-Replay Protection**: Each score submission has a unique hash to prevent duplicates
- **Top 100 Leaderboard**: Automatically maintains top 100 scores
- **User Rankings**: Get individual user's best score and rank
- **Cheat Detection**: Backend validates score reasonableness

## API Endpoints

- `POST /api/leaderboard/submit` - Submit a score
- `GET /api/leaderboard?limit=50` - Get leaderboard (default 50 entries)
- `GET /api/leaderboard/user/:wallet` - Get user's best score
- `GET /api/health` - Health check

## Security Features

- Score validation (max 1 million)
- Hash-based duplicate prevention
- Server-side validation
- Cannot be manipulated via browser dev tools

