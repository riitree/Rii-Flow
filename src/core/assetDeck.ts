import type { RecognizedGesture } from "../types";

export type AssetDeckMode = "always" | "command";
export type AssetDeckCommand = "show" | "hide" | null;

export const ASSET_DECK_MODES: readonly { id: AssetDeckMode; label: string; detail: string }[] = [
  { id: "always", label: "Always visible", detail: "Media stays ready on stage" },
  { id: "command", label: "Show on command", detail: "Open your palm in empty space" }
];

export function assetDeckCommandForGesture(mode: AssetDeckMode, gesture: RecognizedGesture): AssetDeckCommand {
  if (mode !== "command") return null;
  if (gesture === "palm") return "show";
  if (gesture === "fist") return "hide";
  return null;
}

export function assetDeckShouldRender(visible: boolean, focusedAssetId: string | null) {
  return visible || Boolean(focusedAssetId);
}
