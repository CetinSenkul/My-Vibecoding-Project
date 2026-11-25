import zlib from "node:zlib";

// 1-byte format prefix so stored BLOBs are self-describing and backwards-compatible
const CODEC_ZSTD = 0x01;
const CODEC_GZIP = 0x02;

type ZlibWithZstd = typeof zlib & {
  zstdCompressSync?: (buf: zlib.InputType) => Buffer;
  zstdDecompressSync?: (buf: zlib.InputType) => Buffer;
};

const zlibExt = zlib as ZlibWithZstd;

/**
 * Compresses UTF-8 text into a compact binary Buffer (Zstd preferred, Gzip fallback).
 * Empty strings return an empty Buffer.
 */
export function compressText(text: string): Buffer {
  if (!text) {
    return Buffer.alloc(0);
  }

  const input = Buffer.from(text, "utf8");

  if (typeof zlibExt.zstdCompressSync === "function") {
    const compressed = zlibExt.zstdCompressSync(input);
    return Buffer.concat([Buffer.from([CODEC_ZSTD]), compressed]);
  }

  const compressed = zlib.gzipSync(input, { level: zlib.constants.Z_BEST_COMPRESSION });
  return Buffer.concat([Buffer.from([CODEC_GZIP]), compressed]);
}

/**
 * Decompresses a stored BLOB back into a UTF-8 string.
 * Supports Zstd-prefixed, Gzip-prefixed, and raw Gzip buffers.
 */
export function decompressText(blob: Uint8Array | Buffer | null | undefined): string {
  if (!blob || blob.length === 0) {
    return "";
  }

  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const prefix = buf[0];

  if (prefix === CODEC_ZSTD && typeof zlibExt.zstdDecompressSync === "function") {
    return zlibExt.zstdDecompressSync(buf.subarray(1)).toString("utf8");
  }

  if (prefix === CODEC_GZIP) {
    return zlib.gunzipSync(buf.subarray(1)).toString("utf8");
  }

  // Raw Gzip magic bytes (0x1f 0x8b) fallback
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return zlib.gunzipSync(buf).toString("utf8");
  }

  return buf.toString("utf8");
}

export interface CompressionStats {
  codec: "zstd" | "gzip";
  originalBytes: number;
  compressedBytes: number;
  savedPercent: number;
}

export function measureCompression(text: string): CompressionStats {
  const originalBytes = Buffer.byteLength(text, "utf8");
  const compressed = compressText(text);
  const compressedBytes = compressed.length;
  const savedPercent =
    originalBytes > 0
      ? Math.round(((originalBytes - compressedBytes) / originalBytes) * 1000) / 10
      : 0;

  return {
    codec: compressed[0] === CODEC_ZSTD ? "zstd" : "gzip",
    originalBytes,
    compressedBytes,
    savedPercent,
  };
}
