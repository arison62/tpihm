let simulationInterval;

// ============================================================================
// DÉMARRER LA SIMULATION DES CAPTEURS
// ============================================================================
function start(interval, callback) {
    let temperature = 20.0;
    let humidity = 40.0;

    simulationInterval = setInterval(() => {
        // Variation aléatoire de la température (-0.5 à +0.5)
        temperature += (Math.random() - 0.5) * 1.0;
        temperature = Math.max(15, Math.min(30, temperature)); // Entre 15 et 30°C

        // Variation aléatoire de l'humidité (-2 à +2)
        humidity += (Math.random() - 0.5) * 4.0;
        humidity = Math.max(30, Math.min(70, humidity)); // Entre 30 et 70%

        const sensorData = {
            temperature: parseFloat(temperature.toFixed(1)),
            humidity: parseFloat(humidity.toFixed(1))
        };

        console.log(`Capteurs: ${sensorData.temperature}°C, ${sensorData.humidity}%`);
        callback(sensorData);
    }, interval);
}

// ============================================================================
// ARRÊTER LA SIMULATION
// ============================================================================
function stop() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        console.log('Simulateur de capteurs arrêté');
    }
}

module.exports = {
    start,
    stop
};