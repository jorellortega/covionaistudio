import { extractPdfText, extractWordText } from '@/lib/document-text-extract'

export const CREATIVE_IMPORT_ACCEPT =
  "image/*,.pdf,.doc,.docx,.txt,.rtf,.md"

export const CREATIVE_IMPORT_MAX_FILES = 5
export const CREATIVE_IMPORT_MAX_BYTES = 20 * 1024 * 1024
export const CREATIVE_DOCUMENT_TEXT_LIMIT = 80_000
export const CREATIVE_AI_DOCUMENT_TEXT_LIMIT = 20_000

export type CreativeImportCategory = "image" | "document"

export function getCreativeImportCategory(file: File): CreativeImportCategory {
  const name = file.name.toLowerCase()
  if (
    file.type.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif)$/i.test(name)
  ) {
    return "image"
  }
  return "document"
}

export function isCreativeImportSupported(file: File): boolean {
  const category = getCreativeImportCategory(file)
  if (category === "image") return true

  const name = file.name.toLowerCase()
  return (
    file.type.startsWith("text/") ||
    file.type === "application/pdf" ||
    file.type.includes("word") ||
    file.type.includes("document") ||
    /\.(pdf|doc|docx|txt|rtf|md)$/i.test(name)
  )
}

function isPlainTextFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".rtf") ||
    name.endsWith(".md")
  )
}

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return file.type === "application/pdf" || name.endsWith(".pdf")
}

function isWordFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    file.type.includes("word") ||
    file.type.includes("document") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  )
}

export async function readCreativeTextFile(file: File): Promise<string | null> {
  if (!isPlainTextFile(file)) return null

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) || "")
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsText(file)
  })
}

export function truncateDocumentText(
  text: string,
  limit = CREATIVE_DOCUMENT_TEXT_LIMIT,
): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n\n[Document truncated — showing first ${limit.toLocaleString()} characters]`
}

export async function extractCreativeDocumentText(file: File): Promise<string | null> {
  if (isPlainTextFile(file)) {
    return readCreativeTextFile(file)
  }

  if (isPdfFile(file)) {
    const text = await extractPdfText(file)
    return text.trim() || null
  }

  if (isWordFile(file)) {
    const text = await extractWordText(file)
    return text.trim() || null
  }

  return null
}

export function requiresDocumentExtraction(file: File): boolean {
  return getCreativeImportCategory(file) === "document"
}
