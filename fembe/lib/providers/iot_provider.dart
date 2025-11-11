import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:fl_chart/fl_chart.dart';

class IotProvider extends ChangeNotifier {
  // État des données
  double temperature = 20.0;
  double humidity = 40.0;
  bool isLampOn = false;
  bool isAlarmOn = false;
  List<FlSpot> tempHistory = [];
  List<FlSpot> humidityHistory = [];
  bool isSocketConnected = false;

  late io.Socket socket;
  int _dataPointCounter = 0;

  IotProvider() {
    _initSocket();
  }

  void _initSocket() {
    // Configuration Socket.io
    socket = io.io(
      'https://tpihm-decc9.sevalla.app/',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    // Événements de connexion
    socket.onConnect((_) {
      isSocketConnected = true;
      debugPrint('Socket.io connecté');
      notifyListeners();
    });

    socket.onDisconnect((_) {
      isSocketConnected = false;
      debugPrint('Socket.io déconnecté');
      notifyListeners();
    });

    // Écouteurs de données
    socket.on('sensor_update', (data) {
      temperature = (data['temp'] ?? 20.0).toDouble();
      humidity = (data['humidity'] ?? 40.0).toDouble();

      // Ajouter aux historiques
      _dataPointCounter++;
      tempHistory.add(FlSpot(_dataPointCounter.toDouble(), temperature));
      humidityHistory.add(FlSpot(_dataPointCounter.toDouble(), humidity));

      // Limiter à 50 points
      if (tempHistory.length > 50) {
        tempHistory.removeAt(0);
        humidityHistory.removeAt(0);
      }

      notifyListeners();
    });

    socket.on('lamp_status', (data) {
      isLampOn = data['status'] ?? false;
      notifyListeners();
    });

    socket.on('alarm_status', (data) {
      isAlarmOn = data['status'] ?? false;
      notifyListeners();
    });

    // Connexion initiale
    socket.connect();
  }

  // Émetteurs
  void toggleLamp() {
    socket.emit('toggle_lamp');
  }

  void toggleAlarm() {
    socket.emit('toggle_alarm');
  }

  void sendVoiceCommand(String text) {
    socket.emit('voice_command', {'command': text});
    debugPrint('Commande vocale envoyée: $text');
  }

  @override
  void dispose() {
    socket.dispose();
    super.dispose();
  }
}
