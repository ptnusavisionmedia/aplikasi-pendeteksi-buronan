"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

interface RetryImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** How many times to retry after a load failure before giving up and showing the fallback. */
  maxRetries?: number;
}

/**
 * <img> that retries on load failure instead of leaving the browser's broken-image icon up
 * forever. Evidence/face photos are served from object storage (MinIO/S3Mock) through a chain
 * that can blip transiently (a restart mid-request, a brief network hiccup) — a plain <img> just
 * stays broken until the user manually reloads the page. This retries with backoff, then falls
 * back to a clear placeholder (not a silent broken-image icon) once retries are exhausted, so the
 * user can tell "this photo is genuinely missing" apart from "still loading."
 */
export function RetryImage({ src, maxRetries = 2, className, alt, ...rest }: RetryImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // Reset retry state whenever the image URL itself changes (e.g. switching between photos).
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  function handleError() {
    if (attempt >= maxRetries) {
      setFailed(true);
      return;
    }
    const delay = 500 * 2 ** attempt; // 500ms, 1000ms, ...
    window.setTimeout(() => setAttempt((a) => a + 1), delay);
  }

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-black/5 text-muted ${className ?? ""}`}
        role="img"
        aria-label={alt || "Gambar gagal dimuat"}
      >
        <ImageOff className="w-5 h-5 opacity-50" />
        <span className="text-[10.5px] font-medium opacity-70">Gagal memuat gambar</span>
      </div>
    );
  }

  // Cache-bust with the retry count so the browser doesn't just replay the same failed response
  // from its HTTP cache on retry.
  const retrySrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={retrySrc} alt={alt} className={className} onError={handleError} {...rest} />;
}
