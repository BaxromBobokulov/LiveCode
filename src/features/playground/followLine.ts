type LineOnPage = {
  /** The line's top and bottom edges, measured from the top of the page. */
  lineTop: number
  lineBottom: number
  scrollY: number
  viewHeight: number
}

type FollowInput = LineOnPage & {
  /** The page scroll limits: `minY` keeps the Execution panel stuck, so its Next button doesn't move. */
  minY: number
  maxY: number
}

export function isLineOnScreen({ lineTop, lineBottom, scrollY, viewHeight }: LineOnPage): boolean {
  return lineTop >= scrollY && lineBottom <= scrollY + viewHeight
}

/**
 * Where to scroll the page so the current code line can be seen: to the middle of the screen, which
 * leaves room for the next few steps. Null when the line is already fully on screen, so a step that
 * stays on screen never moves the page.
 */
export function lineFollowTarget({ minY, maxY, ...line }: FollowInput): number | null {
  if (isLineOnScreen(line)) return null
  const centered = (line.lineTop + line.lineBottom - line.viewHeight) / 2
  return Math.max(0, Math.min(Math.max(centered, minY), maxY))
}

/** A stretch of the scrolling part of the Execution panel, measured from the top of its content. */
export type Span = { top: number; bottom: number }

/** Room left around a changed item, so its heading or index label shows too. */
const CHANGE_MARGIN = 12

/** How far a student can nudge the area before that counts as scrolling away, about one line of text. */
const NEAR_FOLLOWED = 24

/**
 * Whether the student is still where following left the area (`followedTop`), give or take a nudge.
 * Anywhere else, they have scrolled away to read something. This compares positions, not "can the last
 * change still be seen": from the Console at the bottom, the array above it can often still be seen.
 * Moving to the very end always counts as scrolling away, however short the way: that is the Console.
 */
export function isNearFollowed(scrollTop: number, followedTop: number, maxScrollTop: number): boolean {
  const moved = Math.abs(scrollTop - followedTop)
  if (moved <= 1) return true
  return moved <= NEAR_FOLLOWED && scrollTop < maxScrollTop - 1
}

/**
 * What of this step's changed items to bring into view: all of them, or when they can't all fit in
 * `viewHeight`, as many as fit from the last one back. The array's cells come last, and they also
 * show a value that changed in the Variables box above them.
 */
export function spanToShow(items: Span[], viewHeight: number): Span {
  const bottom = Math.max(...items.map((item) => item.bottom))
  let top = Math.min(...items.map((item) => item.top))
  for (const item of items.slice(1)) {
    if (bottom - top + 2 * CHANGE_MARGIN <= viewHeight) break
    top = item.top
  }
  return { top, bottom }
}

/**
 * The scrollTop that brings `span` into `view`, moving as little as possible, or null when it can
 * already be seen, so a step whose change is on screen never moves anything.
 */
export function changeScrollTarget(span: Span, view: Span, scrollTop: number, maxScrollTop: number): number | null {
  if (span.top >= view.top && span.bottom <= view.bottom) return null
  const tooTall = span.bottom - span.top + 2 * CHANGE_MARGIN > view.bottom - view.top
  const moveUp = span.top - CHANGE_MARGIN < view.top
  const target =
    tooTall || moveUp
      ? scrollTop + span.top - CHANGE_MARGIN - view.top
      : scrollTop + span.bottom + CHANGE_MARGIN - view.bottom
  const clamped = Math.max(0, Math.min(target, maxScrollTop))
  return Math.abs(clamped - scrollTop) < 1 ? null : clamped
}
