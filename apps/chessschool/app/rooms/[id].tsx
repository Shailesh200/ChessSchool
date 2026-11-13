import { copy, ROOMS, type RoomId } from "@chessschool/design";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { ROOM_META } from "@/components/rooms";
import { Button, Page, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";

export default function RoomDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  if (!ROOMS.includes(id as RoomId)) return <Redirect href="/gym" />;
  if (ROOM_META[id as RoomId].open) return <Redirect href={ROOM_META[id as RoomId].href} />;
  const room = copy.rooms.list[id as RoomId];
  const meta = ROOM_META[id as RoomId];
  return (
    <Page title={room.name} banner={false} footer={<Button title={copy.rooms.detailCta} icon="gym" onPress={() => router.replace("/gym")} />}>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 20, paddingHorizontal: 20, borderRadius: 24, backgroundColor: meta.tint(c) }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <Cody animation={meta.pose} size={120} label={copy.a11y.mascot} />
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.card, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Icon name={meta.icon} color={c.text} size={28} />
          </View>
        </View>
        <T role="title" header center>
          {room.promise}
        </T>
        <T role="body" color="textMuted" center>
          {copy.rooms.detailBody}
        </T>
      </View>
    </Page>
  );
}
