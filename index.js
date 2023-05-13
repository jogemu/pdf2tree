import PDFParser from 'pdf2json'
import rectilinears2groups from './rectilinears2groups.js'
import SeparatorHierarchy from './separators2hierarchy.js'

// sets the box x, y, w(idth) and h(eight)
// requires a box property with xe(nd) already set
// the width is set so that it does not overlap with the nodes to the right
function rowBox(node) {
  let [l0, l1] = [node.from, node.to]
  let box = node.box
  box.ye = Math.max(l0.y + l0.h, l1.y + l1.h)

  box.x = Math.max(l0.x, l1.x)
  box.y = Math.min(l0.y, l1.y)

  box.w = (node.nodes[0]?.box?.x || box.xe) - box.x
  box.h = box.ye - box.y
}

// the existing row box is split into columns
function columnBoxes(node) {
  let [l0, l1] = [node.from, node.to]
  let box = node.box

  let intersections = l0.intersections.filter(({ lines }) =>
    lines[0].intersections.some(({ lines }) => lines[1] == l1)
  ).filter(({ x }) => box.x < x && x <= box.x + box.w)

  let xs = intersections.map(({ x }) => x)
  box.xu = xs.at(-1)
  xs = xs.map((x, i) => [i == 0 ? box.x : xs[i - 1], x])

  node.boxes = xs.map(([x, xe]) => Object.assign({}, box, {
    x: x,
    w: xe - x
  }))
}

// If a the most right cell does not go to the end all cells that
// share that gap will have the same boxes2 object.
// This means if a text is added to one rows cell it will be added
// to all that share a gap (starts and ends with a line that goes until end)
let boxes2 = null
function columnAfterSplit(node) {
  node.box2 = null
  // only leaf nodes relevant
  if (node.nodes.length) return

  let [l0, l1] = [node.from, node.to]
  let box = node.box

  if (box.xu < box.xe) {

    let l0end = l0.intersections.at(-1)
    let l1end = l1.intersections.at(-1)

    if (l0end.x == box.xe) {
      boxes2 = {
        from: l0,
        box: {
          x: box.xu,
          y: l0end.y,
          w: l0end.x - box.xu
        },
      }
    }

    if (l1end.x == box.xe) {
      boxes2.to = l1
      boxes2.box.h = l1end.y - boxes2.box.y
    }

    node.box2 = boxes2
  }
}

// Like columnBoxes but for boxes2
function columnBoxes2(node) {
  node.boxes2 = []
  if (!node.box2) return
  let [l0, l1] = [node.box2.from, node.box2.to]
  let box = node.box2.box

  let intersections = l0.intersections.filter(({ lines }) =>
    lines[0].intersections.some(({ lines }) => lines[1] == l1)
  ).filter(({ x }) => box.x < x && x <= box.x + box.w)

  let xs = intersections.map(({ x }) => x)
  xs = xs.map((x, i) => [i == 0 ? box.x : xs[i - 1], x])

  node.boxes2 = xs.map(([x, xe]) => Object.assign({}, box, {
    x: x,
    w: xe - x
  }))
}

const ascYX = (l0, l1) => l0.y - l1.y || l0.x - l1.x

// Assumes that a cell to the left that is merged has all values
// to its right associated with it.
function rowHierarchy(group) {
  let lines = group.lines.filter(({ horizontal }) => horizontal).sort(ascYX)
  // NOTE an interrupted horizontal is problematic

  let ix = v => v.intersections[0].x
  let ordinate = (value, ref) => ix(value) - ix(ref)
  let hierarchy = new SeparatorHierarchy(ordinate)
  hierarchy.addSepartors(lines)

  hierarchy.from = hierarchy.nodes[0].from
  hierarchy.to = hierarchy.nodes.at(-1).to

  return hierarchy
}

function buildHierarchy(group) {
  let hierarchy = rowHierarchy(group)

  let xe = hierarchy.from.intersections.at(-1).x
  hierarchy.traverseUp(node => node.box = { xe })

  // PROPOSED support column hierarchy in later version
  hierarchy.traverseUp(rowBox)
  hierarchy.traverseUp(columnBoxes)
  hierarchy.traverseUp(columnAfterSplit)
  hierarchy.traverseUp(columnBoxes2)

  return hierarchy
}

// overlapping is not possible because there would be intersections
// moving by the space width of the font because text anchor might be outside area
function inside(box0, box1) {
  return (
    box0.x + (box0.sw || 0) >= box1.x
    &&
    box0.x + (box0.sw || 0) <= box1.xe

    &&

    box0.y + (box0.sw || 0) * 2 >= box1.y
    &&
    box0.y + (box0.sw || 0) * 2 <= box1.ye
  )
}

// by checking the width instead you get the are this hierachy is responsible for
function responsible(box0, box1) {
  return (
    box0.x + (box0.sw || 0) >= box1.x
    &&
    box0.x + (box0.sw || 0) <= box1.x + box1.w

    &&

    box0.y + (box0.sw || 0) * 2 >= box1.y
    &&
    box0.y + (box0.sw || 0) * 2 <= box1.y + box1.h
  )
}

function asNested(hierarchies) {
  hierarchies.forEach(hierarchy => {
    hierarchy.parents = []
    hierarchy.nesteds = []
  })

  hierarchies.forEach((h0, i) => {
    hierarchies.forEach((h1, j) => {
      if (i == j) return
      if (!inside(h1.box, h0.box)) return
      h1.parents.push(h0)
      h0.nesteds.push(h1)
    })
  })

  // to not include the nested elements of nested elements
  // filters copies that are replace original array

  hierarchies.forEach(hierarchy => {
    hierarchy.parents2 = hierarchy.parents.slice()
    hierarchy.nesteds2 = hierarchy.nesteds.slice()
    hierarchy.parents.forEach(parent => {
      hierarchy.parents2 = hierarchy.parents2.filter(p => !parent.parents.includes(p))
    })
    hierarchy.nesteds.forEach(nested => {
      hierarchy.nesteds2 = hierarchy.nesteds2.filter(n => !nested.nesteds.includes(n))
    })
  })

  hierarchies.forEach(hierarchy => {
    hierarchy.parents = hierarchy.parents2
    hierarchy.nesteds = hierarchy.nesteds2
    delete hierarchy.parents2
    delete hierarchy.nesteds2
  })

  return hierarchies.filter(hierarchy => hierarchy.parents.length == 0)
}

function data2hierarchy(hierarchie, element, key) {
  if (!inside(element, hierarchie.box)) return false

  // check if some nested hierarchie is willing to take it
  if (hierarchie.nesteds?.some(h => data2hierarchy(h, element, key))) return true

  // check if some node is willing to take it
  if (hierarchie.nodes.some(h => data2hierarchy(h, element, key))) return true

  // apparently hierarchie has to do it itself

  if (hierarchie.boxes2.some(box => {
    if (!responsible(element, box)) return false
    box.data[key].push(element)
    return true
  })) return true

  return hierarchie.boxes.some(box => {
    if (!responsible(element, box)) return false
    box.data[key].push(element)
    return true
  })
}

function insertData(hierarchies, outside, elements, key) {
  elements.forEach(element => {
    if (hierarchies.some(hierarchy => data2hierarchy(hierarchy, element, key))) return
    outside[key].push(element)
  })
}

function splitArray(array, filterFn) {
  let result = [[], []]
  array.forEach(value => result[filterFn(value) ? 1 : 0].push(value))
  return result
}

function toArray(hierachy) {
  return hierachy.toArray(h => h.boxes.map(box => box.data), h => h.boxes2.map(box => box.data))[0]
}

const buildTree = pdf2tree => json => new Promise((resolve, reject) => {
  let { maxStrokeWidth, maxGapWidth } = pdf2tree
  if (maxStrokeWidth < 0 || maxGapWidth < 0) reject('max widths cannot be negative')
  // let {Transcoder, Meta, Pages} = json

  json.Hierarchy = []
  json.Tree = json.Pages.map((page, index) => {
    // let {Width, Height, HLines, VLines, Fills, Texts, Fields, Boxsets} = page

    let { Fills } = page
    if (Fills.some(({ clr, oc }) => clr === 1 || oc === '#ffffff')) console.warn('invisible fill')
    let groups = rectilinears2groups(Fills, maxStrokeWidth, maxGapWidth)

    let hierarchies = null
    try {
      hierarchies = groups.map(buildHierarchy)
    } catch {
      console.warn('page', index, 'failed')
      json.Hierarchy.push([])
      return []
    }

    let pageProperties = ['Texts'] // PROPOSED add 'Fields' if compatible

    let dataCollector = () => Object.fromEntries(pageProperties.map(property =>
      [property, []]
    ))

    hierarchies.forEach(hierarchie =>
      hierarchie.traverseUp(({ boxes, boxes2 }) => {
        boxes.forEach(box => box.data = dataCollector())
        boxes2.forEach(box => box.data = dataCollector())
      })
    )

    json.Hierarchy.push(hierarchies)

    let topLevelHierarchies = asNested(hierarchies)

    let outside = dataCollector()

    pageProperties.forEach(property => insertData(
      topLevelHierarchies,
      outside,
      page[property].slice(), //.sort(ascYX),
      property
    ))

    // move nested to boxes2 of correct row
    hierarchies.forEach(hierarchy => {
      hierarchy.nesteds.forEach(nested => {
        hierarchy.nodes.some(node => {
          if (inside(nested.box, node.box)) {
            node.boxes2.push({
              data: toArray(nested)
            })
            return true
          }
          return false
        })
      })
    })

    let result = topLevelHierarchies.map(hierarchy => Object.fromEntries(
      pageProperties.map(property => {
        let [before, after] = splitArray(outside[property], element =>
          element.y > hierarchy.box.y + hierarchy.box.h
          ||
          (element.y > hierarchy.box.y && element.x < hierarchy.box.x)
        )
        outside[property] = after
        return [property, before]
      })
    ))

    result.push(outside)

    topLevelHierarchies.forEach((hierarchy, index) => {
      result.splice(index * 2 + 1, 0, toArray(hierarchy))
    })

    return result.filter(v => v.length || Object.values(v).some(a => a.length))
  })

  resolve(json)
})


export default class PDF2Tree {
  constructor(...args) {
    this.parser = new PDFParser(...args)
    this.maxStrokeWidth = 1
    this.maxGapWidth = 0.1
  }

  loadPDF(path) {
    return new Promise((resolve, reject) => {
      this.parser.on('pdfParser_dataError', reject)
      this.parser.on('pdfParser_dataReady', resolve)

      this.parser.loadPDF(path)
    }).then(buildTree(this))
  }

  parseBuffer(buffer) {
    return new Promise((resolve, reject) => {
      this.parser.on('pdfParser_dataError', reject)
      this.parser.on('pdfParser_dataReady', resolve)

      this.parser.parseBuffer(buffer)
    }).then(buildTree(this))
  }
}
