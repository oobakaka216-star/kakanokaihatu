const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'viewers.json');

app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let viewers = [];

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      viewers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    viewers = [];
  }
}

function saveData() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(viewers, null, 2));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

loadData();

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send(JSON.stringify({ type: 'init', viewers }));
  ws.on('close', () => console.log('Client disconnected'));
});

app.post('/api/wancom/webhook', (req, res) => {
  const body = req.body;
  console.log('[Wancom Webhook]', JSON.stringify(body));

  const name = String(body.name || body.userName || body.username || body.displayName || 'Unknown').trim();
  const icon = String(body.icon || body.avatar || body.iconUrl || body.profileImage || body.picture || '').trim();
  const comment = String(body.comment || body.message || body.text || body.content || '').trim();
  const userId = String(body.userId || body.id || body.user_id || name).trim();

  let viewer = viewers.find(v => v.userId === userId);
  if (!viewer) {
    viewer = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      userId,
      name,
      icon,
      country: '',
      city: null,
      lat: null,
      lng: null,
      comments: [],
      createdAt: new Date().toISOString()
    };
    viewers.push(viewer);
  }

  if (icon) viewer.icon = icon;
  if (comment) {
    viewer.comments.push({
      text: comment,
      timestamp: new Date().toISOString()
    });
  }
  if (body.city) viewer.city = body.city;
  viewer.lastSeen = new Date().toISOString();

  saveData();
  broadcast({ type: 'update', viewer });
  res.json({ ok: true, viewerId: viewer.id });
});

app.get('/api/viewers', (req, res) => res.json(viewers));

app.post('/api/viewers/:id/location', (req, res) => {
  const viewer = viewers.find(v => v.id === req.params.id);
  if (!viewer) return res.status(404).json({ error: 'Not found' });
  viewer.country = String(req.body.country || '').trim();
  if (req.body.city) viewer.city = req.body.city;
  if (req.body.lat != null) viewer.lat = Number(req.body.lat);
  if (req.body.lng != null) viewer.lng = Number(req.body.lng);
  saveData();
  broadcast({ type: 'update', viewer });
  res.json({ ok: true });
});

app.post('/api/viewers', (req, res) => {
  const { name, icon, country, city, lat, lng } = req.body;
  const viewer = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    userId: name || 'manual_' + Date.now(),
    name: String(name || 'Unknown').trim(),
    icon: String(icon || '').trim(),
    country: String(country || '').trim(),
    city: city || null,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    comments: [],
    createdAt: new Date().toISOString()
  };
  viewers.push(viewer);
  saveData();
  broadcast({ type: 'update', viewer });
  res.json({ ok: true, viewer });
});

app.delete('/api/viewers/:id', (req, res) => {
  viewers = viewers.filter(v => v.id !== req.params.id);
  saveData();
  broadcast({ type: 'delete', id: req.params.id });
  res.json({ ok: true });
});

app.delete('/api/viewers', (req, res) => {
  viewers = [];
  saveData();
  broadcast({ type: 'clear' });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Wancom webhook URL: http://localhost:${PORT}/api/wancom/webhook`);
});
