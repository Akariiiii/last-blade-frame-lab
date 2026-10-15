import type { Row, NativeManifest, Entry, ClipData } from './types.ts';
import { fetchData } from '../data.ts';
const WIDTH = 320, HEIGHT = 224, RGB_BYTES = WIDTH * HEIGHT * 3;

/** RFC4180-style parser preserves quotes, embedded commas and newlines. */
export function parseNativeCSV(text: string): Row[] {
  const cells: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  const finishCell = () => { row.push(cell); cell = ""; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(value => value !== "")) cells.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += ch;
    } else if (ch === '"') {
      if (cell || closed) throw new Error("Invalid CSV quote");
      quoted = true;
    } else if (ch === ",") finishCell();
    else if (ch === "\n" || ch === "\r") { finishRow(); if (ch === "\r" && text[i + 1] === "\n") i++; }
    else { if (closed) throw new Error("Unexpected text after CSV quote"); cell += ch; }
  }
  if (quoted) throw new Error("Truncated CSV quoted value");
  if (cell || row.length || closed) finishRow();
  if (!cells.length) throw new Error("Missing CSV header");
  const fields = cells.shift()!;
  if (new Set(fields).size !== fields.length) throw new Error("Duplicate CSV columns");
  return cells.map(values => {
    if (values.length !== fields.length) throw new Error("CSV row has wrong column count");
    return Object.fromEntries(fields.map((field, i) => [field, values[i]]));
  });
}

export async function nativeSHA(bytes: Uint8Array): Promise<string> {
  const buffer = new Uint8Array(bytes).buffer;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function inflateNative(bytes: Uint8Array, format: "gzip" | "deflate"): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser needs DecompressionStream support");
  const stream = new Blob([new Uint8Array(bytes).buffer]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Sequential browser zlib decoder; memory cache is bounded, seeking back restarts the stream. */
export class NativeClipReader {
  private stream?: ReadableStreamDefaultReader<Uint8Array>;
  private pending: Uint8Array = new Uint8Array(0);
  private current = -1;
  private previous: Uint8Array = new Uint8Array(RGB_BYTES);
  private cache = new Map<number, Uint8Array>();
  private queue: Promise<unknown> = Promise.resolve();
  private tiled?: Uint8Array;
  readonly manifest: NativeManifest;
  private encoded: Uint8Array;
  private palette?: Uint8Array;
  constructor(manifest: NativeManifest, encoded: Uint8Array, palette?: Uint8Array) {
    this.manifest = manifest; this.encoded = encoded; this.palette = palette;
    const indexed = manifest.schema === "lastblade2-native-clip-v2";
    if ((!indexed && manifest.schema !== "lastblade2-native-clip-v1") || !manifest.accepted || manifest.width !== WIDTH
      || manifest.height !== HEIGHT || manifest.rgb_size !== RGB_BYTES || manifest.frame_count <= 0
      || manifest.frames.length !== manifest.frame_count
      || manifest.encoding !== (indexed ? "indexed-tile32-single-zlib" : "first-rgb-then-xor-previous-single-zlib")) throw new Error("Unsupported native clip manifest");
    if (indexed && (manifest.tile_size !== 32 || ![1, 2].includes(manifest.index_bytes || 0)
      || !Number.isInteger(manifest.palette_count) || !palette || palette.length !== (manifest.palette_count || 0) * 3)) throw new Error("Invalid native palette");
  }
  private async indexedFrame(index: number): Promise<Uint8Array> {
    const width = this.manifest.index_bytes!;
    if (!this.tiled) {
      this.tiled = await inflateNative(this.encoded, "deflate");
      if (this.tiled.length !== this.manifest.frame_count * WIDTH * HEIGHT * width) throw new Error("Native tile stream size mismatch");
    }
    const rgb = new Uint8Array(RGB_BYTES), count = this.manifest.palette_count!;
    for (let ty = 0; ty < 7; ty++) for (let tx = 0; tx < 10; tx++) {
      const base = ((ty * 10 + tx) * this.manifest.frame_count + index) * 1024 * width;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const offset = base + (y * 32 + x) * width;
        const color = width === 1 ? this.tiled[offset] : this.tiled[offset] * 256 + this.tiled[offset + 1];
        if (color >= count) throw new Error("Native palette index out of bounds");
        const target = ((ty * 32 + y) * WIDTH + tx * 32 + x) * 3;
        rgb[target] = this.palette![color * 3]; rgb[target + 1] = this.palette![color * 3 + 1]; rgb[target + 2] = this.palette![color * 3 + 2];
      }
    }
    if (await nativeSHA(rgb) !== this.manifest.frames[index].rgb_sha256) throw new Error("Native indexed RGB checksum failed");
    return rgb;
  }
  private async restart() {
    if (this.stream) await this.stream.cancel();
    this.stream = new Blob([new Uint8Array(this.encoded).buffer]).stream()
      .pipeThrough(new DecompressionStream("deflate")).getReader();
    this.pending = new Uint8Array(0); this.current = -1; this.previous = new Uint8Array(RGB_BYTES);
  }
  private async exactFrame(): Promise<Uint8Array> {
    const output = new Uint8Array(RGB_BYTES);
    let offset = 0;
    while (offset < RGB_BYTES) {
      if (!this.pending.length) {
        const next = await this.stream!.read();
        if (next.done) throw new Error("Truncated native framebuffer stream");
        this.pending = new Uint8Array(next.value);
      }
      const count = Math.min(this.pending.length, RGB_BYTES - offset);
      output.set(this.pending.subarray(0, count), offset);
      this.pending = this.pending.subarray(count); offset += count;
    }
    return output;
  }
  frame(index: number): Promise<Uint8Array> {
    if (!Number.isInteger(index) || index < 0 || index >= this.manifest.frame_count) return Promise.reject(new Error("Frame index out of range"));
    const operation = this.queue.then(async () => {
      const cached = this.cache.get(index);
      if (cached) return cached;
      if (this.manifest.schema === "lastblade2-native-clip-v2") {
        const rgb = await this.indexedFrame(index); this.cache.set(index, rgb);
        while (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value!);
        return rgb;
      }
      if (!this.stream || index <= this.current) await this.restart();
      while (this.current < index) {
        const rgb = await this.exactFrame();
        if (this.current >= 0) for (let i = 0; i < RGB_BYTES; i++) rgb[i] ^= this.previous[i];
        this.current++;
        const expected = this.manifest.frames[this.current];
        if (expected.index !== this.current || await nativeSHA(rgb) !== expected.rgb_sha256) throw new Error(`Native RGB checksum failed at frame ${this.current}`);
        this.previous = rgb;
        this.cache.set(this.current, rgb);
        while (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value!);
      }
      if (this.current === this.manifest.frame_count - 1) {
        if (this.pending.length || !(await this.stream!.read()).done) throw new Error("Unexpected trailing native frame data");
      }
      return this.previous;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}

async function fetchBytes(url: string, signal?: AbortSignal) {
  const response = await fetchData(url, { signal });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadNativeClip(entry: Pick<Entry, "clip_url" | "manifest_sha256">, signal?: AbortSignal): Promise<ClipData> {
  const manifestBytes = await fetchBytes(entry.clip_url + "manifest.json", signal);
  if (await nativeSHA(manifestBytes) !== entry.manifest_sha256) throw new Error("Native manifest checksum failed");
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as NativeManifest;
  const readFile = async (name: string) => {
    const expected = manifest.files[name];
    if (!expected) throw new Error(`Missing native file: ${name}`);
    const bytes = await fetchBytes(entry.clip_url + name + (name.endsWith('.gz') ? '.bin' : ''), signal);
    if (bytes.length !== expected.bytes || await nativeSHA(bytes) !== expected.sha256) throw new Error(`Native file checksum failed: ${name}`);
    return bytes;
  };
  const [frames, ram, objectBytes, palette] = await Promise.all([
    readFile("frames.rgbx.zlib"), readFile("ram.csv.gz"),
    manifest.files["objects.csv.gz"] ? readFile("objects.csv.gz") : Promise.resolve(null),
    manifest.files["palette.rgb"] ? readFile("palette.rgb") : Promise.resolve(undefined),
  ]);
  const rows = parseNativeCSV(new TextDecoder().decode(await inflateNative(ram, "gzip")));
  if (rows.length !== manifest.frame_count || rows.some(row => Object.keys(row).join("\0") !== manifest.csv_fields.join("\0"))) throw new Error("Native RAM row/schema count failed");
  const objects = new Map<number, Row[]>();
  if (objectBytes) for (const row of parseNativeCSV(new TextDecoder().decode(await inflateNative(objectBytes, "gzip")))) {
    const frame = Number(row.relative_frame);
    if (!Number.isInteger(frame)) throw new Error("Object frame timestamp missing");
    const group = objects.get(frame) || []; group.push(row); objects.set(frame, group);
  }
  return { manifest, rows, objects, reader: new NativeClipReader(manifest, frames, palette) };
}

