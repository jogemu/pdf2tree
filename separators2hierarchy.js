// Reconstructs hierarchy based on separators between the levels of the hierarchy.

// Every separator needs to be closed at some point.
// The higher hierarchies are basically just the sum of all below it.

// ordinate is a function that answers if the first parameter is of
// <0 higher hierarchy,
// =0 equal hierarchy or
// >0 lower hierarchy
// than the second parameter

class Node {
  constructor(from, ordinate) {
    this.nodes = []
    this.from = from
    this.to = null
    this.target = null
    this.ordinate = ordinate
  }

  push(separtor) {
    // delegate separtor to last subordinate node (target)
    if (this.target?.push(separtor)) return true

    // target is unqualified -> already finished itself and ready for push
    if (this.target) this.nodes.push(this.target)

    if (this.ordinate(separtor, this.from) <= 0) {
      // above or equal node's hierarchy -> escalate to higher node
      this.to = separtor
      return false
    }

    if (this.target && this.ordinate(separtor, this.target.from) < 0) {
      // only above target's hierarchy -> move all nodes to new target 
      let target = new Node(this.from, this.ordinate)
      target.to = separtor
      target.nodes = this.nodes
      this.nodes = [target]
    }

    if (!this.target) {
      // first node could have second separtor with lower hierarchy
      // setting to directly avoids infinite loop
      let node = new Node(this.from, this.ordinate)
      node.to = separtor
      this.nodes.push(node)
    }

    // same hierarchy as target (target is already part of nodes)
    let target = new Node(separtor, this.ordinate)
    this.target = target
    return true
  }

  log(pad) {
    console.log(pad, this.from, this.to)
    this.nodes.forEach(node => node.log(pad + '  '))
  }

  // traverse up from leaf nodes
  traverseUp(fn) {
    this.nodes.forEach(node => node.traverseUp(fn))
    fn(this)
  }

  toArray(fn0, fn1) {
    if (this.nodes.length) return [
      ...fn0(this),
      this.nodes.map(node => node.toArray(fn0, fn1)),
      ...fn1(this),
    ]
    return [...fn0(this)]
  }
}

export default class SepartorHierarchy {
  constructor(ordinate) {
    this.nodes = []
    this.target = null
    this.ordinate = ordinate
  }

  push(separtor) {
    // last added node feels responsible?
    if (this.target?.push(separtor)) return true

    // apparently not -> save the node's progress
    if (this.target) this.nodes.push(this.target)

    // make a new node responsible
    this.target = new Node(separtor, this.ordinate)
  }

  // pushes each element of the provided array one by one
  addSepartors(separtors) {
    separtors.forEach(separtor => this.push(separtor))
  }

  log() {
    console.log('separators2hierarchy')
    this.nodes.forEach(node => node.log('  '))
  }

  // calls function for every node
  // starting at the leaf nodes and ending at the root node
  traverseUp(fn) {
    this.nodes.forEach(node => node.traverseUp(fn))
    fn(this)
  }

  toArray(fn0, fn1) {
    if (this.nodes.length) return [
      ...fn0(this),
      this.nodes.map(node => node.toArray(fn0, fn1)),
      ...fn1(this),
    ]
    return [...fn0(this)]
  }
}