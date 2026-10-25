// Phone screenshots are large; scale to at most 1600px (or `max`) and save as JPEG before sending.
export async function shrink(file: File, max = 1600) {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Bumped after you change your photo, so pictures already on screen are fetched again.
export let photoVersion = Date.now()
export const photoChanged = () => (photoVersion = Date.now())
