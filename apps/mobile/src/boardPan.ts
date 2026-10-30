/**
 * Board drag-to-move responder config, kept free of react-native imports so it can be
 * unit-tested in node. ChessBoard passes the result to PanResponder.create().
 */

export const DRAG_ACTIVATION_DISTANCE = 10;

type Ref<T> = { current: T };

export type BoardPanEvent = { nativeEvent: { locationX: number; locationY: number } };

export type BoardPanDeps<Cell> = {
  dragRef: Ref<{ from: string; piece: Cell } | null>;
  movedRef: Ref<boolean>;
  startXYRef: Ref<{ x: number; y: number } | null>;
  sqAtRef: Ref<(x: number, y: number) => string | null>;
  pieceAtRef: Ref<(sq: string) => Cell>;
  tapRef: Ref<(sq: string, piece: Cell) => void>;
  tryMoveRef: Ref<(from: string, to: string) => unknown>;
  interactiveRef: Ref<boolean>;
  setDragFrom: (sq: string | null) => void;
  setDragXY: (xy: { x: number; y: number } | null) => void;
  setSelected: (sq: string | null) => void;
};

export function createBoardPanConfig<Cell>(d: BoardPanDeps<Cell>) {
  return {
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // A drag that began on a piece of an interactive board must not be taken over by an
    // ancestor (the lesson body ScrollView): once it steals the gesture, onPanResponderTerminate
    // cancels the drag mid-move. We only refuse while such a drag is active, so a touch that
    // starts on an empty square or on a non-interactive board can still scroll the lesson.
    onPanResponderTerminationRequest: () =>
      !(d.dragRef.current?.piece && d.interactiveRef.current),
    onPanResponderGrant: (e: BoardPanEvent) => {
      d.movedRef.current = false;
      const { locationX, locationY } = e.nativeEvent;
      d.startXYRef.current = { x: locationX, y: locationY };
      const sq = d.sqAtRef.current(locationX, locationY);
      d.dragRef.current = sq ? { from: sq, piece: d.pieceAtRef.current(sq) } : null;
    },
    onPanResponderMove: (e: BoardPanEvent) => {
      const start = d.startXYRef.current;
      const dx = start ? e.nativeEvent.locationX - start.x : 0;
      const dy = start ? e.nativeEvent.locationY - start.y : 0;
      if (!d.movedRef.current && Math.hypot(dx, dy) < DRAG_ACTIVATION_DISTANCE) return;
      d.movedRef.current = true;
      // start the floating ghost only once the finger actually moves (so a tap doesn't flash it)
      if (d.dragRef.current?.piece && d.interactiveRef.current) {
        d.setDragFrom(d.dragRef.current.from);
        d.setDragXY({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
      }
    },
    onPanResponderRelease: (e: BoardPanEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const drag = d.dragRef.current;
      const target = d.sqAtRef.current(locationX, locationY);
      d.dragRef.current = null;
      d.setDragFrom(null);
      d.setDragXY(null);
      if (!drag) return;
      const draggedFar = d.movedRef.current && target && target !== drag.from;
      if (draggedFar && drag.piece) {
        d.tryMoveRef.current(drag.from, target!);
        d.setSelected(null);
      } else {
        d.tapRef.current(drag.from, drag.piece); // treat as a tap
      }
    },
    onPanResponderTerminate: () => {
      d.dragRef.current = null;
      d.startXYRef.current = null;
      d.setDragFrom(null);
      d.setDragXY(null);
    },
  };
}
