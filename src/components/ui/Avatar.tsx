// Wspólny avatar: zdjęcie (jeśli url) albo emoji w kolorowym kółku (fallback).
export function Avatar({
  url,
  emoji,
  color,
  size = 40,
  alt = '',
}: {
  url?: string | null
  emoji: string
  color?: string | null
  size?: number
  alt?: string
}) {
  const dim = { width: size, height: size }

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        style={dim}
        className="rounded-full object-cover"
      />
    )
  }

  return (
    <span
      style={{ ...dim, backgroundColor: (color ?? '#00897b') + '22', fontSize: size * 0.5 }}
      className="flex items-center justify-center rounded-full leading-none"
    >
      {emoji}
    </span>
  )
}
