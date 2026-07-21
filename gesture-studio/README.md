# Rii-Flow

Rii-Flow is a local hands-free recording studio built with React, TypeScript, Vite, MediaPipe Tasks Vision, canvas composition, and MediaRecorder.

## Requirements

- Node.js 20 or newer
- A current Chromium-based browser with H.264/AAC MP4 MediaRecorder support
- A webcam, USB camera, USB-streaming camera, virtual camera, or HDMI capture device exposed by the browser
- A built-in, USB, or virtual microphone when voice recording is needed
- Chrome or Edge screen-capture support when recording a browser tab, app window, game, or complete display

## Install

```powershell
npm install
```

The npm `postinstall` step copies MediaPipe's WASM runtime into `public/mediapipe/wasm`. The gesture model is stored at `public/models/gesture_recognizer.task`. Runtime inference does not use a CDN.

## Run

```powershell
npm run dev
```

Open the localhost URL printed by Vite. The complete workflow stays on one screen: import assets, assign each a unique gesture and placement, choose camera and microphone sources, connect a recording destination, then select **Start Studio**. The same primary action becomes **Record** when the studio is ready. Importing, gesture assignment, and placement remain available during recording. A fist always hides the currently focused overlay.

Camera labels become available after browser permission is granted. The studio displays the actual camera resolution and frame rate reported by the selected device, which may be lower than the requested preset.

After the studio starts, **Share screen** opens the browser's private source picker. The selected tab, application window, game, or display becomes an aspect-true live overlay above the existing camera composition. Placement, size, visibility, mouse editing, open-palm movement, and two-palm resizing work like other live assets; the camera's framing, border, mirror setting, ratio, and resolution stay unchanged underneath. To avoid the repeating hall-of-mirrors effect, share the content tab or game window rather than the Rii-Flow studio itself. Browsers require a fresh user click and permission for every share. Shared tab/system audio is mixed into the recording when the chosen surface and browser provide an audio track. The selected microphone remains independent and is still the only source used for post-record captions.

## Local session and takes

Rii-Flow does not require an account. The current media library, assignments, layouts, and preferences are stored locally in IndexedDB and restored after refresh. Browser site-data controls still apply: clearing this site's storage deletes the local session. The app requests persistent browser storage when the browser supports it.

The recorder uses a neutral timestamp filename while capturing so direct-to-folder saving can begin immediately. After recording, the inline rename field opens for the creator to choose the real filename; recordings can also be renamed later from the Take list. Finished recordings appear with duration, file size, resolution, favorite status, preview, download, and delete controls. Choose a recording destination near the top of the media library for the safest long-session workflow: one-second recorder chunks stream directly into that folder instead of accumulating the full recording in memory. Folder access is remembered locally and can be reconnected after a browser restart. If no folder is selected, the current session uses an in-memory fallback and clearly labels that limitation.

Recording and finalization lock camera, quality, and ratio changes; closing the page while either is active displays a browser warning.

## One-screen workflow

- **Media dock:** import media and keep gesture, placement, size, background, saved spawn-position, video-trim, and image-crop controls visible.
- **Stage:** monitor the camera and set a focused overlay's spawn position before recording. One open palm moves it; two open palms resize it.
- **Screen overlay strip:** connect or change a shared tab/window/display, see its actual resolution, FPS, and audio status, then set placement, size, visibility, and stage position without changing the camera.
- **Signal rail:** see the detected gesture and finished takes without shrinking the stage.
- **Transport:** one primary action progresses from Start Studio to Record; Stop and the timer remain independent.
- **Takes drawer:** preview, rename, rate, download, or remove recordings without leaving the studio.

Single-hand activation gestures always accept either hand, so creators do not need to configure handedness. Two peace signs, two thumbs up, and thumb-plus-peace are available as deliberate two-hand assignments. Open palm is reserved for media manipulation and cannot be assigned to an asset. A fist is always accepted from either hand for safety. Duplicate gesture assignments are prevented.

Open-palm movement uses the tuned **Comfort** reach: a central, aspect-aware hand area maps across the complete stage so landscape and portrait edges require less physical travel. The curve keeps central movement controlled and accelerates gently toward the limits. Asset acquisition is dual-path: putting a physical palm directly behind the visible asset takes priority, while the compressed comfort position can also acquire it. After lock, movement follows the comfort curve without jumping. Two-palm resize sensitivity remains unchanged.

Assets assigned to a collage are shown only inside that scene card and are removed from the standalone-media list. Deleting the scene releases those assets back into the standalone list with their media edits intact.

## Non-destructive media editing

Imported videos use a visual filmstrip with draggable in/out handles. The selected range loops while that asset is live; the source file is never rewritten. Imported images support Original, Free crop, 1:1, 16:9, and 9:16. The crop rectangle can be repositioned directly and resized from any corner; fixed ratios remain locked while Free crop changes width and height independently. Crop settings are applied by the compositor at draw time, so the recording canvas still receives the original-resolution pixels.

Every finished take has a final trim control in **Finish and Download**. Trimming and optional captions share one post-record render pass and create a separate MP4 in the take list, while the original master remains available. This post-record render is intentionally kept out of the live studio pipeline: imported trims and crops have negligible per-frame cost, while finished-video export is the only operation that can be computationally expensive and usually takes approximately the selected clip's duration.

## Validate

```powershell
npm run typecheck
npm run test
npm run build
```

The tests cover gesture mappings, rolling-window stabilization and hold behavior, landmark-based three/four-finger inference, palm manipulation smoothing, camera and microphone routing, screen-source sizing and picture-in-picture geometry, track cleanup, microphone/screen/media audio mixing, 1080p60 and 4K30 canvas/bitrate profiles, data imports, local persistence, and composed recording tracks.

## Architecture

- `src/core/gesture.ts` converts raw MediaPipe output into stable intent with quality checks, hysteresis, a short fist fast-path, cooldown, and neutral re-arm.
- `src/workers/gesture.worker.ts` runs the local recognizer off the UI thread. Frames are transferred from the dedicated 640×360 inference canvas; the full-resolution recording canvas is never sent through MediaPipe.
- `src/core/compositor.ts` renders active media, per-asset backgrounds, and saved transforms through the full-resolution recording pipeline.
- `src/core/mediaEdits.ts` normalizes video in/out ranges and exact image-crop source rectangles without altering original files.
- `src/core/performance.ts` aligns full-resolution composition with the granted recording FPS and reports compositor cost against the available frame budget.
- `src/core/captionRender.ts` performs the single post-record MP4 render used for finished-take trims, captions, or both.
- `src/core/manipulation.ts` uses adaptive handedness-keyed palm smoothing: small resting jitter stays filtered while deliberate motion receives a faster response for drag and resize.
- `src/core/studioPersistence.ts` owns versioned IndexedDB records for project snapshots, separate media blobs, take metadata, and the optional recordings-directory handle.

## Recording

The full-resolution canvas always matches the camera's granted dimensions and selected ratio. A shared screen is drawn as another live, aspect-preserving overlay on that same canvas, so connecting it never changes or replaces the camera composition. Composition follows the camera's granted FPS up to the selected preset.

Gesture inference still uses only the webcam on a separate 640×360 canvas at roughly 10–14 fps. Full-resolution screen frames never enter MediaPipe. MediaRecorder captures the single full-resolution composed canvas plus the local audio mix. The microphone, browser-provided shared audio, enabled imported-video audio, and cue sounds have separate routes. Shared audio is not echoed back through Rii-Flow, preventing doubled game/tab sound, and microphone-only caption capture remains isolated from every other route.

Static CSV and JSON cards are rasterized once per output size instead of rebuilding every table cell on every frame. Active-layer and video routing are cached between actual composition changes. Gesture inference remains full speed, while detected-gesture text, inference latency, microphone level, and recording-clock UI updates are deliberately throttled so React rendering cannot compete with the recording canvas. Diagnostic builds expose composition FPS, average composition time, frame-budget usage, and over-budget frame count as data attributes without adding UI clutter.

Recordings are genuine `.mp4` files produced with the browser's native H.264/AAC encoder. Rii-Flow feature-detects MP4 support before recording and shows an error if the browser cannot provide it; it never renames a WebM file to MP4. Master-quality recording requests 320 kbps audio, one-second video keyframes, and the following video bitrates:

| Preset | Requested video bitrate |
| --- | ---: |
| 720p / 30 fps | 20 Mbps |
| 720p / 60 fps | 32 Mbps |
| 1080p / 30 fps | 50 Mbps |
| 1080p / 60 fps | 80 Mbps |
| 4K / 30 fps | 160 Mbps |

These are deliberately large editing-master settings. At the requested rate, 1080p60 is roughly 600 MB per minute and 4K30 is roughly 1.2 GB per minute. MediaRecorder bitrates are encoder requests, so the browser or hardware encoder may clamp the delivered rate. Resolution and camera changes remain locked while recording.

Free resizing no longer snaps to small presets. Only an intentional near-full-screen resize snaps the active layer to full screen. While moving an overlay by palm or mouse, all four edges and all four corners use a light magnetic snap to the visible camera area—not to any decorative camera border. The reduced attraction zone requires deliberate proximity while retaining exact final alignment.
