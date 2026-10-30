import { useState, type ReactNode } from "react";
import { ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { computeLessonLayout, lessonStageStyles, type LessonLayout } from "@/lessonLayout";

/**
 * Shared layout for the lesson player (lessons, homework, exams). One place owns
 * the geometry; see lessonLayout.ts for the root cause and the rules.
 */
export function LessonStageLayout({
  header,
  coach,
  board,
  hint,
  footer,
  hasBoard = true,
}: {
  header: ReactNode;
  coach: (layout: LessonLayout) => ReactNode;
  board: (layout: LessonLayout) => ReactNode;
  hint?: ReactNode;
  footer: ReactNode;
  hasBoard?: boolean;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const [body, setBody] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBody((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
  };
  const layout = computeLessonLayout({
    windowWidth: width,
    windowHeight: height,
    fontScale,
    bodyWidth: body?.w,
    bodyHeight: body?.h,
    hasBoard,
  });
  const s = lessonStageStyles(layout);

  if (layout.sideBySide) {
    return (
      <View style={s.root}>
        {header}
        <View style={s.sideRow} onLayout={onLayout} testID="lesson-side-row">
          <View style={s.boardCol} testID="lesson-board-col">
            {board(layout)}
          </View>
          <View style={s.panelCol}>
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} testID="lesson-scroll">
              {coach(layout)}
              {hint}
            </ScrollView>
            {footer}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {header}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} onLayout={onLayout} testID="lesson-scroll">
        {coach(layout)}
        <View style={s.boardSlot} testID="lesson-board-slot">
          {board(layout)}
        </View>
        {hint}
      </ScrollView>
      {footer}
    </View>
  );
}

