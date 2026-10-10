import { CodeError, UnsupportedConstructError } from './errors'

export type TokenKind = 'number' | 'string' | 'char' | 'identifier' | 'keyword' | 'punct' | 'eof'

export type Token = {
  kind: TokenKind
  /** The token as written. For strings, the text between the quotes with escapes decoded. */
  text: string
  /** 1-based source line. */
  line: number
}

// Every C keyword, so `double` or `struct` is recognised and the parser can say it isn't supported.
const keywords = new Set([
  'int', 'float', 'void', 'if', 'else', 'for', 'while', 'return',
  'char', 'double', 'long', 'short', 'unsigned', 'signed', 'struct', 'union', 'enum',
  'typedef', 'do', 'switch', 'case', 'default', 'break', 'continue', 'goto', 'sizeof',
  'const', 'static', 'extern', 'volatile', 'register', 'auto',
])

// Longest first, so "<=" is matched before "<".
const punctuators = [
  '<<=', '>>=',
  '->', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '==', '!=', '<=', '>=', '&&', '||', '<<', '>>',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '?', ':',
  '(', ')', '{', '}', '[', ']', ';', ',', '.',
]

/** Splits C source into tokens. Comments and `#include <stdio.h>` are skipped. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1
  // True until something other than spaces appears on the current line (for `#` directives).
  let atLineStart = true

  while (pos < source.length) {
    const char = source[pos]

    if (char === '\n') {
      line++
      pos++
      atLineStart = true
      continue
    }
    if (/\s/.test(char)) {
      pos++
      continue
    }

    // Comments
    if (source.startsWith('//', pos)) {
      while (pos < source.length && source[pos] !== '\n') pos++
      continue
    }
    if (source.startsWith('/*', pos)) {
      const end = source.indexOf('*/', pos + 2)
      if (end === -1) throw new CodeError(line, 'This comment is never closed. Add */ to end it.')
      for (const c of source.slice(pos, end)) if (c === '\n') line++
      pos = end + 2
      continue
    }

    // Preprocessor lines: only `#include <stdio.h>` is allowed, and it is ignored.
    if (char === '#' && atLineStart) {
      let end = source.indexOf('\n', pos)
      if (end === -1) end = source.length
      const directive = source.slice(pos, end).trim()
      if (!/^#\s*include\s*<stdio\.h>$/.test(directive)) {
        const isInclude = /^#\s*include/.test(directive)
        throw new UnsupportedConstructError(
          line,
          isInclude ? directive : directive.split(/\s+/)[0],
          isInclude
            ? 'Only #include <stdio.h> is supported. Other libraries are not available yet.'
            : 'Preprocessor directives like #define are not supported yet.',
        )
      }
      pos = end
      continue
    }

    atLineStart = false

    // Numbers: 42, 3.14, .5, 2e3, 1.5f
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[pos + 1] ?? ''))) {
      const match = /^(\d*\.?\d*(?:[eE][+-]?\d+)?)[fF]?/.exec(source.slice(pos))
      const text = match ? match[0] : char
      if (/[A-Za-z_0-9]/.test(source[pos + text.length] ?? '')) {
        throw new CodeError(line, 'This number is not written correctly. Only plain decimal numbers are supported.')
      }
      tokens.push({ kind: 'number', text, line })
      pos += text.length
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      const text = /^[A-Za-z_]\w*/.exec(source.slice(pos))![0]
      tokens.push({ kind: keywords.has(text) ? 'keyword' : 'identifier', text, line })
      pos += text.length
      continue
    }

    if (char === '"') {
      tokens.push({ kind: 'string', text: readString(), line })
      continue
    }

    if (char === "'") {
      const end = source.indexOf("'", pos + 1)
      const text = source.slice(pos, end === -1 ? pos + 1 : end + 1)
      tokens.push({ kind: 'char', text, line })
      pos += text.length
      continue
    }

    const punct = punctuators.find((p) => source.startsWith(p, pos))
    if (!punct) throw new CodeError(line, `Unexpected character "${char}".`)
    tokens.push({ kind: 'punct', text: punct, line })
    pos += punct.length
  }

  tokens.push({ kind: 'eof', text: 'end of file', line })
  return tokens

  // Reads a "..." string literal starting at `pos` and returns its decoded text.
  function readString(): string {
    let text = ''
    pos++ // opening quote
    while (pos < source.length && source[pos] !== '"') {
      if (source[pos] === '\n') break
      if (source[pos] === '\\') {
        const escape = source[pos + 1]
        if (escape === 'n') text += '\n'
        else if (escape === '"' || escape === '\\') text += escape
        else {
          throw new UnsupportedConstructError(
            line,
            `\\${escape ?? ''} escape`,
            `The escape \\${escape ?? ''} is not supported yet. Only \\n works in strings.`,
          )
        }
        pos += 2
        continue
      }
      text += source[pos]
      pos++
    }
    if (source[pos] !== '"') throw new CodeError(line, 'This string is never closed. Add a " to end it.')
    pos++ // closing quote
    return text
  }
}
