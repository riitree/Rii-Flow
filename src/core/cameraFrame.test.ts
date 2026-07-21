import { describe, expect, it } from "vitest";
import { cameraFrameColor, cameraFrameViewport, DEFAULT_CAMERA_FRAME, normalizeCameraFrame } from "./cameraFrame";

describe("camera frame", () => {
  it("keeps the camera full-canvas when the frame is off", () => {
    expect(cameraFrameViewport(1920, 1080, DEFAULT_CAMERA_FRAME)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("centres and scales the camera without changing the recording dimensions", () => {
    expect(cameraFrameViewport(1920, 1080, { enabled: true, mode: "black", sizePercent: 10, customColor: "#123456" })).toEqual({
      x: 192,
      y: 108,
      width: 1536,
      height: 864
    });
  });

  it("supports white and safe custom colours", () => {
    expect(cameraFrameColor({ enabled: true, mode: "white", sizePercent: 6, customColor: "#123456" })).toBe("#ffffff");
    expect(cameraFrameColor({ enabled: true, mode: "custom", sizePercent: 6, customColor: "#123456" })).toBe("#123456");
    expect(normalizeCameraFrame({ mode: "custom", sizePercent: 100, customColor: "not-a-colour" })).toEqual({
      enabled: true,
      mode: "custom",
      sizePercent: 20,
      customColor: "#3157d5"
    });
  });

  it("can hide and restore a configured border without losing its style", () => {
    const hidden = normalizeCameraFrame({ enabled: false, mode: "custom", sizePercent: 12, customColor: "#d4a017" });
    expect(cameraFrameViewport(1280, 720, hidden)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    expect(normalizeCameraFrame({ ...hidden, enabled: true })).toEqual({ enabled: true, mode: "custom", sizePercent: 12, customColor: "#d4a017" });
  });
});
