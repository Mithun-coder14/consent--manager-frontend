import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth/mammoth.browser'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_PDF_PAGES = 50

function detectType(bytes) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'  // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) return 'docx'                                         // PK (zip)
  if (bytes[0] === 0xD0 && bytes[1] === 0xCF) return 'doc'                                          // old Word
  return 'text'
}

export async function extractText(arrayBuffer) {
  const type = detectType(new Uint8Array(arrayBuffer.slice(0, 8)))

  if (type === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const pages = []
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PDF_PAGES); i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map(item => item.str).join(' '))
    }
    const text = pages.join('\n\n').trim()
    if (!text) {
      throw new Error('This PDF looks like a scanned image — there is no readable text in it.')
    }
    return text
  }

  if (type === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer })
    if (!result.value.trim()) throw new Error('This Word document appears to be empty.')
    return result.value
  }

  if (type === 'doc') {
    throw new Error('Old .doc format is not supported — please save it as .docx or PDF.')
  }

  return new TextDecoder('utf-8').decode(arrayBuffer)
}