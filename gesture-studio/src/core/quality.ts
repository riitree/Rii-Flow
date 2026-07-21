export const QUALITY_PRESETS = [
  { id: "720p30", label: "720p / 30 fps", width: 1280, height: 720, fps: 30, bitrate: 12_000_000 },
  { id: "720p60", label: "720p / 60 fps", width: 1280, height: 720, fps: 60, bitrate: 20_000_000 },
  { id: "1080p30", label: "1080p / 30 fps", width: 1920, height: 1080, fps: 30, bitrate: 24_000_000 },
  { id: "1080p60", label: "1080p / 60 fps", width: 1920, height: 1080, fps: 60, bitrate: 36_000_000 },
  { id: "4k30", label: "4K / 30 fps", width: 3840, height: 2160, fps: 30, bitrate: 60_000_000 }
] as const;

export type QualityId = (typeof QUALITY_PRESETS)[number]["id"];
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

/**
 * Chooses the best dependable talking-head master for the current machine.
 * 1080p30 gives visibly sharper text and media without the composition and
 * encoder cost of 60 fps. Constrained devices stay at a smooth 720p30.
 */
export function recommendedQualityForDevice(hardwareConcurrency: number, deviceMemory?: number): QualityId {
  const cores = Number.isFinite(hardwareConcurrency) ? hardwareConcurrency : 4;
  const memory = Number.isFinite(deviceMemory) ? deviceMemory! : undefined;
  // Do not infer recording headroom from CPU count alone. Integrated graphics,
  // camera processing and the gesture model share that same budget. Only pick
  // 1080p automatically when the browser confirms both strong CPU and memory;
  // users can still select 1080p manually.
  const confirmedRecordingHeadroom = cores >= 8 && memory !== undefined && memory >= 8;
  return confirmedRecordingHeadroom ? "1080p30" : "720p30";
}

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
  if (pixels >= 6_000_000) return 60_000_000;
  if (pixels >= 1_700_000) return fps >= 50 ? 36_000_000 : 24_000_000;
  return fps >= 50 ? 20_000_000 : 12_000_000;
}

export function dimensionsForPreset(id: QualityId) {
  const preset = qualityPreset(id);
  return { width: preset.width, height: preset.height, frameRate: preset.fps };
}

export function formatBitrate(bitsPerSecond: number) {
  return `${Math.round(bitsPerSecond / 1_000_000)} Mbps`;
}
