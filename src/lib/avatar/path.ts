// Ścieżka pliku avatara w buckecie 'avatars'. Pierwszy segment = userId
// (polityka RLS pisze tylko do własnego folderu, chyba że rodzic).
// Nazwa losowa (uuid), więc każdy upload to nowy obiekt.
export function buildAvatarPath(userId: string): string {
  return `${userId}/${crypto.randomUUID()}.webp`
}
