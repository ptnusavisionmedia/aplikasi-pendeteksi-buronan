/** FR-21: quality gate + mandatory multi-angle enrollment for Buronan photos. */

export const MIN_PHOTO_WIDTH = 480;
export const MIN_PHOTO_HEIGHT = 480;
/** Frontal + at least one other angle, per PRD v2 §Modul 6 FR-21. */
export const REQUIRED_DISTINCT_ANGLES = 2;

export interface PhotoDimensions {
  width?: number | null;
  height?: number | null;
}

export interface PhotoQualityResult {
  valid: boolean;
  reason?: string;
}

export function validatePhotoQuality(photo: PhotoDimensions): PhotoQualityResult {
  if (!photo.width || !photo.height) {
    return { valid: false, reason: "Dimensi foto tidak terbaca; sertakan width/height" };
  }
  if (photo.width < MIN_PHOTO_WIDTH || photo.height < MIN_PHOTO_HEIGHT) {
    return {
      valid: false,
      reason: `Resolusi foto terlalu rendah (minimum ${MIN_PHOTO_WIDTH}x${MIN_PHOTO_HEIGHT}px)`,
    };
  }
  return { valid: true };
}

export interface EnrolledAngle {
  angle: string;
}

/** Enrollment is complete once at least REQUIRED_DISTINCT_ANGLES distinct angles are on file. */
export function isEnrollmentComplete(photos: EnrolledAngle[]): boolean {
  const distinctAngles = new Set(photos.map((p) => p.angle));
  return distinctAngles.size >= REQUIRED_DISTINCT_ANGLES;
}
