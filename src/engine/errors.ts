// Errors the engine reports back to the Playground instead of crashing.
// Both carry the 1-based source line so the UI can point at it.

/** Valid C that uses something this version can't run yet, e.g. a pointer or a struct. */
export class UnsupportedConstructError extends Error {
  readonly line: number
  /** Short name of the feature, e.g. "pointer" or "switch statement". */
  readonly construct: string

  constructor(line: number, construct: string, message: string) {
    super(message)
    this.name = 'UnsupportedConstructError'
    this.line = line
    this.construct = construct
  }
}

/** A mistake in the program itself, e.g. a missing semicolon or a division by zero. */
export class CodeError extends Error {
  readonly line: number

  constructor(line: number, message: string) {
    super(message)
    this.name = 'CodeError'
    this.line = line
  }
}

export type RunError = UnsupportedConstructError | CodeError
