const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || './fembe.db';
let db;

// ============================================================================
// INITIALISATION DE LA BASE DE DONNÉES
// ============================================================================
function initialize() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`Base de données: ${DB_PATH}`);
                createTables()
                    .then(resolve)
                    .catch(reject);
            }
        });
    });
}

// ============================================================================
// CRÉATION DES TABLES
// ============================================================================
function createTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Table pour les données des capteurs
            db.run(`
        CREATE TABLE IF NOT EXISTS sensor_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sensor_type TEXT NOT NULL,
          value REAL NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
                if (err) console.error('Erreur création table sensor_data:', err);
            });

            // Index pour améliorer les performances des requêtes
            db.run(`
        CREATE INDEX IF NOT EXISTS idx_sensor_type_timestamp 
        ON sensor_data(sensor_type, timestamp DESC)
      `, (err) => {
                if (err) console.error('Erreur création index sensor_data:', err);
            });

            // Table pour les actions des dispositifs
            db.run(`
        CREATE TABLE IF NOT EXISTS device_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_name TEXT NOT NULL,
          state INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
                if (err) console.error('Erreur création table device_actions:', err);
            });

            // Table pour les commandes vocales
            db.run(`
        CREATE TABLE IF NOT EXISTS voice_commands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          command TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
                if (err) {
                    console.error('Erreur création table voice_commands:', err);
                    reject(err);
                } else {
                    console.log('Tables de base de données créées');
                    resolve();
                }
            });
        });
    });
}

// ============================================================================
// SAUVEGARDER LES DONNÉES DES CAPTEURS
// ============================================================================
function saveSensorData(sensorType, value) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO sensor_data (sensor_type, value) VALUES (?, ?)',
            [sensorType, value],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// ============================================================================
// SAUVEGARDER LES ACTIONS DES DISPOSITIFS
// ============================================================================
function saveDeviceAction(deviceName, state) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO device_actions (device_name, state) VALUES (?, ?)',
            [deviceName, state ? 1 : 0],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// ============================================================================
// SAUVEGARDER LES COMMANDES VOCALES
// ============================================================================
function saveVoiceCommand(command) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO voice_commands (command) VALUES (?)',
            [command],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// ============================================================================
// OBTENIR L'HISTORIQUE DES CAPTEURS
// ============================================================================
function getSensorHistory(sensorType, limit = 50) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM sensor_data 
       WHERE sensor_type = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
            [sensorType, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// ============================================================================
// OBTENIR L'HISTORIQUE DES ACTIONS
// ============================================================================
function getDeviceHistory(deviceName, limit = 20) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM device_actions 
       WHERE device_name = ?
       ORDER BY timestamp DESC 
       LIMIT ?`,
            [deviceName, limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// ============================================================================
// OBTENIR L'HISTORIQUE DES COMMANDES
// ============================================================================
function getCommandHistory(limit = 20) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM voice_commands 
       ORDER BY timestamp DESC 
       LIMIT ?`,
            [limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// ============================================================================
// OBTENIR LES STATISTIQUES
// ============================================================================
function getStats() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
        (SELECT COUNT(*) FROM sensor_data) as total_sensor_readings,
        (SELECT COUNT(*) FROM device_actions) as total_device_actions,
        (SELECT COUNT(*) FROM voice_commands) as total_voice_commands,
        (SELECT AVG(value) FROM sensor_data WHERE sensor_type = 'temperature') as avg_temperature,
        (SELECT AVG(value) FROM sensor_data WHERE sensor_type = 'humidity') as avg_humidity,
        (SELECT MIN(value) FROM sensor_data WHERE sensor_type = 'temperature') as min_temperature,
        (SELECT MAX(value) FROM sensor_data WHERE sensor_type = 'temperature') as max_temperature,
        (SELECT MIN(value) FROM sensor_data WHERE sensor_type = 'humidity') as min_humidity,
        (SELECT MAX(value) FROM sensor_data WHERE sensor_type = 'humidity') as max_humidity
      `,
            [],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// ============================================================================
// NETTOYER LES ANCIENNES DONNÉES (optionnel)
// ============================================================================
function cleanOldData(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
        const date = new Date();
        date.setDate(date.getDate() - daysToKeep);
        const cutoffDate = date.toISOString();

        db.serialize(() => {
            db.run(
                'DELETE FROM sensor_data WHERE timestamp < ?',
                [cutoffDate],
                (err) => {
                    if (err) console.error('Erreur nettoyage sensor_data:', err);
                }
            );

            db.run(
                'DELETE FROM device_actions WHERE timestamp < ?',
                [cutoffDate],
                (err) => {
                    if (err) console.error('Erreur nettoyage device_actions:', err);
                }
            );

            db.run(
                'DELETE FROM voice_commands WHERE timestamp < ?',
                [cutoffDate],
                (err) => {
                    if (err) {
                        console.error('Erreur nettoyage voice_commands:', err);
                        reject(err);
                    } else {
                        console.log(`Données de plus de ${daysToKeep} jours supprimées`);
                        resolve();
                    }
                }
            );
        });
    });
}

// ============================================================================
// FERMER LA BASE DE DONNÉES
// ============================================================================
function close() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) reject(err);
                else {
                    console.log(' Base de données fermée');
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

module.exports = {
    initialize,
    saveSensorData,
    saveDeviceAction,
    saveVoiceCommand,
    getSensorHistory,
    getDeviceHistory,
    getCommandHistory,
    getStats,
    cleanOldData,
    close
};