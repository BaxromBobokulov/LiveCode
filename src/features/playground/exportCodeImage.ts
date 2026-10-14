import { highlightCode, tagHighlighter } from '@lezer/highlight'
import { cLanguage, dark, syntaxRules } from './codeMirrorTheme'

// Sizes match the editor (codeMirrorTheme.ts), so the image looks like the code on screen.
const FONT_SIZE = 13
const LINE_HEIGHT = 22
const CODE_GAP = 16 // space between the line numbers and the code, like the editor's line padding
const PADDING = 32 // empty dark border around everything, so nothing touches the edge
const MIN_WIDTH = 480 // a two-line program still gives a sensibly shaped image
const TAB = '    '

// Drawn at 2× so the text stays sharp when the image is opened at full size or zoomed in.
// Very long programs drop below 2× to stay inside what browsers allow for one canvas.
const SCALE = 2
const MAX_CANVAS_SIDE = 16384
const MAX_CANVAS_AREA = 16_000_000

type Token = { text: string; color: string; italic: boolean }

// The same tag → color rules the editor uses. Each rule's class is its index in syntaxRules.
const highlighter = tagHighlighter(syntaxRules.map((rule, index) => ({ tag: rule.tag, class: String(index) })))

/** Splits the code into lines of colored pieces, using the editor's own C parser and colors. */
function highlightLines(code: string): Token[][] {
  const lines: Token[][] = [[]]
  const tree = cLanguage.language.parser.parse(code)

  highlightCode(
    code,
    tree,
    highlighter,
    (text, classes) => {
      // No class means plain text (operators, punctuation). If several rules match, the later one
      // wins, the same as in the editor's stylesheet.
      const rule = classes ? syntaxRules[Math.max(...classes.split(' ').map(Number))] : undefined
      lines[lines.length - 1].push({
        text: text.replaceAll('\t', TAB),
        color: rule?.color ?? dark.text,
        italic: rule?.fontStyle === 'italic',
      })
    },
    () => lines.push([]),
  )
  return lines
}

/** e.g. codevision-code-2026-10-14_15-32-07.png */
function imageFileName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
  const time = `${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`
  return `codevision-code-${day}_${time}.png`
}

/**
 * Draws the whole program — every line, not only what is scrolled into view — onto a canvas in
 * the editor's dark colors, with line numbers, and downloads it as a PNG.
 */
export async function exportCodeImage(code: string): Promise<void> {
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim()
  const font = `${FONT_SIZE}px ${fontFamily}`
  // A canvas only draws with a font the page has already loaded.
  await document.fonts.load(font)

  const lines = highlightLines(code)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Measure first, so the image is exactly as wide as the longest line.
  ctx.font = font
  // Line numbers are right-aligned in a column as wide as the biggest one (at least two digits).
  const gutterWidth = ctx.measureText(String(Math.max(lines.length, 99))).width
  const longestLine = Math.max(...lines.map((line) => ctx.measureText(line.map((token) => token.text).join('')).width))
  const width = Math.ceil(Math.max(MIN_WIDTH, PADDING + gutterWidth + CODE_GAP + longestLine + PADDING))
  const height = PADDING + lines.length * LINE_HEIGHT + PADDING

  const scale = Math.min(SCALE, MAX_CANVAS_SIDE / Math.max(width, height), Math.sqrt(MAX_CANVAS_AREA / (width * height)))
  canvas.width = Math.floor(width * scale)
  canvas.height = Math.floor(height * scale)
  ctx.scale(scale, scale)

  ctx.fillStyle = dark.background
  ctx.fillRect(0, 0, width, height)
  ctx.textBaseline = 'middle'

  lines.forEach((line, index) => {
    const y = PADDING + index * LINE_HEIGHT + LINE_HEIGHT / 2

    ctx.font = font
    ctx.textAlign = 'right'
    ctx.fillStyle = dark.lineNumber
    ctx.fillText(String(index + 1), PADDING + gutterWidth, y)

    ctx.textAlign = 'left'
    let x = PADDING + gutterWidth + CODE_GAP
    for (const token of line) {
      ctx.font = token.italic ? `italic ${font}` : font
      ctx.fillStyle = token.color
      ctx.fillText(token.text, x, y)
      x += ctx.measureText(token.text).width
    }
  })

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = imageFileName(new Date())
  link.click()
  URL.revokeObjectURL(url)
}
