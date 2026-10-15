export type Mode = 'power' | 'speed' | 'ex';
export type Evidence = 'measured' | 'rom' | 'wiki' | 'unresolved';
export interface Manifest {
  schemaVersion: 1; game: string; generatedAt: string; romSha256: string;
  characters: CharacterSummary[]; defaultCharacter: string;
}
export interface CharacterSummary {
  id: number; key: string; name: string; file: string; portrait?: string;
  moveCount: number; capturedMoves: number; coverage: string; combatId?: number;
}
export interface Box {
  slot: number; role: 'attack' | 'hurt' | 'push' | 'unknown';
  profile: number; flags: number; shape: number; special: boolean;
  x1: number; x2: number; y1: number; y2: number;
  damage: number; reaction: number; category: number;
}
export interface StaticCommand {
  cpu: string; bank: number; states: number[]; mode: Mode; box: Box;
  rawDamageOffset?: string; raw: string;
}
export interface Timing {
  startup?: number; active?: number; recovery?: number;
  damage?: number[]; hitAdvantage?: number; blockAdvantage?: number;
  switchGuardAdvantage?: number; evidence: Evidence; convention?: string;
}
export interface WikiRow {
  part: number; version?: string; damage: string; startup: string; active: string;
  recovery: string; advantage: string; meter: string; guard: string; cancel: string;
}
export interface CaptureRef {
  id: string; label: string; mode: Mode; scenario: string; file: string;
  frames: number; hasImages: boolean; actualWhiff: boolean;
}
export interface Move {
  id: string; label: string; name: string; category: string; input: string;
  states: number[]; scriptStates: number[]; evidence: Evidence; note: string;
  wikiUrl?: string; wiki: WikiRow[]; timing: Partial<Record<Mode, Timing>>;
  commands: StaticCommand[]; captures: CaptureRef[];
}
export interface CharacterData {
  schemaVersion: 1; character: CharacterSummary; moves: Move[];
  defenseQ8: number; attackQ8: Partial<Record<Mode, number>>;
}
export interface Frame {
  frame: number; engineFrame: number; state: number; script: number;
  inputState: number; inputMask?: number; x: number; y: number; facing: number;
  health: number; meter?: number; hitpause: boolean; boxes: Box[];
  opponent: { state: number; health: number; meter?: number; x?: number; y?: number; facing?: number; boxes?: Box[]; combo?: number };
  image?: string;
  camera?: { x: number; groundY: number; width: number; height: number; scaleX?: number; scaleY?: number; evidence: Evidence };
  sprite?: { image: string; width: number; height: number; originX: number; originY: number };
  // Immutable ROM animation word used for sprite/pose matching, if captured.
  pose?: number;
}
export interface Capture {
  schemaVersion: 1; character: string; move: string; mode: Mode; scenario: string;
  fps: number; source: string; frames: Frame[];
  notes: string[]; imageAlignment?: string;
}
