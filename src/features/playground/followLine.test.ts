import { describe, expect, it } from 'vitest'
import { changeScrollTarget, isLineOnScreen, isNearFollowed, lineFollowTarget, spanToShow } from './followLine'

const page = { scrollY: 100, viewHeight: 600, minY: 90, maxY: 500 }

describe('isLineOnScreen', () => {
  const screen = { scrollY: 100, viewHeight: 600 }

  it('counts a line touching either edge as on screen', () => {
    expect(isLineOnScreen({ ...screen, lineTop: 100, lineBottom: 122 })).toBe(true)
    expect(isLineOnScreen({ ...screen, lineTop: 678, lineBottom: 700 })).toBe(true)
  })

  it('counts a line cut off by an edge as off screen', () => {
    expect(isLineOnScreen({ ...screen, lineTop: 90, lineBottom: 112 })).toBe(false)
    expect(isLineOnScreen({ ...screen, lineTop: 690, lineBottom: 712 })).toBe(false)
  })
})

describe('spanToShow', () => {
  const variable = { top: 10, bottom: 60 }
  const cell = { top: 300, bottom: 350 }

  it('shows everything that fits', () => {
    expect(spanToShow([variable, cell], 400)).toEqual({ top: 10, bottom: 350 })
  })

  it('drops from the front when it does not all fit, keeping the array cells', () => {
    expect(spanToShow([variable, cell], 200)).toEqual(cell)
  })

  it('keeps two neighbouring cells together when only they fit', () => {
    expect(spanToShow([variable, cell, { top: 300, bottom: 350 }], 200)).toEqual(cell)
  })
})

describe('changeScrollTarget', () => {
  const view = { top: 100, bottom: 300 }

  it('moves nothing while the change can be seen', () => {
    expect(changeScrollTarget({ top: 100, bottom: 150 }, view, 100, 500)).toBeNull()
  })

  it('moves as little as possible, with a margin, for a change below', () => {
    expect(changeScrollTarget({ top: 310, bottom: 360 }, view, 100, 500)).toBe(172)
  })

  it('moves as little as possible, with a margin, for a change above', () => {
    expect(changeScrollTarget({ top: 40, bottom: 90 }, view, 100, 500)).toBe(28)
  })

  it('shows the top of something taller than the view', () => {
    expect(changeScrollTarget({ top: 310, bottom: 600 }, view, 100, 500)).toBe(298)
  })

  it('stays within what the area can scroll', () => {
    expect(changeScrollTarget({ top: 310, bottom: 360 }, view, 100, 150)).toBe(150)
    expect(changeScrollTarget({ top: 310, bottom: 360 }, view, 150, 150)).toBeNull()
  })
})

describe('isNearFollowed', () => {
  it('still counts a small nudge as being there', () => {
    expect(isNearFollowed(120, 100, 500)).toBe(true)
  })

  it('counts anything further as having scrolled away, in either direction', () => {
    expect(isNearFollowed(165, 89, 500)).toBe(false)
    expect(isNearFollowed(0, 89, 500)).toBe(false)
  })

  it('counts moving to the very end as scrolling away, however short the way', () => {
    expect(isNearFollowed(165, 150, 165)).toBe(false)
  })

  it('stays near when following itself left the area at the very end', () => {
    expect(isNearFollowed(165, 165, 165)).toBe(true)
  })

  it('takes a student back when they really return', () => {
    expect(isNearFollowed(125, 120, 300)).toBe(true)
  })
})

describe('lineFollowTarget', () => {
  it('leaves the page alone while the line is fully on screen', () => {
    expect(lineFollowTarget({ ...page, lineTop: 100, lineBottom: 122 })).toBeNull()
    expect(lineFollowTarget({ ...page, lineTop: 678, lineBottom: 700 })).toBeNull()
  })

  it('brings a line below the screen to the middle', () => {
    expect(lineFollowTarget({ ...page, lineTop: 739, lineBottom: 761 })).toBe(450)
  })

  it('treats a line that is cut off by the edge of the screen as off screen', () => {
    expect(lineFollowTarget({ ...page, lineTop: 690, lineBottom: 712 })).toBe(401)
  })

  it('never scrolls above minY, so the stuck Execution panel stays put', () => {
    expect(lineFollowTarget({ ...page, scrollY: 300, lineTop: 200, lineBottom: 222 })).toBe(90)
  })

  it('stops at the end of the page', () => {
    expect(lineFollowTarget({ ...page, lineTop: 1400, lineBottom: 1422 })).toBe(500)
  })

  it('prefers the end of the page when the page is too short to reach minY', () => {
    expect(lineFollowTarget({ ...page, scrollY: 50, viewHeight: 600, minY: 90, maxY: 60, lineTop: 700, lineBottom: 722 })).toBe(60)
  })
})
