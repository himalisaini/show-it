export type RootStackParamList = {
  Home: undefined;
  Lobby: { roomCode: string };
  Swipe: { roomCode: string };
  Match: { roomCode: string; tmdbId: number };
};
