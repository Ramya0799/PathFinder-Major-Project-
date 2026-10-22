import { Document, NodeIO } from "@gltf-transform/core";
import { afterEach, describe, expect, it } from "vitest";
import { hasGlbMagic, hasImageMagic, optimizeGlb } from "./modelOptimization";

afterEach(() => undefined);

describe("secure campus asset ingestion", () => {
  it("recognizes only a GLB binary header", () => {
    expect(hasGlbMagic(Buffer.from("glTF-test"))).toBe(true);
    expect(hasGlbMagic(Buffer.from("not-a-glb"))).toBe(false);
  });

  it("recognizes image bytes instead of trusting a client MIME label", () => {
    expect(hasImageMagic(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(hasImageMagic(Buffer.from("not-an-image"), "image/png")).toBe(false);
  });

  it("round-trips a valid GLB through lossless structural optimization", async () => {
    const document = new Document();
    document.createScene().addChild(document.createNode());
    const input = Buffer.from(await new NodeIO().writeBinary(document));
    const output = await optimizeGlb(input);
    expect(output.subarray(0, 4).toString()).toBe("glTF");
    await expect(new NodeIO().readBinary(new Uint8Array(output))).resolves.toBeTruthy();
  });
});
