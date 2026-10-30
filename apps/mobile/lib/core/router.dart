import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/verify_otp_screen.dart';
import '../screens/cctv_screen.dart';
import '../screens/detection_detail_screen.dart';
import '../screens/home_screen.dart';
import '../screens/lapor_screen.dart';
import '../screens/manual_check_screen.dart';
import '../screens/profil_screen.dart';
import '../screens/status_screen.dart';
import '../widgets/bottom_nav_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/lapor',
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/login/verify-otp',
        builder: (context, state) => VerifyOtpScreen(pendingToken: state.extra as String),
      ),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(
        path: '/manual-check',
        builder: (context, state) => const ManualCheckScreen(),
      ),
      GoRoute(
        path: '/detection/:id',
        builder: (context, state) => DetectionDetailScreen(id: state.pathParameters['id']!),
      ),
      ShellRoute(
        builder: (context, state, child) => BottomNavShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/home', builder: (context, state) => const HomeScreen()),
          GoRoute(path: '/lapor', builder: (context, state) => const LaporScreen()),
          GoRoute(path: '/cctv', builder: (context, state) => const CctvScreen()),
          GoRoute(path: '/status', builder: (context, state) => const StatusScreen()),
          GoRoute(path: '/profil', builder: (context, state) => const ProfilScreen()),
        ],
      ),
    ],
  );
});
