export type CameraFrameMode = "off" | "black" | "white" | "custom";

export interface CameraFrameSettings {
  enabled: boolean;
  mode: Exclude<CameraFrameMode, "off">;
  sizePercent: number;
  customColor: string;
}

export const MIN_CAMERA_FRAME_PERCENT = 2;
export const MAX_CAMERA_FRAME_PERCENT = 20;
export const DEFAULT_CAMERA_FRAME: CameraFrameSettings = {
  enabled: false,
  mode: "black",
  sizePercent: 6,
  customColor: "#3157d5"
};

const VALID_FRAME_MODES = new Set<CameraFrameMode>(["off", "black", "white", "custom"]);

type CameraFrameInput = Partial<Omit<CameraFrameSettings, "mode">> & { mode?: CameraFrameMode };

export function normalizeCameraFrame(value?: CameraFrameInput | null): CameraFrameSettings {
  const requestedMode = value?.mode && VALID_FRAME_MODES.has(value.mode) ? value.mode : DEFAULT_CAMERA_FRAME.mode;
  const mode = requestedMode === "off" ? DEFAULT_CAMERA_FRAME.mode : requestedMode;
  const enabled = typeof value?.enabled === "boolean" ? value.enabled : requestedMode !== "off";
  const requestedSize = Number(value?.sizePercent);
  const sizePercent = Number.isFinite(requestedSize)
    ? Math.min(MAX_CAMERA_FRAME_PERCENT, Math.max(MIN_CAMERA_FRAME_PERCENT, requestedSize))
    : DEFAULT_CAMERA_FRAME.sizePercent;
  const customColor = typeof value?.customColor === "string" && /^#[0-9a-f]{6}$/i.test(value.customColor)
    ? value.customColor
    : DEFAULT_CAMERA_FRAME.customColor;
  return { enabled, mode, sizePercent, customColor };
}

export function cameraFrameColor(settings: CameraFrameSettings) {
  if (settings.mode === "white") return "#ffffff";
  if (settings.mode === "custom") return normalizeCameraFrame(settings).customColor;
  return "#050505";
}

export function cameraFrameViewport(width: number, height: number, settings: CameraFrameSettings) {
  const normalized = normalizeCameraFrame(settings);
  if (!normalized.enabled) return { x: 0, y: 0, width, height };
  const ratio = normalized.sizePercent / 100;
  const x = Math.round(width * ratio);
  const y = Math.round(height * ratio);
  return {
    x,
    y,
    width: Math.max(1, width - x * 2),
    height: Math.max(1, height - y * 2)
  };
}
