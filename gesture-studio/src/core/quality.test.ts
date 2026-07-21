import { describe, expect, it } from "vitest";
import {
  bitrateForActual,
  dimensionsForPreset,
  qualityPreset,
  videoConstraints
} from "./quality";

describe("camera quality profiles", () => {
  it("requests the selected camera by exact deviceId", () => {
    const constraints = videoConstraints("sony-usb-123", qualityPreset("1080p60"));
    expect(constraints.deviceId).toEqual({ exact: "sony-usb-123" });
    expect(constraints.width).toEqual({ ideal: 1920 });
    expect(constraints.frameRate).toEqual({ ideal: 60, max: 60 });
  });

  it("uses 1920x1080 and an 80 Mbps master profile for 1080p60", () => {
    expect(dimensionsForPreset("1080p60")).toEqual({ width: 1920, height: 1080, frameRate: 60 });
    expect(bitrateForActual(1920, 1080, 60)).toBe(80_000_000);
  });

  it("uses 3840x2160 and a 160 Mbps master profile for 4K30", () => {
    expect(dimensionsForPreset("4k30")).toEqual({ width: 3840, height: 2160, frameRate: 30 });
    expect(bitrateForActual(3840, 2160, 30)).toBe(160_000_000);
  });

  it("bases bitrate on granted output rather than the requested label", () => {
    expect(bitrateForActual(1280, 720, 30)).toBe(20_000_000);
    expect(bitrateForActual(720, 1280, 30)).toBe(20_000_000);
    expect(bitrateForActual(1080, 1920, 60)).toBe(80_000_000);
    expect(bitrateForActual(2160, 3840, 30)).toBe(160_000_000);
  });
});
