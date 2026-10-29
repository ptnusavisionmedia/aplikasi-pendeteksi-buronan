import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api_client.dart';
import '../core/theme.dart';

class LaporScreen extends ConsumerStatefulWidget {
  const LaporScreen({super.key});

  @override
  ConsumerState<LaporScreen> createState() => _LaporScreenState();
}

class _LaporScreenState extends ConsumerState<LaporScreen> {
  final _lokasiController = TextEditingController();
  final _deskripsiController = TextEditingController();
  Uint8List? _photoBytes;
  String? _photoName;
  bool _anonim = true;
  bool _loading = false;
  bool _locating = false;
  String? _error;
  String? _ticketId;

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _photoBytes = bytes;
      _photoName = file.name;
    });
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _locating = true);
    try {
      final permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        setState(() => _error = 'Izin lokasi ditolak. Isi lokasi secara manual.');
        return;
      }
      final position = await Geolocator.getCurrentPosition();
      _lokasiController.text = '${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}';
    } catch (_) {
      setState(() => _error = 'Gagal mengambil lokasi. Isi lokasi secara manual.');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _submit() async {
    if (_photoBytes == null) {
      setState(() => _error = 'Foto wajib dilampirkan');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    final dio = ref.read(dioProvider);
    try {
      final formData = FormData.fromMap({
        'lokasi': _lokasiController.text.trim(),
        if (_deskripsiController.text.isNotEmpty) 'deskripsi': _deskripsiController.text.trim(),
        'anonim': _anonim.toString(),
        'foto': MultipartFile.fromBytes(_photoBytes!, filename: _photoName ?? 'foto.jpg'),
      });
      final response = await dio.post('/reports', data: formData);
      setState(() => _ticketId = response.data['ticketId'] as String);
    } catch (err) {
      setState(() => _error = apiErrorMessage(err, 'Gagal mengirim laporan'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_ticketId != null) {
      return SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_outline, color: AppColors.primary, size: 40),
                const SizedBox(height: 12),
                const Text('Laporan terkirim', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 4),
                const Text('Simpan nomor tiket ini untuk mengecek status laporan.',
                    textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
                  child: Text(_ticketId!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.primaryInk, fontWeight: FontWeight.w800, fontSize: 16)),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => context.go('/status'),
                  child: const Text('Cek status laporan'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lapor Temuan', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const Text('Bantu kami menjaga wilayah Anda', style: TextStyle(color: AppColors.muted, fontSize: 12)),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.coralSoft, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: AppColors.coral, fontSize: 12.5)),
              ),
              const SizedBox(height: 12),
            ],
            GestureDetector(
              onTap: _pickPhoto,
              child: Container(
                width: double.infinity,
                height: 128,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line, width: 2),
                ),
                child: _photoBytes != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Image.memory(_photoBytes!, fit: BoxFit.cover, width: double.infinity),
                      )
                    : const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.camera_alt_outlined, color: AppColors.muted, size: 24),
                          SizedBox(height: 6),
                          Text('Ambil foto / unggah dari galeri', style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _lokasiController,
                    decoration: const InputDecoration(labelText: 'Lokasi'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  onPressed: _locating ? null : _useCurrentLocation,
                  icon: _locating
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.my_location, size: 18),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _deskripsiController,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Deskripsi singkat', hintText: 'Ciri-ciri, waktu melihat, dll.'),
            ),
            const SizedBox(height: 10),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _anonim,
              onChanged: (value) => setState(() => _anonim = value),
              title: const Text('Kirim sebagai anonim', style: TextStyle(fontSize: 13.5)),
              activeThumbColor: AppColors.primary,
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _submit,
                icon: const Icon(Icons.send, size: 18),
                label: Text(_loading ? 'Mengirim...' : 'Kirim Laporan'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
