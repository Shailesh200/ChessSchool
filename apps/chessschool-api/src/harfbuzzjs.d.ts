/** harfbuzzjs 0.4 ships no types for its CommonJS entry points; only what share-card.ts uses. */
declare module "harfbuzzjs/hb.js" {
  const factory: (opts: { wasmBinary: Uint8Array }) => Promise<unknown>;
  export default factory;
}
declare module "harfbuzzjs/hbjs.js" {
  type Font = { ptr: number; glyphToPath: (g: number) => string };
  type Buffer = { addText: (t: string) => void; guessSegmentProperties: () => void; json: () => unknown[]; destroy: () => void };
  const hbjs: (instance: unknown) => {
    createBlob: (data: Uint8Array) => { ptr: number };
    createFace: (blob: { ptr: number }, index: number) => { ptr: number; upem: number };
    createFont: (face: { ptr: number }) => Font;
    createBuffer: () => Buffer;
    shape: (font: Font, buffer: Buffer, features?: string) => void;
  };
  export default hbjs;
}
