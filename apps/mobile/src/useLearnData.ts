import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "@/api";
import { isoDay } from "@/progression";
import { cacheInvalidate, cachePeek, cacheSet, cacheAge, cacheGeneration } from "@/dataCache";
import { fetchProgress } from "@/progressStore";
import type { CampusStage } from "@/CampusMap";

export type Resume = {
  complete: boolean;
  lessonId?: string;
  lessonTitle?: string;
  className?: string;
  semesterTitle?: string;
  classIndex?: number;
  totalClasses?: number;
  done?: number;
  total?: number;
};

export type DailyPuzzle = {
  day: string;
  lessonId: string | null;
  title: string | null;
  tag: string | null;
  emoji: string | null;
};

export type LearnData = {
  resume: Resume;
  stages: CampusStage[];
  daily: DailyPuzzle | null;
};

const CACHE_KEY = "learn-screen";
/** Show cached campus immediately; refresh silently after this age. */
const STALE_MS = 60_000;

async function fetchLearnBundle(): Promise<LearnData> {
  const [resume, campus, daily] = await Promise.all([
    api<Resume>("/api/next-lesson"),
    api<{ stages: CampusStage[] }>("/api/campus"),
    api<DailyPuzzle>(`/api/daily-puzzle?day=${isoDay()}`).catch(() => null),
  ]);
  return { resume, stages: campus.stages ?? [], daily };
}

type Mode = "initial" | "silent" | "pull";

export function useLearnData() {
  const cached = cachePeek<LearnData>(CACHE_KEY);
  const [data, setData] = useState<LearnData | null>(cached);
  const [initialLoading, setInitialLoading] = useState(!cached);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: Mode) => {
    if (mode === "pull") setPullRefreshing(true);
    else if (mode === "initial" && !cachePeek<LearnData>(CACHE_KEY)) setInitialLoading(true);

    // Read before the fetch starts: a wipe (logout, 401, delete) while it is in flight bumps it.
    const startedAt = cacheGeneration();
    try {
      const fresh = await fetchLearnBundle();
      // The reply belongs to whoever was signed in when it started; drop it after a wipe.
      if (!cacheSet(CACHE_KEY, fresh, startedAt)) return;
      setData(fresh);
      setError(null);
      void fetchProgress(false).catch(() => void 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reach the server";
      if (!cachePeek<LearnData>(CACHE_KEY)) setError(msg);
    } finally {
      setInitialLoading(false);
      setPullRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  // Silent background refresh when returning to the tab (no pull spinner).
  useFocusEffect(
    useCallback(() => {
      if (cacheAge(CACHE_KEY) > STALE_MS) void load("silent");
      else void fetchProgress(false).catch(() => void 0);
    }, [load]),
  );

  const refresh = useCallback(() => load("pull"), [load]);

  return { data, initialLoading, pullRefreshing, error, refresh };
}

/** Call after lesson complete so resume card updates on next visit. */
export function invalidateLearnCache(): void {
  cacheInvalidate(CACHE_KEY);
}
