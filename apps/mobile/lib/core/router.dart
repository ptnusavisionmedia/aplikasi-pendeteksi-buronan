import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/berita_acara.dart';
import '../models/cctv_feed.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/verify_otp_screen.dart';
import '../screens/bantuan_screen.dart';
import '../screens/berita_acara_detail_screen.dart';
import '../screens/berita_acara_screen.dart';
import '../screens/buronan_detail_screen.dart';
import '../screens/buronan_screen.dart';
import '../screens/cctv_live_screen.dart';
import '../screens/cctv_screen.dart';
import '../screens/detection_detail_screen.dart';
import '../screens/home_screen.dart';
import '../screens/lapor_screen.dart';
import '../screens/manual_check_screen.dart';
import '../screens/notifikasi_screen.dart';
import '../screens/profil_screen.dart';
import '../screens/status_screen.dart';

// Tidak ada ShellRoute/bottom navigation bar — semua navigasi lewat ikon di HomeScreen (lihat
// vault/03-Decisions). Tiap layar non-Home mengelola Scaffold+AppBar-nya sendiri untuk tombol
// kembali, karena tidak ada lagi chrome bersama yang menampungnya.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/login/verify-otp',
        builder: (context, state) => VerifyOtpScreen(pendingToken: state.extra as String),
      ),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
      GoRoute(path: '/lapor', builder: (context, state) => const LaporScreen()),
      GoRoute(path: '/cctv', builder: (context, state) => const CctvScreen()),
      GoRoute(
        path: '/cctv/:id/live',
        builder: (context, state) {
          final extra = state.extra;
          final feed = extra is CctvFeed
              ? extra
              : CctvFeed(
                  id: state.pathParameters['id']!,
                  nama: 'CCTV',
                  lokasi: '-',
                  wilayah: '-',
                  status: 'ACTIVE',
                  mirror: false,
                  createdAt: DateTime.now(),
                );
          return CctvLiveScreen(feed: feed);
        },
      ),
      GoRoute(path: '/status', builder: (context, state) => const StatusScreen()),
      GoRoute(path: '/profil', builder: (context, state) => const ProfilScreen()),
      GoRoute(path: '/notifikasi', builder: (context, state) => const NotifikasiScreen()),
      GoRoute(path: '/buronan', builder: (context, state) => const BuronanScreen()),
      GoRoute(
        path: '/buronan/:id',
        builder: (context, state) => BuronanDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(path: '/bantuan', builder: (context, state) => const BantuanScreen()),
      GoRoute(path: '/berita-acara', builder: (context, state) => const BeritaAcaraScreen()),
      GoRoute(
        path: '/berita-acara/:id',
        builder: (context, state) => BeritaAcaraDetailScreen(
          id: state.pathParameters['id']!,
          preloaded: state.extra as BeritaAcara?,
        ),
      ),
      GoRoute(
        path: '/manual-check',
        builder: (context, state) => const ManualCheckScreen(),
      ),
      GoRoute(
        path: '/detection/:id',
        builder: (context, state) => DetectionDetailScreen(id: state.pathParameters['id']!),
      ),
    ],
  );
});
