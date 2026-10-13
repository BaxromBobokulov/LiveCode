import { CodeError, UnsupportedConstructError, code } from './errors'

export type TokenKind = 'number' | 'string' | 'char' | 'identifier' | 'keyword' | 'punct' | 'eof'

export type Token = {
  kind: TokenKind
  /** The token as written. For strings, the text between the quotes with escapes decoded. */
  text: string
  /** For a char literal like 'A': its character code (65). */
  value?: number
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
      if (end === -1) throw new CodeError(line, 'codeError.unclosedComment')
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
          code(isInclude ? directive : directive.split(/\s+/)[0]),
          { key: isInclude ? 'unsupported.include' : 'unsupported.directive' },
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
        throw new CodeError(line, 'codeError.badNumber')
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
      const start = pos
      const value = readChar()
      tokens.push({ kind: 'char', text: source.slice(start, pos), value, line })
      continue
    }

    const punct = punctuators.find((p) => source.startsWith(p, pos))
    if (!punct) throw new CodeError(line, 'codeError.unexpectedChar', { char })
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
      text += source[pos] === '\\' ? readEscape(false) : source[pos++]
    }
    if (source[pos] !== '"') throw new CodeError(line, 'codeError.unclosedString')
    pos++ // closing quote
    return text
  }

  // Reads a 'A' character literal starting at `pos` and returns its character code.
  function readChar(): number {
    pos++ // opening quote
    let text = ''
    while (pos < source.length && source[pos] !== "'" && source[pos] !== '\n') {
      text += source[pos] === '\\' ? readEscape(true) : source[pos++]
    }
    // Exactly one character between the quotes: not '' or 'ab', and the closing ' is there.
    if (source[pos] !== "'" || text.length !== 1) throw new CodeError(line, 'codeError.badChar')
    pos++ // closing quote
    const code = text.charCodeAt(0)
    if (code > 127) throw new CodeError(line, 'codeError.nonAsciiChar', { char: text })
    return code
  }

  // Reads an escape like \n at `pos` and returns the character it stands for. \0 only works in a char literal.
  function readEscape(inChar: boolean): string {
    const escape = source[pos + 1]
    pos += 2
    if (escape === 'n') return '\n'
    if (escape === '"' || escape === "'" || escape === '\\') return escape
    if (escape === '0' && inChar) return '\0'
    const values = { escape: `\\${escape ?? ''}` }
    throw new UnsupportedConstructError(line, { key: 'construct.escape', values }, { key: 'unsupported.escape', values })
  }
}
