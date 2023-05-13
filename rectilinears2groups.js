// Group rectilinear lines that form a loop.

// A group may contain multiple loops. Lines that are not part of a loop are discarded.
// Lines are represented by objects with properties x, y (coordinates), w(idth) and h(eight).
// They are constrained to be rectilinear, i.e. horizontal or vertical.

// attributes
//  lines            properties are added to the provided lines
//  maxStrokeWidth   used to determine if horizontal or vertical
//  maxGapWidth      used to combine lines and allow near-intersections

// result
//   array of line arrays each representing a group

function intersects(line0, line1, maxGapWidth) {
  return (
    // line1 not above or below line0
    line1.y + line1.h + maxGapWidth >= line0.y
    &&
    line1.y <= line0.h + maxGapWidth + line0.y

    &&

    // line1 not right or left line0
    line1.x + line1.w + maxGapWidth >= line0.x
    &&
    line1.x <= line0.w + maxGapWidth + line0.x
  )
}

function markIntersection(vline, hline, maxGapWidth) {
  if (!intersects(vline, hline, maxGapWidth)) return

  let intersection = {
    x: vline.x,
    y: hline.y,
    lines: [vline, hline],
  }

  vline.intersections.push(intersection)
  hline.intersections.push(intersection)
}

// array ... sorted list
// direction ? y : x (needs to match first sort order)
function combineLines(lines, direction, maxGapWidth) {
  let countCombine = 0
  for (let i = 0; i < lines.length - 1; i++) {
    let l0 = lines[i]
    let del = false
    for (let j = i + 1; j < lines.length; j++) {
      let l1 = lines[j]

      // direction ? y : x is the first sorting direction
      // therefore everything after that is >= current and cannot intersect
      if (direction && l0.y + l0.h + maxGapWidth < l1.y) break
      if (!direction && l0.x + l0.w + maxGapWidth < l1.x) break
      if (!intersects(l0, l1, maxGapWidth)) continue

      countCombine++

      // extend l0 to cover both (might violate maxStrokeWidth)
      let xe = Math.max(l0.x + l0.w, l1.x + l1.w)
      let ye = Math.max(l0.y + l0.h, l1.y + l1.h)
      lines[i] = {
        x: Math.min(l0.x, l1.x),
        w: xe - l0.x,
        y: Math.min(l0.y, l1.y),
        h: ye - l0.y
      }
      lines[j] = null
      del = true
    }
    if (del) lines = lines.filter(v => v)
  }
  if (countCombine != 0) console.warn('combined', countCombine, 'lines')
  return lines
}

const ascYX = (l0, l1) => l0.y - l1.y || l0.x - l1.x
const ascXY = (l0, l1) => l0.x - l1.x || l0.y - l1.y

// remove intersections of non-closing lines
const dangling = line => line.intersections.length == 1
function delDangling(line) {
  if (!dangling(line)) return
  line.intersections.forEach(intersection => {
    intersection.lines.forEach(connected => {
      connected.intersections = connected.intersections.filter(i => i != intersection)
      delDangling(connected)
    })
  })
}

// assign to groups
// start with first line (arbitrary) and continue recursive until nothing is reachable
// then choose next line until no lines unassigned
function markGroup(line, group) {
  if (line.group) return false
  let intersections = line.intersections.filter(i => !i.group)

  // mark as part of group
  line.group = group
  intersections.forEach(i => i.group = group)

  // add references in group
  group.lines.push(line)
  group.intersections.push(...intersections)

  // continue recursive until nothing reachable
  intersections.forEach(intersection =>
    intersection.lines.forEach(line => markGroup(line, group))
  )
  return true
}

export default function rectilinears2groups(lines, maxStrokeWidth, maxGapWidth) {
  lines.forEach(line => {
    line.horizontal = line.h < maxStrokeWidth
    line.vertical = line.w < maxStrokeWidth
  })

  // not a line if one is bigger than max or both smaller than max (^ ... xor)
  lines = lines.filter(({ horizontal, vertical }) => horizontal ^ vertical)

  // only vertical and horizontal lines can intersect
  let hlines = lines.filter(({ horizontal }) => horizontal)
  let vlines = lines.filter(({ vertical }) => vertical)

  // optional: different line colors need to be merged to avoid duplicate intersections
  hlines.sort(ascYX)
  vlines.sort(ascXY)
  hlines = combineLines(hlines, true, maxGapWidth)
  vlines = combineLines(vlines, false, maxGapWidth)

  // find all intersections (only vertical and horizontal can intersect)
  // no duplicate intersection check because overlapping lines are not allowed
  vlines.forEach(vline => vline.intersections = [])
  hlines.forEach(hline => {
    hline.intersections = []
    vlines.forEach(vline => markIntersection(vline, hline, maxGapWidth))
  })

  // remove non-closing lines
  hlines.forEach(delDangling)
  vlines.forEach(delDangling)
  hlines = hlines.filter(line => line.intersections.length)
  vlines = vlines.filter(line => line.intersections.length)

  // separate lines by connectivity
  let groups = []
  vlines.forEach(line => {
    let group = {
      lines: [],
      intersections: [],
    }
    if (markGroup(line, group)) groups.push(group)
  })

  return groups
}