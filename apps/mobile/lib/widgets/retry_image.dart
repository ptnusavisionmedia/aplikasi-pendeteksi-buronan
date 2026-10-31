import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Network image that retries on load failure instead of leaving Flutter's default
/// broken-image icon up forever. Mirrors apps/web/src/components/retry-image.tsx: evidence/
/// face photos are served from object storage through a chain that can blip transiently (a
/// restart mid-request, a brief network hiccup) — this retries with backoff, then falls back
/// to a clear placeholder (not a silent broken-image icon) once retries are exhausted, so the
/// user can tell "this photo is genuinely missing" apart from "still loading."
class RetryImage extends StatefulWidget {
  final String url;
  final double? height;
  final double? width;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final int maxRetries;

  const RetryImage({
    super.key,
    required this.url,
    this.height,
    this.width,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.maxRetries = 2,
  });

  @override
  State<RetryImage> createState() => _RetryImageState();
}

class _RetryImageState extends State<RetryImage> {
  int _attempt = 0;
  bool _failed = false;

  @override
  void didUpdateWidget(RetryImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      setState(() {
        _attempt = 0;
        _failed = false;
      });
    }
  }

  void _handleError() {
    if (!mounted) return;
    if (_attempt >= widget.maxRetries) {
      setState(() => _failed = true);
      return;
    }
    final delay = Duration(milliseconds: 500 * (1 << _attempt)); // 500ms, 1000ms, ...
    Future.delayed(delay, () {
      if (mounted) setState(() => _attempt += 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: AppColors.canvas,
          borderRadius: widget.borderRadius,
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.image_not_supported_outlined, color: AppColors.muted, size: 22),
            SizedBox(height: 4),
            Text('Gagal memuat gambar', style: TextStyle(color: AppColors.muted, fontSize: 10.5, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }

    final image = Image.network(
      // Cache-bust with the retry count so the engine's image cache doesn't just replay the
      // same failed load on retry.
      _attempt == 0 ? widget.url : '${widget.url}${widget.url.contains('?') ? '&' : '?'}retry=$_attempt',
      key: ValueKey('${widget.url}#$_attempt'),
      height: widget.height,
      width: widget.width,
      fit: widget.fit,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return SizedBox(
          height: widget.height,
          width: widget.width,
          child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        );
      },
      errorBuilder: (context, error, stackTrace) {
        // Schedule the retry after this frame rather than during build.
        WidgetsBinding.instance.addPostFrameCallback((_) => _handleError());
        return SizedBox(height: widget.height, width: widget.width);
      },
    );

    if (widget.borderRadius == null) return image;
    return ClipRRect(borderRadius: widget.borderRadius!, child: image);
  }
}
