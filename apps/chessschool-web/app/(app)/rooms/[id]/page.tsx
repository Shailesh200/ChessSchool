import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, ROOMS, type RoomId } from "@chessschool/design";
import { RoomDetail } from "@/components/RoomDetail";

export function generateStaticParams() {
  return ROOMS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: ROOMS.includes(id as RoomId) ? copy.rooms.list[id as RoomId].name : copy.rooms.title };
}

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ROOMS.includes(id as RoomId)) notFound();
  return <RoomDetail id={id as RoomId} />;
}
