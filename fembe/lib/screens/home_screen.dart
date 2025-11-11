import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/iot_provider.dart';
import '../widgets/sensor_card.dart';
import '../widgets/control_widget.dart';
import '../widgets/chart_widget.dart';
import '../widgets/voice_control_widget.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fembe'),
        actions: [
          Consumer<IotProvider>(
            builder: (context, provider, child) {
              return Padding(
                padding: const EdgeInsets.only(right: 16),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: Icon(
                    provider.isSocketConnected
                        ? Icons.cloud_done_rounded
                        : Icons.cloud_off_rounded,
                    key: ValueKey(provider.isSocketConnected),
                    color: provider.isSocketConnected
                        ? Colors.green
                        : Colors.red,
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Capteurs (Température & Humidité)
            Row(
              children: [
                Expanded(
                  child: SensorCard(
                    icon: Icons.thermostat_rounded,
                    title: 'Température',
                    valueGetter: (provider) => provider.temperature,
                    unit: '°C',
                    color: Colors.orange,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: SensorCard(
                    icon: Icons.water_drop_rounded,
                    title: 'Humidité',
                    valueGetter: (provider) => provider.humidity,
                    unit: '%',
                    color: Colors.blue,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Contrôles (Lampe & Alarme)
            Row(
              children: [
                Expanded(
                  child: ControlWidget(
                    icon: Icons.lightbulb_rounded,
                    iconOff: Icons.lightbulb_outline_rounded,
                    title: 'Lampe',
                    isOnGetter: (provider) => provider.isLampOn,
                    onToggle: (provider) => provider.toggleLamp(),
                    colorOn: Colors.amber[700]!,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ControlWidget(
                    icon: Icons.alarm_on_rounded,
                    iconOff: Icons.alarm_rounded,
                    title: 'Alarme',
                    isOnGetter: (provider) => provider.isAlarmOn,
                    onToggle: (provider) => provider.toggleAlarm(),
                    colorOn: Colors.red[700]!,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Graphique
            const ChartWidget(),
            const SizedBox(height: 100), // Espace pour le bouton vocal
          ],
        ),
      ),
      floatingActionButton: const VoiceControlWidget(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
