require('dotenv').config();
const cron = require('cron').CronJob;
const { runFullSync } = require('./index');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const STATE_FILE = path.join(DATA_DIR, 'state.json');
function readState() { try { return JSON.parse(fs.readFileSync(STATE_FILE)); } catch(e){ return { agentMode:false }; } }

const SCHEDULE = process.env.AGENT_CRON || '0 */30 * * * *'; // every 30 minutes by default (cron format with seconds)

console.log('Worker starting, schedule:', SCHEDULE);

const job = new cron(SCHEDULE, async function() {
  const state = readState();
  if (!state.agentMode) {
    console.log('Agent mode disabled; skipping sync');
    return;
  }
  try {
    console.log('Agent run: starting sync');
    await runFullSync();
    console.log('Agent run: sync complete');
  } catch (e) {
    console.error('Agent run error', e);
  }
});

job.start();

// Keep process alive
process.stdin.resume();
