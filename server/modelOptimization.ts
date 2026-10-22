import { NodeIO } from "@gltf-transform/core";
import { dedup, prune, weld } from "@gltf-transform/functions";

const GLB_MAGIC = Buffer.from("glTF", "ascii");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_MAGIC = Buffer.from("RIFF", "ascii");
const WEBP_MAGIC = Buffer.from("WEBP", "ascii");

export function hasGlbMagic(bytes: Buffer) {
  return bytes.length >= 4 && bytes.subarray(0, 4).equals(GLB_MAGIC);
}

export function hasImageMagic(bytes: Buffer, mimeType: "image/jpeg" | "image/png" | "image/webp") {
  if (mimeType === "image/png") return bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
  if (mimeType === "image/jpeg") return bytes.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC);
  return bytes.length >= 12 && bytes.subarray(0, 4).equals(RIFF_MAGIC) && bytes.subarray(8, 12).equals(WEBP_MAGIC);
}

/**
 * Performs safe, lossless structural optimization for uploaded GLBs.
 * This deliberately avoids changing geometry scale, coordinates, or semantics.
 */
export async function optimizeGlb(input: Buffer) {
  if (!hasGlbMagic(input)) throw new Error("The uploaded file is not a valid GLB binary.");
  const io = new NodeIO();
  const document = await io.readBinary(new Uint8Array(input));
  await document.transform(dedup(), prune(), weld());
  const optimized = Buffer.from(await io.writeBinary(document));
  return optimized.length < input.length ? optimized : input;
}
