# pdf2tree
Parse PDF and group elements based on enclosing lines. A node.js module that promisifies the pdf2json parser and structures the data in a way that is suitable for tables with merged cells.

## How to use
After installing [node.js](https://nodejs.org) you can use npm to add pdf2tree in your project folder.

    npm install pdf2tree

When you create a new parser object as shown below, parameters are passed to the [pdf2json](https://github.com/modesty/pdf2json) parser.

    import PDF2Tree from 'pdf2tree'
    let pdf2tree = new PDF2Tree()

Then you can set the following pdf2tree specific parameters.

    pdf2tree.maxStrokeWidth = 1
    pdf2tree.maxGapWidth = 0.1

Finally, parsing can start either with a filepath or a buffer.

    pdf2tree.loadPDF(PDFpath)
    pdf2tree.parseBuffer(PDFbuffer)

The promise returns a JSON object as documented in [pdf2json](https://github.com/modesty/pdf2json), but adds an additional `Tree` property. To simplify readability `<str>` represents an object like the ones pdf2json provides for every Page but each object only contains all elements within the lines, i.e. `{ ..., Texts: [ { x, y, ..., R: [ { T: 'str', ... } ] } ], ... }`.

    {
      ...
      Tree: [
        [
          <Page 1>,
          [
            [ <A>, <B>, <C>, <D> ],
            [ <X>, <1>, <2>, <3> ],
            [ 
              <Y>,
              [
                [ <5>, <6>, <7> ],
                [ <8>, <9> ],
              ]
            ]
          ]
        ],
        [
          <Page 2>,
          [
            [ <TITLE> ],
            [
              <Z>, 
              [
                [
                  <F>,
                  <G>,
                  [
                    [ <H> ],
                    [ <I> ],
                  ],
                ],
                [ <J>],
                [ <K>]
              ],
              <?>
            ]
          ]
        ]
      ]
    }

For content structured like this:

    Page 1

    +---+---+---+---+
    | A | B | C | D |
    +---+---+---+---+
    | X | 1 | 2 | 3 |
    +---+---+---+---+
    |   | 5 | 6 | 7 |
    | Y +---+---+---+
    |   | 8 |   9   |
    +---+---+-------+

    Page 2
    
    +---+---+---+---+
    |     TITLE     |
    +---+---+---+---+
    |   |   |   | H |
    |   | F | G +---+
    |   |   |   | I |
    | Z +---+---+---+
    |   | J |       |
    |   +---+   ?   |
    |   | K |       |
    +---+---+-------+

If a cell is not rectangular or merges rows that the cell to the left did not also merge are not supported. This would require a data structure that allows traversing the neighborhood with `.right` or `.below` and can include loops for non-rectangular areas. It should be easier to fix those special cases after the parsing.