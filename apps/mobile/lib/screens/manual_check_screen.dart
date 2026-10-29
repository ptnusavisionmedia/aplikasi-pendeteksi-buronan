import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api_client.dart';
import '../core/theme.dart';

class ManualCheckScreen extends ConsumerStatefulWidget {
  const ManualCheckScreen({super.key});

  @override
  ConsumerState<ManualCheckScreen> createState() => _ManualCheckScreenState();
}

class _ManualCheckScreenState extends ConsumerState<ManualCheckScreen> {
  Uint8List? _pickedBytes;
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _result;

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _pickedBytes = bytes;
      _result = null;
      _error = null;
    });
    await _check(bytes, file.name);
  }

  Future<void> _check(Uint8List bytes, String filename) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final dio = ref.read(dioProvider);
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: filename),
      });
      final response = await dio.post('/detections/upload-check', data: formData);
      setState(() => _result = response.data as Map<String, dynamic>);
    } catch (err) {
      setState(() => _error = apiErrorMessage(err, 'Gagal memeriksa foto'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final candidates = (_result?['candidates'] as List?) ?? [];
    final matched = _result?['matched'] == true;

    return Scaffold(
      appBar: AppBar(title: const Text('Periksa Foto Manual')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: _loading ? null : () => _pickImage(ImageSource.camera),
                child: Container(
                  width: double.infinity,
                  height: 180,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.line, width: 2),
                  ),
                  child: _pickedBytes != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.memory(_pickedBytes!, fit: BoxFit.cover, width: double.infinity),
                        )
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.camera_alt_outlined, color: AppColors.muted, size: 28),
                            SizedBox(height: 8),
                            Text('Ambil foto dari kamera', style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: _loading ? null : () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library_outlined, size: 18),
                label: const Text('Pilih dari galeri'),
              ),
              const SizedBox(height: 16),
              if (_loading) const Center(child: CircularProgressIndicator()),
              if (_error != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.coralSoft, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: AppColors.coral, fontSize: 12.5)),
                ),
              if (_result != null && !_loading)
                BentoCell(
                  child: matched
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Kandidat ditemukan', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                            const SizedBox(height: 8),
                            ...candidates.map((c) {
                              final confidence = ((c['confidence'] as num) * 100).round();
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Text('Confidence: $confidence%', style: const TextStyle(fontSize: 13)),
                              );
                            }),
                          ],
                        )
                      : const Text('Tidak ada kecocokan ditemukan.', style: TextStyle(color: AppColors.muted)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
