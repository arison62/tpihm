import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import '../providers/iot_provider.dart';


enum VoiceState { idle, recording, locked }

class VoiceControlWidget extends StatefulWidget {
  const VoiceControlWidget({super.key});

  @override
  State<VoiceControlWidget> createState() => _VoiceControlWidgetState();
}

class _VoiceControlWidgetState extends State<VoiceControlWidget>
    with TickerProviderStateMixin {
  VoiceState _state = VoiceState.idle;
  final _audioRecorder = AudioRecorder();
  String? _audioPath;

  // Animations
  late AnimationController _pulseController;
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  // Positions pour le drag
  double _dragOffsetX = 0;
  double _dragOffsetY = 0;
  bool _showCancelHint = false;
  bool _showLockHint = false;

  // Timer pour l'enregistrement verrouillé
  int _recordingSeconds = 0;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..repeat(reverse: true);

    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.3,
    ).animate(CurvedAnimation(parent: _scaleController, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _scaleController.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<void> _requestPermission() async {
    final status = await Permission.microphone.request();
    if (!status.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Permission microphone requise'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _startRecording() async {
    await _requestPermission();

    if (await _audioRecorder.hasPermission()) {
      final path =
          '/tmp/voice_command_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _audioRecorder.start(const RecordConfig(), path: path);
      _audioPath = path;

      setState(() {
        _state = VoiceState.recording;
        _showCancelHint = true;
        _showLockHint = true;
      });

      _scaleController.forward();
      HapticFeedback.mediumImpact();
    }
  }

  Future<void> _stopRecording({bool cancel = false}) async {
    await _audioRecorder.stop();

    setState(() {
      _state = VoiceState.idle;
      _dragOffsetX = 0;
      _dragOffsetY = 0;
      _showCancelHint = false;
      _showLockHint = false;
      _recordingSeconds = 0;
    });

    _scaleController.reverse();

    if (!cancel && _audioPath != null && mounted) {
      // Ici, l'audio sera envoyé à une API pour transcription
      // Pour l'instant, simulons avec un texte
      const simulatedTranscription = 'Allume la lampe';
      context.read<IotProvider>().sendVoiceCommand(simulatedTranscription);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Commande: $simulatedTranscription'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 2),
        ),
      );
    }

    _audioPath = null;
  }

  void _lockRecording() {
    setState(() {
      _state = VoiceState.locked;
      _dragOffsetX = 0;
      _dragOffsetY = 0;
      _showCancelHint = false;
      _showLockHint = false;
    });

    HapticFeedback.heavyImpact();

    // Démarrer le compteur
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (_state == VoiceState.locked && mounted) {
        setState(() => _recordingSeconds++);
        return true;
      }
      return false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_state == VoiceState.locked) {
      return _buildLockedUI();
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        // Hints
        if (_showCancelHint)
          Positioned(
            left: 40,
            child: AnimatedOpacity(
              opacity: _showCancelHint ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 200),
              child: Row(
                children: [
                  const Icon(Icons.arrow_back, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Glisser pour annuler',
                    style: TextStyle(color: Colors.grey[400], fontSize: 14),
                  ),
                ],
              ),
            ),
          ),

        if (_showLockHint)
          Positioned(
            top: -60,
            child: AnimatedOpacity(
              opacity: _showLockHint ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 200),
              child: Column(
                children: [
                  const Icon(
                    Icons.lock_outline,
                    color: Colors.white70,
                    size: 24,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Glisser pour verrouiller',
                    style: TextStyle(color: Colors.grey[400], fontSize: 12),
                  ),
                ],
              ),
            ),
          ),

        // Bouton microphone principal
        Transform.translate(
          offset: Offset(_dragOffsetX, _dragOffsetY),
          child: GestureDetector(
            onLongPressStart: (_) => _startRecording(),
            onLongPressMoveUpdate: (details) {
              setState(() {
                _dragOffsetX = details.localPosition.dx - 35;
                _dragOffsetY = details.localPosition.dy - 35;
              });
            },
            onLongPressEnd: (_) {
              if (_dragOffsetX < -50) {
                // Annuler
                _stopRecording(cancel: true);
              } else if (_dragOffsetY < -50) {
                // Verrouiller
                _lockRecording();
              } else {
                // Envoyer
                _stopRecording();
              }
            },
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Animation de pulsation
                if (_state == VoiceState.recording)
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return Container(
                        width: 70 + (_pulseController.value * 20),
                        height: 70 + (_pulseController.value * 20),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.red.withValues(
                            alpha: 0.2 * (1 - _pulseController.value),
                          ),
                        ),
                      );
                    },
                  ),

                // Bouton principal
                ScaleTransition(
                  scale: _scaleAnimation,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _state == VoiceState.recording
                          ? Colors.red
                          : Theme.of(context).colorScheme.primaryContainer,
                      boxShadow: [
                        BoxShadow(
                          color:
                              (_state == VoiceState.recording
                                      ? Colors.red
                                      : Theme.of(context).colorScheme.primary)
                                  .withValues(alpha: 0.4),
                          blurRadius: 20,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.mic_rounded,
                      size: 32,
                      color: _state == VoiceState.recording
                          ? Colors.white
                          : Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLockedUI() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
      color: Colors.red.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.red, width: 2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Indicateur d'enregistrement
          Container(
            width: 12,
            height: 12,
            decoration: const BoxDecoration(
              color: Colors.red,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),

          // Timer
          Text(
            _formatDuration(_recordingSeconds),
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 16),

          // Bouton Annuler
          TextButton(
            onPressed: () => _stopRecording(cancel: true),
            child: const Text('Annuler', style: TextStyle(color: Colors.red)),
          ),
          const SizedBox(width: 8),

          // Bouton Stop
          IconButton(
            onPressed: () => _stopRecording(),
            icon: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.stop_rounded, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(1, '0')}:${secs.toString().padLeft(2, '0')}';
  }
}
