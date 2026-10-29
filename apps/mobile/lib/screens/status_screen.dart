import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/report.dart';

const _statusLabel = {
  'MENUNGGU_VERIFIKASI': 'Menunggu verifikasi',
  'VALID': 'Terverifikasi valid',
  'TIDAK_VALID': 'Tidak valid',
  'INVESTIGASI_LANJUTAN': 'Investigasi lanjutan',
};

const _stageLabels = ['Diterima', 'Diverifikasi', 'Ditindaklanjuti', 'Selesai'];

class StatusScreen extends ConsumerStatefulWidget {
  const StatusScreen({super.key});

  @override
  ConsumerState<StatusScreen> createState() => _StatusScreenState();
}

class _StatusScreenState extends ConsumerState<StatusScreen> {
  final _ticketController = TextEditingController();
  bool _loading = false;
  String? _error;
  ReportStatus? _result;

  Future<void> _check() async {
    if (_ticketController.text.trim().isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });
    final dio = ref.read(dioProvider);
    try {
      final response = await dio.get('/reports/${_ticketController.text.trim()}');
      setState(() => _result = ReportStatus.fromJson(response.data as Map<String, dynamic>));
    } catch (err) {
      setState(() => _error = apiErrorMessage(err, 'Laporan tidak ditemukan'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Status Laporan', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const Text('Pantau laporan yang Anda kirim', style: TextStyle(color: AppColors.muted, fontSize: 12)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ticketController,
                    decoration: const InputDecoration(labelText: 'Nomor tiket', hintText: 'contoh: clxk2j...'),
                    onSubmitted: (_) => _check(),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(onPressed: _loading ? null : _check, child: const Text('Cek')),
              ],
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
            if (_result != null) _ResultCard(result: _result!),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final ReportStatus result;

  const _ResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final step = result.stepIndex;
    return BentoCell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('#${result.ticketId}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(20)),
                child: Text(_statusLabel[result.status] ?? result.status,
                    style: const TextStyle(color: AppColors.amber, fontWeight: FontWeight.w700, fontSize: 10.5)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('Dilaporkan ${DateFormat('HH:mm, dd MMM yyyy').format(result.createdAt)}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          const SizedBox(height: 14),
          Row(
            children: List.generate(4, (i) {
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
                  height: 6,
                  decoration: BoxDecoration(
                    color: i < step ? AppColors.primary : AppColors.line,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _stageLabels
                .map((label) => Text(label, style: const TextStyle(fontSize: 9.5, color: AppColors.muted)))
                .toList(),
          ),
        ],
      ),
    );
  }
}
