require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./crypto');
const axios = require('axios');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password';
const SERVER_SECRET = process.env.SERVER_SECRET || 'change_this_secret';

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }

let accounts = readJSON(ACCOUNTS_FILE, []);
let state = readJSON(STATE_FILE, { agentMode: false, lastSync: null });
let cache = readJSON(CACHE_FILE, {});

function saveAccounts() { writeJSON(ACCOUNTS_FILE, accounts); }
function saveState() { writeJSON(STATE_FILE, state); }
function saveCache() { writeJSON(CACHE_FILE, cache); }

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Simple admin auth middleware (basic)
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth' });
  const [type, token] = authHeader.split(' ');
  if (type !== 'Basic') return res.status(401).json({ error: 'Invalid auth' });
  const creds = Buffer.from(token, 'base64').toString('utf8').split(':');
  const [user, pass] = creds;
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// PUBLIC: status
app.get('/api/status', (req, res) => {
  res.json({ agentMode: state.agentMode, lastSync: state.lastSync });
});

// ADMIN: list accounts (without secrets)
app.get('/api/accounts', auth, (req, res) => {
  const safe = accounts.map(a => ({ id: a.id, name: a.name, exchange: a.exchange, createdAt: a.createdAt }));
  res.json(safe);
});

// ADMIN: add account (stores encrypted secrets)
app.post('/api/accounts', auth, (req, res) => {
  const { name, exchange, apiKey, apiSecret, passphrase } = req.body;
  if (!name || !exchange || !apiKey) return res.status(400).json({ error: 'name, exchange, apiKey required' });
  const id = Date.now().toString();
  const encSecret = apiSecret ? encrypt(apiSecret, SERVER_SECRET) : null;
  const encPass = passphrase ? encrypt(passphrase, SERVER_SECRET) : null;
  const account = { id, name, exchange, apiKey, apiSecret: encSecret, passphrase: encPass, createdAt: new Date().toISOString() };
  accounts.push(account);
  saveAccounts();
  res.json({ ok: true, id });
});

// ADMIN: delete account
app.delete('/api/accounts/:id', auth, (req, res) => {
  const id = req.params.id;
  accounts = accounts.filter(a => a.id !== id);
  saveAccounts();
  res.json({ ok: true });
});

// ADMIN: toggle agent mode
app.post('/api/agent/toggle', auth, (req, res) => {
  const { enabled } = req.body;
  state.agentMode = !!enabled;
  saveState();
  res.json({ agentMode: state.agentMode });
});

// ADMIN: manual sync
app.post('/api/sync', auth, async (req, res) => {
  try {
    await runFullSync();
    res.json({ ok: true, lastSync: state.lastSync });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUBLIC: get last cached balances
app.get('/api/cache', (req, res) => {
  res.json(cache);
});

// Basic placeholder: fetch balances for an account (supports Binance example)
async function fetchBalancesForAccount(acc) {
  const exchange = acc.exchange.toLowerCase();
  const apiKey = acc.apiKey;
  const apiSecret = acc.apiSecret ? decrypt(acc.apiSecret, SERVER_SECRET) : null;
  // For production, implement each exchange signing properly. Here we provide Binance example for balances.
  if (exchange === 'binance') {
    try {
      const ts = Date.now();
      const query = `timestamp=${ts}`; // minimal
      const signature = require('crypto').createHmac('sha256', apiSecret).update(query).digest('hex');
      const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;
      const resp = await axios.get(url, { headers: { 'X-MBX-APIKEY': apiKey } });
      // Map balances to simplified format
      const balances = resp.data.balances.filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0).map(b => ({ asset: b.asset, free: b.free, locked: b.locked }));
      return { id: acc.id, name: acc.name, exchange: acc.exchange, balances };
    } catch (e) {
      return { id: acc.id, name: acc.name, exchange: acc.exchange, error: e.response?.data || e.message };
    }
  }

  // Bybit / MEXC / others: stub response until implemented
  return { id: acc.id, name: acc.name, exchange: acc.exchange, info: 'fetch not implemented for this exchange yet' };
}

async function runFullSync() {
  const results = [];
  for (const acc of accounts) {
    try {
      const r = await fetchBalancesForAccount(acc);
      results.push(r);
    } catch (e) {
      results.push({ id: acc.id, error: e.message });
    }
  }
  cache = { lastUpdated: new Date().toISOString(), results };
  state.lastSync = new Date().toISOString();
  saveCache();
  saveState();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

module.exports = { runFullSync };
