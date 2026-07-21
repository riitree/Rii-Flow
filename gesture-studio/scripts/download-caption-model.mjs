import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = resolve(root, "public/models/whisper-tiny.en");
const repository = "onnx-community/whisper-tiny.en";
const files = [
  "added_tokens.json",
  "config.json",
  "generation_config.json",
  "merges.txt",
  "normalizer.json",
  "preprocessor_config.json",
  "special_tokens_map.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "vocab.json",
  "onnx/encoder_model_q4.onnx",
  "onnx/decoder_model_merged_q4.onnx"
];

for (const file of files) {
  const destination = resolve(modelRoot, file);
  const response = await fetch(`https://huggingface.co/${repository}/resolve/main/${file}`);
  if (!response.ok) throw new Error(`Could not download ${file}: ${response.status}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${file}`);
}

console.log("English Whisper model is available locally in public/models/whisper-tiny.en");
