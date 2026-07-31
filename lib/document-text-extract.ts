export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = (await import('pdfjs-dist/build/pdf.min.mjs')) as typeof import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: string[] = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    let pageText = ''
    let lastY = -1
    let lineText = ''

    for (const item of textContent.items) {
      if (!('str' in item) || !('transform' in item)) continue
      const itemY = (item as { transform: number[] }).transform[5]

      if (lastY !== -1 && Math.abs(itemY - lastY) > 5) {
        if (lineText.trim()) pageText += `${lineText.trim()}\n`
        lineText = ''
      }

      const textToAdd = item.str
      if (lineText && !lineText.endsWith(' ') && !textToAdd.startsWith(' ')) {
        lineText += ` ${textToAdd}`
      } else {
        lineText += textToAdd
      }
      lastY = itemY
    }

    if (lineText.trim()) pageText += `${lineText.trim()}\n`
    if (pageText.trim()) pages.push(pageText.trim())
  }

  return pages.join('\n\n')
}

export async function extractWordText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value?.trim() || ''
}
