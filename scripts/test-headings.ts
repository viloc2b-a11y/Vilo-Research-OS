import * as fs from 'fs'
import * as path from 'path'

const HEADING_RE = /^((\d+(\.\d+)*)|appendix\s+[a-z0-9]+)?\s*([A-Z][^\n]{3,120})\s*$/gim

const file = 'fixtures/protocol-intake/demo-vaccine-protocol.txt'
const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n')

for (const match of text.matchAll(HEADING_RE)) {
  console.log('Heading:', match[4])
}
