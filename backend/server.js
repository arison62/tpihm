// ============================================================================
// server.js - Mode Hybride : API REST (ESP8266) + Socket.io (Mobile)
// ============================================================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const database = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// État actuel des dispositifs (partagé entre API et Socket.io)
let deviceState = {
  lamp: false,
  alarm: false,
  temperature: 20.0,
  humidity: 40.0,
  lastUpdate: Date.now()
};

// Dispositifs ESP8266 enregistrés
const registeredDevices = new Map();

// ============================================================================
// ROUTES API REST (pour ESP8266)
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    message: 'Fembe IoT Server (Hybrid Mode)',
    version: '2.0.0',
    status: 'running',
    connectedClients: io.engine.clientsCount,
    registeredDevices: registeredDevices.size,
    endpoints: {
      esp8266: {
        register: 'POST /api/esp8266/register',
        sensor: 'POST /api/esp8266/sensor',
        state: 'GET /api/esp8266/state',
        confirm: 'POST /api/esp8266/confirm'
      },
      mobile: {
        state: 'GET /api/state',
        history: 'GET /api/history/:type',
        commands: 'GET /api/commands',
        stats: 'GET /api/stats'
      }
    }
  });
});

// ============================================================================
// ENDPOINTS ESP8266
// ============================================================================

/**
 * Enregistrer un nouveau dispositif ESP8266
 * POST /api/esp8266/register
 * Body: { deviceId, deviceType, capabilities }
 */
app.post('/api/esp8266/register', async (req, res) => {
  const { deviceId, deviceType, capabilities } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required' });
  }
  
  registeredDevices.set(deviceId, {
    deviceType,
    capabilities,
    registeredAt: new Date(),
    lastSeen: new Date()
  });
  
  console.log(`📱 ESP8266 registered: ${deviceId}`);
  
  res.json({
    success: true,
    deviceId,
    message: 'Device registered successfully',
    currentState: deviceState
  });
});

/**
 * Recevoir données capteurs de l'ESP8266
 * POST /api/esp8266/sensor
 * Body: { deviceId, temperature, humidity, timestamp }
 */
app.post('/api/esp8266/sensor', async (req, res) => {
  const { deviceId, temperature, humidity, timestamp } = req.body;
  
  if (!deviceId || temperature === undefined || humidity === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Mettre à jour l'état global
  deviceState.temperature = temperature;
  deviceState.humidity = humidity;
  deviceState.lastUpdate = Date.now();
  
  // Mettre à jour last seen
  if (registeredDevices.has(deviceId)) {
    const device = registeredDevices.get(deviceId);
    device.lastSeen = new Date();
  }
  
  // Sauvegarder dans la base de données
  try {
    await database.saveSensorData('temperature', temperature);
    await database.saveSensorData('humidity', humidity);
  } catch (error) {
    console.error('Database error:', error);
  }
  
  console.log(`📊 Sensor data from ${deviceId}: ${temperature}°C, ${humidity}%`);
  
  // Broadcast aux clients mobile via Socket.io
  io.emit('sensor_update', {
    temp: temperature,
    humidity: humidity
  });
  
  res.json({
    success: true,
    message: 'Sensor data received'
  });
});

/**
 * ESP8266 vérifie l'état des dispositifs (polling)
 * GET /api/esp8266/state?deviceId=xxx
 */
app.get('/api/esp8266/state', (req, res) => {
  const { deviceId } = req.query;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required' });
  }
  
  // Mettre à jour last seen
  if (registeredDevices.has(deviceId)) {
    const device = registeredDevices.get(deviceId);
    device.lastSeen = new Date();
  }
  
  res.json({
    lamp: deviceState.lamp,
    alarm: deviceState.alarm,
    timestamp: deviceState.lastUpdate
  });
});

/**
 * ESP8266 confirme l'exécution d'une action
 * POST /api/esp8266/confirm
 * Body: { deviceId, action, state, timestamp }
 */
app.post('/api/esp8266/confirm', async (req, res) => {
  const { deviceId, action, state, timestamp } = req.body;
  
  console.log(`✓ Action confirmed from ${deviceId}: ${action} = ${state}`);
  
  // Log dans la base de données
  try {
    await database.saveDeviceAction(action, state);
  } catch (error) {
    console.error('Database error:', error);
  }
  
  res.json({ success: true });
});

// ============================================================================
// ENDPOINTS MOBILE (inchangés)
// ============================================================================

app.get('/api/state', (req, res) => {
  res.json(deviceState);
});

app.get('/api/history/:type', async (req, res) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  try {
    const history = await database.getSensorHistory(type, limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/commands', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  try {
    const commands = await database.getCommandHistory(limit);
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await database.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SOCKET.IO - GESTION DES CONNEXIONS MOBILE
// ============================================================================

io.on('connection', (socket) => {
  console.log(`✅ Mobile client connected: ${socket.id}`);
  
  // Envoyer l'état actuel au client mobile
  socket.emit('lamp_status', { status: deviceState.lamp });
  socket.emit('alarm_status', { status: deviceState.alarm });
  socket.emit('sensor_update', {
    temp: deviceState.temperature,
    humidity: deviceState.humidity
  });

  // ============================================================================
  // ÉVÉNEMENT: Toggle Lampe (depuis mobile)
  // ============================================================================
  socket.on('toggle_lamp', async () => {
    deviceState.lamp = !deviceState.lamp;
    deviceState.lastUpdate = Date.now();
    
    console.log(`💡 Lamp toggled (mobile): ${deviceState.lamp ? 'ON' : 'OFF'}`);
    
    // Sauvegarder dans la base de données
    await database.saveDeviceAction('lamp', deviceState.lamp);
    
    // Notifier TOUS les clients mobile
    io.emit('lamp_status', { status: deviceState.lamp });
    
    // L'ESP8266 récupérera l'état lors du prochain polling
  });

  // ============================================================================
  // ÉVÉNEMENT: Toggle Alarme (depuis mobile)
  // ============================================================================
  socket.on('toggle_alarm', async () => {
    deviceState.alarm = !deviceState.alarm;
    deviceState.lastUpdate = Date.now();
    
    console.log(`🚨 Alarm toggled (mobile): ${deviceState.alarm ? 'ON' : 'OFF'}`);
    
    await database.saveDeviceAction('alarm', deviceState.alarm);
    io.emit('alarm_status', { status: deviceState.alarm });
  });

  // ============================================================================
  // ÉVÉNEMENT: Commande Vocale (depuis mobile)
  // ============================================================================
  socket.on('voice_command', async (data) => {
    const command = data.command.toLowerCase();
    console.log(`🎤 Voice command from mobile: "${command}"`);
    
    await database.saveVoiceCommand(command);
    
    const result = parseVoiceCommand(command);
    
    if (result.action === 'lamp') {
      deviceState.lamp = result.state;
      deviceState.lastUpdate = Date.now();
      await database.saveDeviceAction('lamp', deviceState.lamp);
      io.emit('lamp_status', { status: deviceState.lamp });
      
      socket.emit('command_result', {
        success: true,
        message: `Lampe ${result.state ? 'allumée' : 'éteinte'}`
      });
    } else if (result.action === 'alarm') {
      deviceState.alarm = result.state;
      deviceState.lastUpdate = Date.now();
      await database.saveDeviceAction('alarm', deviceState.alarm);
      io.emit('alarm_status', { status: deviceState.alarm });
      
      socket.emit('command_result', {
        success: true,
        message: `Alarme ${result.state ? 'activée' : 'désactivée'}`
      });
    } else {
      socket.emit('command_result', {
        success: false,
        message: 'Commande non reconnue'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Mobile client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// FONCTION: Parser les commandes vocales
// ============================================================================
function parseVoiceCommand(command) {
  const normalized = command.toLowerCase().trim();
  
  // Commandes pour la lampe
  if (normalized.match(/allum(e|er)?.*lampe|lampe.*allum/i)) {
    return { action: 'lamp', state: true };
  }
  if (normalized.match(/étein(s|dre)?.*lampe|lampe.*étein|ferme.*lampe/i)) {
    return { action: 'lamp', state: false };
  }
  
  // Commandes pour l'alarme
  if (normalized.match(/activ(e|er)?.*alarme|alarme.*activ|allum.*alarme/i)) {
    return { action: 'alarm', state: true };
  }
  if (normalized.match(/désactiv.*alarme|alarme.*désactiv|étein.*alarme|ferme.*alarme/i)) {
    return { action: 'alarm', state: false };
  }
  
  return { action: null, state: null };
}

// ============================================================================
// TÂCHE PÉRIODIQUE: Nettoyer dispositifs inactifs
// ============================================================================
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 1 minute
  
  for (const [deviceId, device] of registeredDevices.entries()) {
    if (now - device.lastSeen.getTime() > timeout) {
      console.log(`⚠️  Device timeout: ${deviceId}`);
      registeredDevices.delete(deviceId);
    }
  }
}, 30000); // Vérifier toutes les 30 secondes

// ============================================================================
// INITIALISATION
// ============================================================================
async function initialize() {
  try {
    await database.initialize();
    console.log('✅ Database initialized');
    
    server.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`   Fembe Server (Hybrid Mode) - Port ${PORT}`);
      console.log('   ========================================');
      console.log(`   📍 API: http://localhost:${PORT}`);
      console.log(`   🔌 Socket.io: ws://localhost:${PORT}`);
      console.log('   ========================================');
      console.log('   Mode: API REST (ESP8266) + Socket.io (Mobile)');
      console.log('   ========================================\n');
    });
  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
}

// Gérer l'arrêt propre
process.on('SIGINT', async () => {
  console.log('\n⏳ Shutting down server...');
  await database.close();
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

initialize();
