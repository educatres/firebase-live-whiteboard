import { describe, expect, it } from "vitest";
import { moveStickyNote, resizeStickyNote } from "../src/notes/StickyNotesLayer.js";

const note = { x: 0.2, y: 0.3, width: 0.3, height: 0.2 };

describe("便條貼標準化位置與尺寸", () => {
  it("拖曳位置會限制在白板內", () => {
    expect(moveStickyNote(note, 0.1, -0.1)).toEqual({ x: 0.3, y: 0.2 });
    expect(moveStickyNote(note, 1, 1)).toEqual({ x: 0.7, y: 0.8 });
    expect(moveStickyNote(note, -1, -1)).toEqual({ x: 0, y: 0 });
  });

  it("縮放尺寸有最小值且不會超出白板", () => {
    expect(resizeStickyNote(note, 0.1, 0.1)).toEqual({ width: 0.4, height: 0.3 });
    expect(resizeStickyNote(note, -1, -1)).toEqual({ width: 0.14, height: 0.12 });
    expect(resizeStickyNote(note, 1, 1)).toEqual({ width: 0.8, height: 0.7 });
  });
});
