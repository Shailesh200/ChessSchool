import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { PathLoader } from "./PathLoader";
import { useRouter } from "expo-router";
import {
  KitButton,
  KitCard,
  KitCoachAvatar,
  KitIcon,
  type KitIconName,
  usePremiumKitTheme,
} from "@/components/kit";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAuth } from "@/auth";
import { useNetwork } from "@/NetworkProvider";
import { useLearnData } from "@/useLearnData";
import { useProgress } from "@/progressStore";
import { useSettings } from "@/settings";
import { useAppTheme } from "@/ThemeProvider";
import { haptics } from "@/haptics";
import { getActiveBotMatch, hydrateMatchStore, subscribeMatchStore } from "@/matchStore";
import { dueLessonIds, isDailyPuzzleDone, isoDay, needsPlacementTest, shouldRecommendPreschool } from "@/progression";
import { allRoutineDoneToday, routineDoneToday, ROUTINE_STEP_IDS } from "@/homeworkRoutine";
import { premiumTokensJson } from "@/theme/premium";
import {
  buildCourseMap,
  campusHasPath,
  courseMapPhase,
  offlineLearnRows,
  reviewDueCount,
  type CourseMapNode,
  type CourseMapPhase,
  type CourseMapView,
  type MapStage,
} from "./aceModel";

const emptyArt = require("../../../assets/kit/illustrations/empty.webp");
const errorArt = require("../../../assets/kit/illustrations/error.webp");
const offlineArt = require("../../../assets/kit/illustrations/offline.webp");
const loaderArt = require("../../../assets/kit/lottie/loader.png");

type Progress = {
  xp: number;
  streak: number;
  dailyGoalXp: number;
  rating: number;
  placementDone?: boolean;
  lessons: Record<string, { mastery: number; attempts: number; lastSeen: number; dueAt: number }>;
  activityDays: Record<string, number>;
  dailyPuzzleDay?: string | null;
  graduatedClasses?: string[];
};

export type LearnFixture = {
  phase?: CourseMapPhase;
  stages?: MapStage[];
  dueCount?: number;
  resumeTitle?: string | null;
  resumeLessonId?: string | null;
  /** Hide academy extras so a design screenshot shows only the map states. */
  chromeOnly?: boolean;
};

export function PremiumLearnScreen({ fixture }: { fixture?: LearnFixture }) {
  const router = useRouter();
  const { guest } = useAuth();
  const { isConnected } = useNetwork();
  const { reducedMotion } = useAppTheme();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const settings = useSettings();
  const progress = useProgress() as Progress | null;
  const live = useLearnData();
  const stages = (fixture?.stages ?? live.data?.stages ?? []) as MapStage[];
  const hasPath = campusHasPath(stages);
  const phase =
    fixture?.phase ??
    courseMapPhase({
      online: isConnected,
      loading: live.initialLoading,
      failed: Boolean(live.error),
      hasPath,
    });
  const map = useMemo(() => (phase === "ready" || fixture?.stages ? buildCourseMap(stages) : null), [phase, stages, fixture?.stages]);
  const due = fixture?.dueCount ?? reviewDueCount(progress?.lessons);
  const nodeSize = premiumTokensJson.size.node;
  const nodeCurrent = premiumTokensJson.size["node-current"];

  useEffect(() => {
    void hydrateMatchStore();
  }, []);
  const activeMatch = useSyncExternalStore(subscribeMatchStore, getActiveBotMatch, () => null);

  const goal = progress?.dailyGoalXp ?? 50;
  const today = isoDay();
  const todayXp = (progress?.activityDays ?? {})[today] ?? 0;
  const showPlacement = !guest && !!progress && needsPlacementTest(progress);
  const recommendPreschool =
    !guest &&
    shouldRecommendPreschool(settings.targetElo, {
      lessons: (progress?.lessons ?? {}) as Record<string, { mastery?: number; attempts?: number }>,
      graduatedClasses: progress?.graduatedClasses,
    });
  const dueIds = dueLessonIds(
    (progress?.lessons ?? {}) as Record<string, { mastery: number; attempts: number; lastSeen: number; dueAt: number }>,
  );
  const daily = live.data?.daily ?? null;
  const dailyDone = daily ? isDailyPuzzleDone(daily.day, progress?.dailyPuzzleDay) : false;
  const homeworkDoneCount = routineDoneToday(progress as Record<string, unknown> | null, today).length;
  const homeworkAllDone = allRoutineDoneToday(progress as Record<string, unknown> | null, today);
  const lockedTitles = map?.nodes.filter((node) => !node.navigable).map((node) => node.title) ?? ["Class exam"];
  const offline = offlineLearnRows({
    resumeTitle: fixture?.resumeTitle ?? live.data?.resume?.lessonTitle,
    resumeLessonId: fixture?.resumeLessonId ?? live.data?.resume?.lessonId,
    dueCount: due,
    lockedTitles,
  });

  function openNode(node: CourseMapNode) {
    if (!node.navigable || !node.href) {
      haptics.error();
      return;
    }
    haptics.tap();
    if (node.href.pathname === "/class/[id]" && node.href.params.id) {
      router.push({ pathname: "/class/[id]", params: { id: node.href.params.id } });
      return;
    }
    if (node.href.params.stage) {
      router.push({ pathname: "/exam/school/[stage]", params: { stage: node.href.params.stage } });
    }
  }

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView
        testID={`course-map-${phase}`}
        contentContainerStyle={{ paddingHorizontal: space["4"], paddingBottom: space["8"], gap: space["4"] }}
        refreshControl={
          <RefreshControl refreshing={live.pullRefreshing} onRefresh={live.refresh} tintColor={colors.brand} />
        }
      >
        {phase === "loading" ? <LoadingState reducedMotion={reducedMotion} /> : null}
        {phase === "empty" ? (
          <StateBlock
            art={emptyArt}
            title="Your path starts here"
            body="Pick your first class, or take a short placement and I'll choose one for you."
            actions={
              <>
                <KitButton label="Pick my first class" onPress={() => router.push("/classes")} />
                <KitButton label="Take the placement" variant="soft" onPress={() => router.push("/placement")} />
              </>
            }
          />
        ) : null}
        {phase === "error" ? (
          <StateBlock
            art={errorArt}
            title="I couldn't load your path"
            body="That was on my side, not yours. Your progress is safe."
            actions={
              <>
                <KitButton label="Try again" variant="accent" icon="refreshCw" onPress={live.refresh} />
                <KitButton label="Back to start" variant="ghost" onPress={() => router.replace("/")} />
              </>
            }
          />
        ) : null}
        {phase === "offline" ? (
          <View style={{ gap: space["3"] }}>
            <Image source={offlineArt} accessibilityIgnoresInvertColors style={{ width: 128, height: 128, alignSelf: "center" }} />
            <View
              accessibilityRole="text"
              style={{
                flexDirection: "row",
                gap: space["3"],
                alignItems: "center",
                backgroundColor: colors.warningSoft,
                borderRadius: radius.md,
                padding: space["3"],
              }}
            >
              <KitIcon name="wifiOff" size={22} color={colors.warningText} />
              <Text style={{ flex: 1, color: colors.warningText, fontFamily: font.uiBold, fontSize: type["body-sm"].fontSize, lineHeight: type["body-sm"].lineHeight }}>
                You're offline. Saved lessons still work, and your progress syncs later.
              </Text>
            </View>
            <Text style={overline(colors.ink500, font.uiBold, type.overline)}>Ready offline</Text>
            {offline.ready.length === 0 ? (
              <Text style={{ color: colors.ink500, fontFamily: font.uiMedium }}>Nothing saved on this device yet.</Text>
            ) : (
              offline.ready.map((row) => (
                <RailRow
                  key={row.id}
                  icon="download"
                  title={row.title}
                  subtitle={row.caption}
                  onPress={() => {
                    if (row.id === "daily-review") router.push("/review/queue");
                    else router.push({ pathname: "/lesson/[id]", params: { id: row.id } });
                  }}
                />
              ))
            )}
            <Text style={overline(colors.ink500, font.uiBold, type.overline)}>Needs internet</Text>
            {offline.needsInternet.map((row) => (
              <RailRow key={row.id} icon="wifiOff" title={row.title} subtitle={row.caption} muted />
            ))}
          </View>
        ) : null}
        {phase === "ready" && map ? (
          <ReadyMap
            map={map}
            due={due}
            coach={settings.coachCharacter ?? "otto"}
            nodeSize={nodeSize}
            nodeCurrent={nodeCurrent}
            onNode={openNode}
            onReview={() => router.push("/review/queue")}
            onGym={() => router.push("/gym")}
          />
        ) : null}

        {fixture?.chromeOnly ? null : (
        <>
        {recommendPreschool ? (
          <KitCard>
            <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.sm.fontSize }}>Optional: the Starter stage</Text>
            <Text style={{ color: colors.ink500, marginTop: 4, fontFamily: font.uiMedium }}>Learn the board, pieces, and notation — skip anytime.</Text>
            <View style={{ marginTop: space["3"] }}>
              <KitButton label="Start here" size="sm" variant="outline" onPress={() => router.push("/class/class-pre-board")} />
            </View>
          </KitCard>
        ) : null}
        {showPlacement ? (
          <KitCard>
            <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.sm.fontSize }}>New here? Take a quick placement test</Text>
            <Text style={{ color: colors.ink500, marginTop: 4, fontFamily: font.uiMedium }}>8 puzzles — we'll place you in the right school.</Text>
            <View style={{ marginTop: space["3"] }}>
              <KitButton label="Start placement test" size="sm" onPress={() => router.push("/placement")} />
            </View>
          </KitCard>
        ) : null}
        {activeMatch ? (
          <KitCard>
            <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>Bot match in progress</Text>
            <Text style={{ color: colors.ink500, marginTop: 4 }}>Rated {activeMatch.targetElo} · {activeMatch.moves.length} moves played</Text>
            <View style={{ marginTop: space["3"] }}>
              <KitButton
                label="Resume match"
                onPress={() =>
                  router.push({
                    pathname: "/play/game",
                    params: {
                      elo: String(activeMatch.targetElo),
                      time: activeMatch.timeControlMin > 0 ? String(activeMatch.timeControlMin) : "none",
                    },
                  })
                }
              />
            </View>
          </KitCard>
        ) : null}
        {!guest && daily?.lessonId ? (
          <RailRow
            icon="target"
            title={dailyDone ? "Daily puzzle done" : "Daily puzzle"}
            subtitle={dailyDone ? "Come back tomorrow for a fresh position." : daily.title ?? "One puzzle for today"}
            onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: daily.lessonId!, daily: "1" } })}
          />
        ) : null}
        {!guest ? (
          <Pressable testID="homework" onPress={() => router.push("/homework")}>
            <RailRow
              icon={homeworkAllDone ? "check" : "bookOpen"}
              title={homeworkAllDone ? "Homework done for today!" : "Today's homework"}
              subtitle={
                homeworkAllDone
                  ? "Great work — come back tomorrow for a fresh set."
                  : `${homeworkDoneCount}/${ROUTINE_STEP_IDS.length} done`
              }
            />
          </Pressable>
        ) : null}
        <KitCard>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>Daily goal</Text>
            <Text style={{ fontFamily: font.uiBold, color: colors.ink500 }}>
              {Math.min(todayXp, goal)}/{goal} XP
            </Text>
          </View>
          <View style={{ height: 12, borderRadius: 99, backgroundColor: colors.surfaceSunken, marginTop: space["2"], overflow: "hidden" }}>
            <View style={{ height: 12, width: `${Math.min(100, (todayXp / goal) * 100)}%`, backgroundColor: colors.gold }} />
          </View>
        </KitCard>
        {dueIds[0] ? (
          <RailRow
            icon="refreshCw"
            title={`Review due · ${dueIds.length}`}
            subtitle="Opens the first lesson that is due"
            onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: dueIds[0]! } })}
          />
        ) : null}
        <RailRow icon="search" title="Search" subtitle="Lessons, classes, and actions" onPress={() => router.push("/search")} />
        </>
        )}
      </ScrollView>
    </ThemedSafeArea>
  );
}

function overline(color: string, family: string, scale: { fontSize: number; lineHeight: number }) {
  return {
    color,
    fontFamily: family,
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    letterSpacing: 1.1,
    textTransform: "uppercase" as const,
  };
}

function LoadingState({ reducedMotion }: { reducedMotion: boolean }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <View style={{ gap: space["4"] }}>
      <View style={{ height: 84, borderRadius: radius.xl, backgroundColor: colors.skeleton }} />
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space["3"] }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.skeleton }} />
          <View style={{ flex: 1, gap: space["2"] }}>
            <View style={{ height: 16, width: "70%", borderRadius: 8, backgroundColor: colors.skeleton }} />
            <View style={{ height: 12, width: "45%", borderRadius: 8, backgroundColor: colors.skeleton }} />
          </View>
        </View>
      ))}
      <View style={{ height: 72, borderRadius: radius.lg, backgroundColor: colors.skeleton }} />
      <View style={{ alignItems: "center", gap: space["2"] }}>
        {reducedMotion ? (
          <Image source={loaderArt} style={{ width: 72, height: 84 }} accessibilityIgnoresInvertColors />
        ) : (
          <PathLoader />
        )}
        <Text style={{ fontFamily: font.uiBold, color: colors.ink500, fontSize: type["body-sm"].fontSize }}>Loading your path…</Text>
      </View>
    </View>
  );
}

function StateBlock({
  art,
  title,
  body,
  actions,
}: {
  art: number;
  title: string;
  body: string;
  actions: ReactNode;
}) {
  const { colors, font, type, space } = usePremiumKitTheme();
  return (
    <View style={{ alignItems: "center", gap: space["3"], paddingVertical: space["6"] }}>
      <Image source={art} style={{ width: 176, height: 176 }} accessibilityIgnoresInvertColors />
      <Text style={{ fontFamily: font.displayBold, fontSize: type.h2.fontSize, lineHeight: type.h2.lineHeight, color: colors.ink, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ fontFamily: font.uiMedium, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight, color: colors.ink500, textAlign: "center" }}>
        {body}
      </Text>
      <View style={{ alignSelf: "stretch", gap: space["2"], marginTop: space["2"] }}>{actions}</View>
    </View>
  );
}

function ReadyMap({
  map,
  due,
  coach,
  nodeSize,
  nodeCurrent,
  onNode,
  onReview,
  onGym,
}: {
  map: CourseMapView;
  due: number;
  coach: string;
  nodeSize: number;
  nodeCurrent: number;
  onNode: (node: CourseMapNode) => void;
  onReview: () => void;
  onGym: () => void;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const ring = premiumTokensJson.size["ring-md"];
  return (
    <View style={{ gap: space["4"] }}>
      <View
        style={{
          backgroundColor: colors.feature,
          borderRadius: radius.xl,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: space["3"],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={overline(colors.featureSub, font.uiBold, type.overline)}>{map.overline}</Text>
          <Text style={{ color: colors.featureText, fontFamily: font.displayBold, fontSize: type.h3.fontSize, lineHeight: type.h3.lineHeight }}>
            {map.title}
          </Text>
        </View>
        <ProgressRing size={ring} percent={map.ringPercent} label={`${map.done}/${map.total}`} track="rgba(255,255,255,0.25)" ink={colors.featureText} fill={colors.gold} />
      </View>
      <View testID="course-map-nodes" style={{ paddingTop: space["6"], gap: space["2"] }}>
        {map.nodes.map((node, index) => (
          <View key={node.id}>
            {index > 0 ? <Trail fromLeft={map.nodes[index - 1]?.side === "l"} color={colors.trail} /> : null}
            <MapNode node={node} size={node.kind === "current" ? nodeCurrent : nodeSize} onPress={() => onNode(node)} />
          </View>
        ))}
      </View>
      <RailRow
        tone="accent"
        icon="refreshCw"
        title={due > 0 ? `Review · ${due} due` : "Review"}
        subtitle="10 steps or fewer"
        action={due > 0 ? <KitButton label="Start" size="sm" variant="soft" block={false} onPress={onReview} /> : null}
      />
      <RailRow icon="dumbbell" title="Gym" subtitle="Drills and puzzle practice" onPress={onGym} chevron />
      <View style={{ flexDirection: "row", gap: space["3"], alignItems: "center" }}>
        <KitCoachAvatar character={coach} state="idle" size={56} />
        <View style={{ flex: 1, backgroundColor: colors.coachBubble, borderRadius: radius.lg, padding: space["3"], borderWidth: 1, borderColor: colors.hairline }}>
          <Text style={{ fontFamily: font.uiMedium, color: colors.ink, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight }}>{map.coachLine}</Text>
        </View>
      </View>
    </View>
  );
}

function MapNode({ node, size, onPress }: { node: CourseMapNode; size: number; onPress: () => void }) {
  const { colors, font, type } = usePremiumKitTheme();
  const fill =
    node.kind === "done"
      ? colors.nodeDone
      : node.kind === "current"
        ? colors.nodeCurrent
        : node.kind === "exam"
          ? colors.nodeExam
          : colors.nodeLocked;
  const edge =
    node.kind === "done"
      ? colors.nodeDoneEdge
      : node.kind === "current"
        ? colors.nodeCurrentEdge
        : node.kind === "exam"
          ? colors.nodeExamEdge
          : colors.nodeLockedEdge;
  const iconColor =
    node.kind === "done"
      ? colors.nodeDoneIcon
      : node.kind === "current"
        ? colors.nodeCurrentIcon
        : node.kind === "exam"
          ? colors.nodeExamIcon
          : colors.nodeLockedIcon;
  const icon: KitIconName = node.kind === "done" ? "check" : node.kind === "current" ? "play" : node.kind === "exam" ? "flag" : "lock";
  const shift = node.side === "l" ? -44 : 44;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ transform: [{ translateX: shift }], alignItems: "center" }}>
        {node.kind === "current" ? (
          <View style={{ position: "absolute", top: -22, backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, zIndex: 2 }}>
            <Text style={{ color: colors.bg, fontFamily: font.uiBold, fontSize: 11, letterSpacing: 0.8 }}>START</Text>
          </View>
        ) : null}
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          {node.kind === "current" ? (
            <View
              style={{
                position: "absolute",
                width: size + 16,
                height: size + 16,
                borderRadius: (size + 16) / 2,
                backgroundColor: colors.nodeCurrentHalo,
              }}
            />
          ) : null}
          <Pressable
            testID={`map-node-${node.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${node.title}, ${node.caption}`}
            onPress={onPress}
            style={{
              width: size,
              height: size,
              borderRadius: node.kind === "exam" ? 20 : size / 2,
              backgroundColor: fill,
              alignItems: "center",
              justifyContent: "center",
              borderBottomWidth: 5,
              borderBottomColor: edge,
            }}
          >
            <KitIcon name={icon} size={node.kind === "current" ? 28 : 24} color={iconColor} filled={node.kind === "current"} />
          </Pressable>
        </View>
        <View
          style={{
            position: "absolute",
            top: size / 2 - 16,
            width: 120,
            ...(node.side === "l" ? { left: size + 12 } : { right: size + 12 }),
          }}
        >
          <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.sm.fontSize, textAlign: node.side === "r" ? "right" : "left" }} numberOfLines={2}>
            {node.title}
          </Text>
          <Text style={{ fontFamily: font.uiMedium, color: colors.ink500, fontSize: type.caption.fontSize, textAlign: node.side === "r" ? "right" : "left" }}>
            {node.caption}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Trail({ fromLeft, color }: { fromLeft: boolean; color: string }) {
  const d = fromLeft ? "M62 2 C62 26 138 14 138 38" : "M138 2 C138 26 62 14 62 38";
  return (
    <Svg width={200} height={40} viewBox="0 0 200 40" style={{ alignSelf: "center" }}>
      <Path d={d} stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray="1 13" />
    </Svg>
  );
}

function ProgressRing({
  size,
  percent,
  label,
  track,
  ink,
  fill,
}: {
  size: number;
  percent: number;
  label: string;
  track: string;
  ink: string;
  fill: string;
}) {
  const { font } = usePremiumKitTheme();
  const stroke = Math.max(4, size * 0.1);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityLabel={label}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fill}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dash}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ color: ink, fontFamily: font.displayBold, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export function RailRow({
  icon,
  title,
  subtitle,
  onPress,
  action,
  chevron,
  muted,
  tone = "default",
}: {
  icon: KitIconName;
  title: string;
  subtitle: string;
  onPress?: () => void;
  action?: ReactNode;
  chevron?: boolean;
  muted?: boolean;
  tone?: "default" | "accent";
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const accent = tone === "accent";
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space["3"],
        backgroundColor: accent ? colors.accentSoft : colors.surfaceCard,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: accent ? colors.accent : colors.hairline,
        padding: space["3"],
        opacity: muted ? 0.7 : 1,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: muted ? colors.surfaceSunken : accent ? colors.accent : colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
        <KitIcon name={icon} size={20} color={muted ? colors.ink500 : accent ? colors.textOnAccent : colors.brandSoftText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.displayBold, color: accent ? colors.accentSoftText : colors.ink, fontSize: type.sm.fontSize }}>{title}</Text>
        <Text style={{ fontFamily: font.uiMedium, color: accent ? colors.accentSoftText : colors.ink500, fontSize: type.caption.fontSize }}>{subtitle}</Text>
      </View>
      {action}
      {chevron ? <KitIcon name="chevronRight" size={18} color={colors.ink300} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}
