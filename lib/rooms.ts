import { supabase } from "./supabase";

export type RoomFilters = {
  platforms: number[]; // TMDB watch-provider ids
  genreIds: number[];
  maxRuntimeMinutes: number | null;
  industry: string | null; // key into INDUSTRY_OPTIONS, e.g. "bollywood"
};

export async function updateRoomFilters(roomId: string, filters: RoomFilters) {
  const { error } = await supabase.from("rooms").update({ filters }).eq("id", roomId);
  if (error) throw error;
}

function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function createRoom(deviceId: string, displayName: string, filters: RoomFilters) {
  const code = generateRoomCode();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ code, host_id: deviceId, filters })
    .select()
    .single();

  if (roomError) throw roomError;

  const { error: memberError } = await supabase
    .from("room_members")
    .insert({ room_id: room.id, device_id: deviceId, display_name: displayName });

  if (memberError) throw memberError;

  return room;
}

export async function joinRoom(code: string, deviceId: string, displayName: string) {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select()
    .eq("code", code)
    .single();

  if (roomError || !room) throw new Error("Room not found. Double-check the code.");

  const { error: memberError } = await supabase
    .from("room_members")
    .upsert(
      { room_id: room.id, device_id: deviceId, display_name: displayName },
      { onConflict: "room_id,device_id" }
    );

  if (memberError) throw memberError;

  return room;
}

export async function submitSwipe(
  roomId: string,
  deviceId: string,
  tmdbId: number,
  direction: "right" | "left" | "up"
) {
  const { error } = await supabase
    .from("swipes")
    .upsert(
      { room_id: roomId, device_id: deviceId, tmdb_id: tmdbId, direction },
      { onConflict: "room_id,device_id,tmdb_id" }
    );

  if (error) throw error;

  if (direction === "right") {
    const { data, error: matchError } = await supabase.rpc("check_for_match", {
      p_room_id: roomId,
      p_tmdb_id: tmdbId,
    });
    if (matchError) throw matchError;
    return Boolean(data);
  }

  return false;
}

export function subscribeToRoom(roomId: string, onChange: () => void) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, onChange)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "swipes", filter: `room_id=eq.${roomId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
