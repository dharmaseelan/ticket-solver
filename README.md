# Ticket Solver Agent

Sourceflow HubSpot ticket triage & fix agent.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Add your API key**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and paste your Anthropic API key
   ```
   Get your key at: https://console.anthropic.com/

3. **Connect HubSpot**
   - Make sure your HubSpot MCP connection is active in Claude.ai settings
   - The app uses the same HubSpot auth as your Claude.ai session

4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## How it works

1. Enter your local project root path (e.g. `/Users/dharma/projects/client-site`)
2. Click **Load & Analyse My Tickets**
3. The agent fetches your open HubSpot tickets and triages them by difficulty
4. Click **Solve This Ticket** on any quick-fix ticket
5. Claude generates the code fix with file paths — apply it to your local project
6. Review, test locally, then push to master

## Notes

- Only tickets assigned to you are fetched (excludes Resolved/Closed)
- Fixes are generated but NOT auto-applied — you review and apply manually
- Supports both POC/Standard and Aurelius project stacks
