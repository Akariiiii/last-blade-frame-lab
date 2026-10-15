import type { NativeClipReader } from './decoder.ts';

export type Row = Record<string, string>;
export type Role = "attack" | "hurt" | "push" | "unknown";
interface FrameMeta { index: number; rgb_sha256: string }
export interface NativeManifest {
  schema: string; accepted: boolean; width: number; height: number; rgb_size: number;
  frame_count: number; frames: FrameMeta[]; encoding: string;
  csv_fields: string[]; files: Record<string, { bytes: number; sha256: string }>;
  tile_size?: number; index_bytes?: number; palette_count?: number;
}
export interface Entry {
  id: string; selector_id: number; character_name: string; mode: string; group: string;
  action_id: string; label: string; condition: string; outcome: string; recovered: boolean;
  frames: number; fps: number; clip_url: string; manifest_sha256: string;
  measured_hp_loss: number; native_missed_updates: number; metadata: Record<string, unknown>;
}
export interface Index {
  schema_version: number; clips: Entry[]; failures: unknown[];
  excluded: { id: string; reason: string }[]; profiles_url: string;
}
export interface Profiles { flags_by_character: Record<string, number[]> }
export interface ClipData { manifest: NativeManifest; rows: Row[]; objects: Map<number, Row[]>; reader: NativeClipReader }
export interface Rectangle { role: Role; x: number; y: number; width: number; height: number; damage: number; label: string }

