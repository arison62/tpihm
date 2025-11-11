require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const database = require('./database');
const sensorSimulator = require('./sensorSimulator');

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

// État actuel des dispositifs
let deviceState = {
    lamp: false,
    alarm: false,
    temperature: 20.0,
    humidity: 40.0
};

// ============================================================================
// ROUTES API REST (optionnelles, pour consultation)
// ============================================================================

app.get('/', (req, res) => {
    res.json({
        message: 'Fembe IoT Server',
        version: '1.0.0',
        status: 'running',
        connectedClients: io.engine.clientsCount
    });
});

// Obtenir l'état actuel
app.get('/api/state', (req, res) => {
    res.json(deviceState);
});

// Obtenir l'historique des capteurs
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

// Obtenir l'historique des commandes
app.get('/api/commands', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;

    try {
        const commands = await database.getCommandHistory(limit);
        res.json(commands);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Statistiques
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await database.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// SOCKET.IO - GESTION DES CONNEXIONS
// ============================================================================

io.on('connection', (socket) => {
    console.log(`✅ Nouveau client connecté: ${socket.id}`);

    // Envoyer l'état actuel au client qui vient de se connecter
    socket.emit('lamp_status', { status: deviceState.lamp });
    socket.emit('alarm_status', { status: deviceState.alarm });
    socket.emit('sensor_update', {
        temp: deviceState.temperature,
        humidity: deviceState.humidity
    });

    // ============================================================================
    // ÉVÉNEMENT: Toggle Lampe
    // ============================================================================
    socket.on('toggle_lamp', async () => {
        deviceState.lamp = !deviceState.lamp;
        console.log(`💡 Lampe: ${deviceState.lamp ? 'ON' : 'OFF'}`);

        // Sauvegarder dans la base de données
        await database.saveDeviceAction('lamp', deviceState.lamp);

        // Notifier TOUS les clients connectés
        io.emit('lamp_status', { status: deviceState.lamp });

        // TODO: Ici, envoyer la commande au dispositif physique réel
        // await sendToPhysicalDevice('lamp', deviceState.lamp);
    });

    // ============================================================================
    // ÉVÉNEMENT: Toggle Alarme
    // ============================================================================
    socket.on('toggle_alarm', async () => {
        deviceState.alarm = !deviceState.alarm;
        console.log(`🚨 Alarme: ${deviceState.alarm ? 'ON' : 'OFF'}`);

        await database.saveDeviceAction('alarm', deviceState.alarm);
        io.emit('alarm_status', { status: deviceState.alarm });

        // TODO: Ici, envoyer la commande au dispositif physique réel
    });

    // ============================================================================
    // ÉVÉNEMENT: Commande Vocale
    // ============================================================================
    socket.on('voice_command', async (data) => {
        const command = data.command.toLowerCase();
        console.log(`🎤 Commande vocale reçue: "${command}"`);

        // Sauvegarder la commande
        await database.saveVoiceCommand(command);

        // Analyser la commande
        const result = parseVoiceCommand(command);

        if (result.action === 'lamp') {
            deviceState.lamp = result.state;
            await database.saveDeviceAction('lamp', deviceState.lamp);
            io.emit('lamp_status', { status: deviceState.lamp });

            socket.emit('command_result', {
                success: true,
                message: `Lampe ${result.state ? 'allumée' : 'éteinte'}`
            });
        } else if (result.action === 'alarm') {
            deviceState.alarm = result.state;
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

    // ============================================================================
    // ÉVÉNEMENT: Déconnexion
    // ============================================================================
    socket.on('disconnect', () => {
        console.log(`❌ Client déconnecté: ${socket.id}`);
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
// INITIALISATION
// ============================================================================
async function initialize() {
    try {
        // Initialiser la base de données
        await database.initialize();
        console.log('✅ Base de données initialisée');

        // Démarrer le simulateur de capteurs (pour les tests)
        if (process.env.ENABLE_SENSOR_SIMULATION === 'true') {
            const interval = parseInt(process.env.SENSOR_UPDATE_INTERVAL) || 5000;
            sensorSimulator.start(interval, async (sensorData) => {
                deviceState.temperature = sensorData.temperature;
                deviceState.humidity = sensorData.humidity;

                // Sauvegarder dans la base de données
                await database.saveSensorData('temperature', sensorData.temperature);
                await database.saveSensorData('humidity', sensorData.humidity);

                // Envoyer aux clients connectés
                io.emit('sensor_update', {
                    temp: sensorData.temperature,
                    humidity: sensorData.humidity
                });
            });
            console.log('✅ Simulateur de capteurs démarré');
        }

        // Démarrer le serveur
        server.listen(PORT, () => {
            console.log('\n🚀 ========================================');
            console.log(`   Serveur Fembe démarré sur le port ${PORT}`);
            console.log('   ========================================');
            console.log(`   📍 API: http://localhost:${PORT}`);
            console.log(`   🔌 Socket.io: ws://localhost:${PORT}`);
            console.log('   ========================================\n');
        });
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        process.exit(1);
    }
}

// Gérer l'arrêt propre du serveur
process.on('SIGINT', async () => {
    console.log('\n⏳ Arrêt du serveur...');
    sensorSimulator.stop();
    await database.close();
    server.close(() => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
    });
});

// Lancer l'initialisation
initialize();