import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const destination = resolve(root, "public/mediapipe/wasm");
const ortSource = resolve(root, "node_modules/onnxruntime-web/dist");
const ortDestination = resolve(root, "public/ort");

await mkdir(destination, { recursive: true });
try {
  await cp(source, destination, { recursive: true, force: true });
} catch (error) {
  if (error?.code !== "EBUSY") throw error;
  console.warn("MediaPipe runtime is currently in use; keeping the local files already being served.");
}
await mkdir(ortDestination, { recursive: true });

async function copyRuntimeFile(file) {
  const from = resolve(ortSource, file);
  const to = resolve(ortDestination, file);
  const sourceSize = (await stat(from)).size;
  const destinationSize = await stat(to).then((entry) => entry.size).catch(() => -1);
  if (sourceSize === destinationSize) return;
  await cp(from, to, { force: true });
}

for (const file of [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm"
]) {
  await copyRuntimeFile(file);
}
console.log("Copied MediaPipe WASM runtime into public/mediapipe/wasm");
console.log("Copied ONNX Runtime WebAssembly files into public/ort");
