import { NextResponse } from "next/server";
import { db } from "@/db";
import { semesters, classes } from "@/db/schema";

export const revalidate = 3600;

/** Light catalog for mobile browsing: semesters + their classes (no lesson bodies). */
export async function GET() {
  const [sems, cls] = await Promise.all([
    db.select({ id: semesters.id, title: semesters.title, stage: semesters.stage, sortOrder: semesters.sortOrder }).from(semesters),
    db.select({ id: classes.id, title: classes.title, emoji: classes.emoji, blurb: classes.blurb, semesterId: classes.semesterId, sortOrder: classes.sortOrder }).from(classes),
  ]);
  sems.sort((a, b) => a.sortOrder - b.sortOrder);
  cls.sort((a, b) => a.sortOrder - b.sortOrder);
  return NextResponse.json({ semesters: sems, classes: cls });
}
