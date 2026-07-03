// Skalowanie obrazu w przeglądarce: center-crop do kwadratu + kompresja WebP.
// Brak testu jednostkowego (canvas dostępny tylko w przeglądarce) — logika
// trzymana mała i czysta; weryfikacja ręczna w aplikacji.
export async function resizeToSquareWebp(file: File, size = 512): Promise<Blob> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nie jest obsługiwany')

  // Center-crop: bierzemy kwadrat ze środka źródła.
  const side = Math.min(img.width, img.height)
  const sx = (img.width - side) / 2
  const sy = (img.height - side) / 2
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85)
  )
  if (!blob) throw new Error('Nie udało się przetworzyć obrazu')
  return blob
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Nie udało się wczytać pliku'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nieprawidłowy obraz'))
    img.src = src
  })
}
