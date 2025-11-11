import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/iot_provider.dart';

class ControlWidget extends StatelessWidget {
  final IconData icon;
  final IconData iconOff;
  final String title;
  final bool Function(IotProvider) isOnGetter;
  final void Function(IotProvider) onToggle;
  final Color colorOn;

  const ControlWidget({
    super.key,
    required this.icon,
    required this.iconOff,
    required this.title,
    required this.isOnGetter,
    required this.onToggle,
    required this.colorOn,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<IotProvider>(
      builder: (context, provider, child) {
        final isOn = isOnGetter(provider);
        return InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            onToggle(context.read<IotProvider>());
          },
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            decoration: BoxDecoration(
              color: isOn ? colorOn : Colors.grey[850],
              borderRadius: BorderRadius.circular(16),
              boxShadow: isOn
                  ? [
                      BoxShadow(
                        color: colorOn.withValues(alpha: 0.4),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ]
                  : [],
            ),
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  transitionBuilder: (child, animation) {
                    return ScaleTransition(scale: animation, child: child);
                  },
                  child: Icon(
                    isOn ? icon : iconOff,
                    key: ValueKey(isOn),
                    size: 48,
                    color: isOn ? Colors.white : Colors.grey[400],
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isOn ? Colors.white : Colors.grey[400],
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: Text(
                    isOn ? 'Allumée' : 'Éteinte',
                    key: ValueKey(isOn),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isOn ? Colors.white70 : Colors.grey[600],
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
