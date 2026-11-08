import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/notification.dart';
import '../widgets/back_button.dart';

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/notifications');
  return ((response.data as Map<String, dynamic>)['items'] as List)
      .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
      .toList();
});

/// Dibaca juga oleh badge titik merah di ikon lonceng Home — endpoint ringan khusus count, lihat
/// GET /notifications/unread-count di apps/api/src/routes/notifications.ts.
final unreadNotificationCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final dio = ref.read(dioProvider);
  final response = await dio.get('/notifications/unread-count');
  return (response.data as Map<String, dynamic>)['count'] as int;
});

/// Dipindahkan dari blok inline di Home (dulu "Notifikasi Deteksi") ke layar tersendiri yang
/// dibuka lewat ikon lonceng di header Home. Sejak penambahan notifikasi broadcast (buronan
/// baru/tertangkap, berita acara baru — lihat vault/03-Decisions), layar ini merender 4 tipe
/// notifikasi berbeda, bukan cuma deteksi kecocokan wajah.
class NotifikasiScreen extends ConsumerWidget {
  const NotifikasiScreen({super.key});

  Future<void> _markRead(WidgetRef ref, AppNotification n) async {
    if (n.isRead) return;
    try {
      final dio = ref.read(dioProvider);
      await dio.patch('/notifications/${n.id}/read');
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadNotificationCountProvider);
    } catch (_) {
      // Non-fatal — navigasi tetap jalan walau gagal menandai terbaca, pengguna bisa coba lagi
      // nanti lewat tombol "Tandai semua dibaca".
    }
  }

  Future<void> _markAllRead(WidgetRef ref) async {
    final dio = ref.read(dioProvider);
    await dio.patch('/notifications/read-all');
    ref.invalidate(notificationsProvider);
    ref.invalidate(unreadNotificationCountProvider);
  }

  void _openNotification(BuildContext context, WidgetRef ref, AppNotification n) {
    _markRead(ref, n);
    switch (n.type) {
      case 'BURONAN_BARU':
      case 'BURONAN_TERTANGKAP':
        if (n.buronanId != null) context.push('/buronan/${n.buronanId}');
        break;
      case 'BERITA_ACARA_BARU':
        if (n.beritaAcaraId != null) context.push('/berita-acara/${n.beritaAcaraId}', extra: n.beritaAcara);
        break;
      default:
        if (n.detectionEventId != null) context.push('/detection/${n.detectionEventId}');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Notifikasi'),
        actions: [
          TextButton(
            onPressed: () => _markAllRead(ref),
            child: const Text('Tandai semua dibaca', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(notificationsProvider);
            ref.invalidate(unreadNotificationCountProvider);
          },
          child: notificationsAsync.when(
            data: (items) {
              if (items.isEmpty) {
                return ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Belum ada notifikasi.', style: TextStyle(color: AppColors.muted)),
                    ),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (context, index) => const SizedBox(height: 8),
                itemBuilder: (context, index) => _NotificationCard(
                  notification: items[index],
                  onTap: () => _openNotification(context, ref, items[index]),
                ),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('Gagal memuat notifikasi: ${apiErrorMessage(err)}', style: const TextStyle(color: AppColors.coral)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationCard({required this.notification, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final event = n.detectionEvent;
    final confidencePct = event != null ? (event.confidenceScore * 100).round() : null;

    late final IconData icon;
    late final Color tone;
    late final Color toneText;
    late final String title;
    late final String subtitle;

    switch (n.type) {
      case 'BURONAN_BARU':
        icon = Icons.person_add_alt_1_outlined;
        tone = AppColors.amberSoft;
        toneText = AppColors.amber;
        title = n.title ?? 'Buronan Baru Terdaftar';
        subtitle = n.body ?? n.buronan?.nama ?? '-';
        break;
      case 'BURONAN_TERTANGKAP':
        icon = Icons.verified_outlined;
        tone = AppColors.safeSoft;
        toneText = AppColors.safe;
        title = n.title ?? 'Buronan Tertangkap';
        subtitle = n.body ?? n.buronan?.nama ?? '-';
        break;
      case 'BERITA_ACARA_BARU':
        icon = Icons.newspaper_outlined;
        tone = AppColors.canvas;
        toneText = AppColors.primaryInk;
        title = n.title ?? 'Berita Acara Baru';
        subtitle = n.body ?? n.beritaAcara?.judul ?? '-';
        break;
      default:
        final isHighConfidence = confidencePct != null && confidencePct >= 85;
        icon = Icons.face_retouching_natural;
        tone = isHighConfidence ? AppColors.coralSoft : AppColors.amberSoft;
        toneText = isHighConfidence ? AppColors.coral : AppColors.amber;
        title = n.title ?? 'Match — ${event?.buronan?.nama ?? 'Deteksi'}';
        subtitle = event != null ? (event.cctvFeed?.lokasi ?? '-') : (n.body ?? '-');
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: BentoCell(
        color: tone,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Icon(icon, color: toneText, size: 20),
                ),
                if (!n.isRead)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(color: AppColors.coral, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '$subtitle · ${DateFormat('HH:mm, dd MMM').format(n.createdAt)}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (confidencePct != null)
              Text('$confidencePct%', style: TextStyle(fontWeight: FontWeight.w700, color: toneText, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}
