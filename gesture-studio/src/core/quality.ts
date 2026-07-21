export const QUALITY_PRESETS = [
  { id: "720p30", label: "720p / 30 fps", width: 1280, height: 720, fps: 30, bitrate: 20_000_000 },
  { id: "720p60", label: "720p / 60 fps", width: 1280, height: 720, fps: 60, bitrate: 32_000_000 },
  { id: "1080p30", label: "1080p / 30 fps", width: 1920, height: 1080, fps: 30, bitrate: 50_000_000 },
  { id: "1080p60", label: "1080p / 60 fps", width: 1920, height: 1080, fps: 60, bitrate: 80_000_000 },
  { id: "4k30", label: "4K / 30 fps", width: 3840, height: 2160, fps: 30, bitrate: 160_000_000 }
] as const;

export type QualityId = (typeof QUALITY_PRESETS)[number]["id"];
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export function qualityPreset(id: QualityId): QualityPreset {
  return QUALITY_PRESETS.find((preset) => preset.id === id) ?? QUALITY_PRESETS[0];
}

export function videoConstraints(deviceId: string, preset: QualityPreset): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { ideal: preset.width },
    height: { ideal: preset.height },
    frameRate: { ideal: preset.fps, max: preset.fps }
  };
}

export function bitrateForActual(width: number, height: number, fps: number) {
  const pixels = width * height;
  if (pixels >= 6_000_000) return 160_000_000;
  if (pixels >= 1_700_000) return fps >= 50 ? 80_000_000 : 50_000_000;
  return fps >= 50 ? 32_000_000 : 20_000_000;
}

export function dimensionsForPreset(id: QualityId) {
  const preset = qualityPreset(id);
  return { width: preset.width, height: preset.height, frameRate: preset.fps };
}

export function formatBitrate(bitsPerSecond: number) {
  return `${Math.round(bitsPerSecond / 1_000_000)} Mbps`;
}
