import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/iot_provider.dart';

class SensorCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final double Function(IotProvider) valueGetter;
  final String unit;
  final Color color;

  const SensorCard({
    super.key,
    required this.icon,
    required this.title,
    required this.valueGetter,
    required this.unit,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<IotProvider>(
      builder: (context, provider, child) {
        final value = valueGetter(provider);
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Icon(icon, size: 40, color: color),
                const SizedBox(height: 8),
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 12),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 400),
                  transitionBuilder: (child, animation) {
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.3),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    );
                  },
                  child: Text(
                    '${value.toStringAsFixed(1)}$unit',
                    key: ValueKey(value),
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
