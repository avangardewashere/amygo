// Files going out (the browser's own download) and coming in (the file picker).

// Hands the browser a file to save, through its own download (on a phone it lands
// in Downloads): the text becomes a file in memory, and a hidden link to it is clicked.
export function downloadFile(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // The file in memory is let go a little later: some browsers are still
  // starting the download when click() returns
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// The file just picked in a file picker, if any. The picker is emptied at once:
// browsers only report a pick that changes it, so otherwise picking the same
// file again would do nothing.
export function takePickedFile(input: { files: ArrayLike<File> | null; value: string }) {
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}
