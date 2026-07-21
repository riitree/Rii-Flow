# Rii-Flow

Rii-Flow is a local-first presentation operating system for talking-head explanations, product demos, and presentations. It uses continuous speech as context and gestures as confirmation so creators can produce a composed video without operating a traditional editing timeline. The app is built with React, TypeScript, Vite, MediaPipe Tasks Vision, canvas composition, and MediaRecorder.

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

The npm `postinstall` step copies MediaPipe's WASM runtime into `public/mediapipe/wasm`. The gesture model is stored at `public/models/gesture_recognizer.task`, and the offline streaming English speech model is stored at `public/models/vosk-model-small-en-us-0.15.tar.gz`. Runtime inference does not use a CDN. If the speech model is intentionally removed while developing, restore it with `npm run speech:model`.

## Run

```powershell
npm run dev
```

Open the localhost URL printed by Vite. Rii-Flow separates setup into three focused steps: import visuals, organize them into Concepts, and present. Related filenames are grouped automatically; each Concept has a display name, natural-language aliases, animation, cooldown, and optional scene membership. Select **Start Studio** on the final screen; the same primary action becomes **Record** when the camera and local gesture model are ready.

Camera labels become available after browser permission is granted. The studio displays the actual camera resolution and frame rate reported by the selected device, which may be lower than the requested preset.

After the studio starts, **Share screen** opens the browser's private source picker. The selected tab, application window, game, or display becomes an aspect-true live overlay above the existing camera composition. Placement, size, visibility, mouse editing, open-palm movement, and two-palm resizing work like other live assets; the camera's framing, border, mirror setting, ratio, and resolution stay unchanged underneath. To avoid the repeating hall-of-mirrors effect, share the content tab or game window rather than the Rii-Flow studio itself. Browsers require a fresh user click and permission for every share. Shared tab/system audio is mixed into the recording when the chosen surface and browser provide an audio track. The selected microphone remains independent and is still the only source used for post-record captions.

## Local session and takes

Rii-Flow does not require an account. The current story queue, media, layouts, and preferences are stored locally in IndexedDB and restored after refresh. Browser site-data controls still apply: clearing this site's storage deletes the local session. The app requests persistent browser storage when the browser supports it.

The recorder uses a neutral timestamp filename while capturing so direct-to-folder saving can begin immediately. After recording, the inline rename field opens for the creator to choose the real filename; recordings can also be renamed later from the Take list. Finished recordings appear with duration, file size, resolution, favorite status, preview, download, and delete controls. Choose a recording destination near the top of the media library for the safest long-session workflow: one-second recorder chunks stream directly into that folder instead of accumulating the full recording in memory. Folder access is remembered locally and can be reconnected after a browser restart. If no folder is selected, the current session uses an in-memory fallback and clearly labels that limitation.

Recording and finalization lock camera, quality, and ratio changes; closing the page while either is active displays a browser warning.

## Three-step workflow

1. **Visuals:** import images, GIFs, videos, CSV, or JSON. Existing local media is restored after refresh.
2. **Concepts:** related visuals are grouped into ideas such as Dashboard, Pricing, or Architecture. Rename the Concept, edit its spoken aliases, or drag a visual between Concepts inline.
3. **Present:** camera, microphone, current Intent, gesture status, and recording transport share one focused performance screen. The Setup control safely returns to Concepts when no recording is active.

## Voice + gesture workflow

Live speech uses three independent lanes. A browser-provided on-device English recognizer is preferred when that browser has its language pack installed. Otherwise Rii-Flow uses the bundled Vosk English model in a dedicated worker and publishes partial words continuously; its grammar is rebuilt from every Concept name, alias, and natural phrase such as "pull up dashboard." The rolling Tiny Whisper recognizer remains a last-resort compatibility fallback and is no longer preloaded during a normal studio session.

Rii-Flow continuously transcribes the selected microphone, but speech is never executed as a command. The Intent Engine ranks the Concepts that best match the recent sentence. For example, “compare the dashboard with pricing” can place Dashboard and Pricing in the Intent Queue while leaving the stage untouched.

- **Speak naturally:** updates context only. Low-confidence or ambiguous speech simply changes the ranking.
- **Pinch away from a live visual:** confirms the top unambiguous Intent and shows its Concept. A short 70 ms stability gate keeps confirmation responsive without firing on noise.
- **Pinch on a live visual and drag:** moves that visual directly.
- **Two open hands:** resizes the selected visual.
- **Open palm:** resets its transform.
- **Fist:** immediately hides the selected visual.

The Intent Queue and tracking indicators are operator UI and never enter the recording canvas. Pinch confirmation is latched until release and every Concept has a cooldown, so holding the pose cannot repeatedly spawn the same visual. Gesture inference, speech inference, canvas rendering, and recording run on independent asynchronous lanes; recording never waits for speech.

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

- `src/core/concepts.ts` groups imported assets and scenes into stable, locally persisted Concepts with display names, aliases, animation, cooldown, and membership.
- `src/core/intentEngine.ts` ranks Concepts from continuous speech while preserving ambiguity; only a confident top candidate can be confirmed.
- `src/core/studioEvents.ts` provides typed asynchronous event lanes between speech, intent, gesture confirmation, and overlays so no subsystem awaits another.
- `src/core/pinch.ts` detects normalized thumb/index pinches and provides the short latched confirmation gate used by the live interaction path.
- `src/core/directorQueue.ts` retains deterministic next/back story ordering for existing projects.
- `src/core/gesture.ts` converts raw MediaPipe output into stable intent with quality checks, hysteresis, a short fist fast-path, and pose-change cooldown protection.
- `src/core/voiceTriggers.ts` supplies local English alias suggestions and the lightweight transcription vocabulary used before the Intent Engine.
- `src/core/browserSpeech.ts` owns the preferred browser/on-device streaming lane, including language-pack detection and Concept phrase biasing.
- `src/core/voskSpeech.ts` owns the reliable local streaming lane: a worker-hosted English recognizer constrained to the current presentation vocabulary and fed only by the selected microphone.
- `src/core/liveVoice.ts` captures only the selected microphone into a low-rate rolling speech window; it never listens to shared-screen, imported-video, music, or cue-sound audio.
- `src/core/operatorControls.ts` contains retained compatibility controls for older saved projects; the current Concept flow does not expose a gesture shelf.
- `src/core/spotlight.ts` adds a cached, canvas-native focus lift and outside dimming without introducing another video decoder or full-resolution inference path.
- `src/workers/gesture.worker.ts` runs the local recognizer off the UI thread. Frames are transferred from the dedicated 640×360 inference canvas; the full-resolution recording canvas is never sent through MediaPipe.
- `src/core/compositor.ts` renders active media, per-asset backgrounds, and saved transforms through the full-resolution recording pipeline.
- `src/core/mediaEdits.ts` normalizes video in/out ranges and exact image-crop source rectangles without altering original files.
- `src/core/framePipeline.ts` selects direct camera-track frame delivery when the browser supports it, with a visible-tab fallback for older browsers.
- `src/core/performance.ts` aligns full-resolution composition with the granted recording FPS and reports compositor cost against the available frame budget.
- `src/core/captionRender.ts` performs the single post-record MP4 render used for finished-take trims, captions, or both.
- `src/core/manipulation.ts` uses adaptive handedness-keyed palm smoothing: small resting jitter stays filtered while deliberate motion receives a faster response for drag and resize.
- `src/core/studioPersistence.ts` owns versioned IndexedDB records for project snapshots, separate media blobs, take metadata, and the optional recordings-directory handle.

## Recording

The full-resolution canvas always matches the camera's granted dimensions and selected ratio. A shared screen is drawn as another live, aspect-preserving overlay on that same canvas, so connecting it never changes or replaces the camera composition. In current Chromium browsers, fresh camera frames drive composition directly instead of relying on the page's visible animation cycle; the latest shared-screen frame is retained for the next composition. This keeps camera, screen, canvas recording, and gesture sampling active when another tab or app window is in front. Older browsers fall back to visible-page composition and show a warning before recording.

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
