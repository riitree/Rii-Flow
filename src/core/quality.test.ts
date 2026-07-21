import { describe, expect, it } from "vitest";
import {
  bitrateForActual,
  dimensionsForPreset,
  qualityPreset,
  recommendedQualityForDevice,
  videoConstraints
} from "./quality";

describe("camera quality profiles", () => {
  it("selects sharp 1080p for capable devices and stable 720p for constrained ones", () => {
    expect(recommendedQualityForDevice(12, 16)).toBe("1080p30");
    expect(recommendedQualityForDevice(8)).toBe("720p30");
    expect(recommendedQualityForDevice(6, 8)).toBe("720p30");
    expect(recommendedQualityForDevice(4, 4)).toBe("720p30");
  });

  it("requests the selected camera by exact deviceId", () => {
    const constraints = videoConstraints("sony-usb-123", qualityPreset("1080p60"));
    expect(constraints.deviceId).toEqual({ exact: "sony-usb-123" });
    expect(constraints.width).toEqual({ ideal: 1920 });
    expect(constraints.frameRate).toEqual({ ideal: 60, max: 60 });
  });

  it("uses 1920x1080 and a smooth high-quality master profile for 1080p60", () => {
    expect(dimensionsForPreset("1080p60")).toEqual({ width: 1920, height: 1080, frameRate: 60 });
    expect(bitrateForActual(1920, 1080, 60)).toBe(36_000_000);
  });

  it("uses 3840x2160 and an efficient master profile for 4K30", () => {
    expect(dimensionsForPreset("4k30")).toEqual({ width: 3840, height: 2160, frameRate: 30 });
    expect(bitrateForActual(3840, 2160, 30)).toBe(60_000_000);
  });

  it("bases bitrate on granted output rather than the requested label", () => {
    expect(bitrateForActual(1280, 720, 30)).toBe(12_000_000);
    expect(bitrateForActual(720, 1280, 30)).toBe(12_000_000);
    expect(bitrateForActual(1080, 1920, 60)).toBe(36_000_000);
    expect(bitrateForActual(2160, 3840, 30)).toBe(60_000_000);
  });
});
