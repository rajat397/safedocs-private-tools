export interface PDFHeader {
  version: string;
  offset: number;
}

export interface HeaderValidationResult {
  valid: boolean;
  version: string | null;
  issues: string[];
}

export interface XRefEntry {
  offset: number;
  generation: number;
  inUse: boolean;
}

export interface PDFTrailer {
  Size?: number;
  Root?: { objNum: number; genNum: number };
  Info?: { objNum: number; genNum: number };
  ID?: [Uint8Array, Uint8Array];
  Prev?: number;
  XRefStm?: number;
  [key: string]: any;
}

export interface PDFObject {
  objNum: number;
  genNum: number;
  data: Uint8Array;
  parsed: any;
}

export interface ParsedPDF {
  header: PDFHeader;
  version: string;
  xrefOffset: number;
  trailer: PDFTrailer;
  objects: Map<number, PDFObject>;
}

export interface PageInfo {
  objNum: number;
  mediaBox: number[];
  resources: any;
  contents: any;
}

export interface RecoveredPages {
  pages: PageInfo[];
  orphans: number[];
}

function readBytes(bytes: Uint8Array, offset: number, length: number): Uint8Array {
  return bytes.slice(offset, offset + length);
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function findLastIndex(bytes: Uint8Array, pattern: Uint8Array, startOffset: number): number {
  const patternStr = bytesToString(pattern);
  const dataStr = bytesToString(bytes.slice(0, startOffset + 1));
  return dataStr.lastIndexOf(patternStr);
}

export function detectHeaderOffset(bytes: Uint8Array): number {
  const searchLimit = Math.min(bytes.length, 1024);
  const data = bytesToString(bytes.slice(0, searchLimit));
  const match = data.match(/%PDF-(\d+\.\d+)/);
  return match ? match.index! : -1;
}

export function validateHeader(header: string): HeaderValidationResult {
  const issues: string[] = [];
  const match = header.match(/^%PDF-(\d+\.\d+)/);
  
  if (!match) {
    return { valid: false, version: null, issues: ['Missing or invalid PDF header signature'] };
  }
  
  const version = match[1];
  const [major, minor] = version.split('.').map(Number);
  
  if (major !== 1) {
    issues.push(`Unknown PDF major version ${major}, expected 1`);
  }
  
  if (minor < 0 || minor > 7) {
    issues.push(`Unusual PDF minor version ${minor}, expected 0-7`);
  }
  
  const knownVersions = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7'];
  if (!knownVersions.includes(version)) {
    issues.push(`Non-standard PDF version ${version}`);
  }
  
  return {
    valid: issues.length === 0 || issues.every(i => i.startsWith('Non-standard') || i.startsWith('Unusual')),
    version,
    issues
  };
}

function skipWhitespace(bytes: Uint8Array, offset: number): number {
  while (offset < bytes.length) {
    const c = bytes[offset];
    if (c !== 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0C && c !== 0x0D && c !== 0x00) {
      break;
    }
    offset++;
  }
  return offset;
}

function readNumber(bytes: Uint8Array, offset: number): { value: number; offset: number } {
  offset = skipWhitespace(bytes, offset);
  let negative = false;
  if (bytes[offset] === 0x2D) {
    negative = true;
    offset++;
  }
  let value = 0;
  while (offset < bytes.length) {
    const c = bytes[offset];
    if (c >= 0x30 && c <= 0x39) {
      value = value * 10 + (c - 0x30);
      offset++;
    } else {
      break;
    }
  }
  return { value: negative ? -value : value, offset };
}

function readToken(bytes: Uint8Array, offset: number): { token: string; offset: number } {
  offset = skipWhitespace(bytes, offset);
  if (offset >= bytes.length) return { token: '', offset };
  
  const c = bytes[offset];
  if (c === 0x2F) {
    offset++;
    let token = '/';
    while (offset < bytes.length) {
      const cc = bytes[offset];
      if ((cc >= 0x21 && cc <= 0x7E) && cc !== 0x28 && cc !== 0x29 && cc !== 0x3C && cc !== 0x3E && cc !== 0x5B && cc !== 0x5D && cc !== 0x7B && cc !== 0x7D && cc !== 0x2F && cc !== 0x23) {
        token += String.fromCharCode(cc);
        offset++;
      } else {
        break;
      }
    }
    return { token, offset };
  }
  
  if (c === 0x28) {
    offset++;
    let depth = 1;
    let token = '(';
    while (offset < bytes.length && depth > 0) {
      const cc = bytes[offset];
      token += String.fromCharCode(cc);
      if (cc === 0x5C) {
        offset++;
        if (offset < bytes.length) {
          token += String.fromCharCode(bytes[offset]);
        }
      } else if (cc === 0x28) {
        depth++;
      } else if (cc === 0x29) {
        depth--;
      }
      offset++;
    }
    return { token, offset };
  }
  
  if (c === 0x3C && bytes[offset + 1] === 0x3C) {
    offset += 2;
    let token = '<<';
    while (offset < bytes.length) {
      const cc = bytes[offset];
      token += String.fromCharCode(cc);
      if (cc === 0x3E && bytes[offset + 1] === 0x3E) {
        token += '>';
        offset += 2;
        break;
      }
      offset++;
    }
    return { token, offset };
  }
  
  if (c === 0x5B) {
    offset++;
    let token = '[';
    let depth = 1;
    while (offset < bytes.length && depth > 0) {
      const cc = bytes[offset];
      token += String.fromCharCode(cc);
      if (cc === 0x5B) depth++;
      else if (cc === 0x5D) depth--;
      offset++;
    }
    return { token, offset };
  }
  
  let token = '';
  while (offset < bytes.length) {
    const cc = bytes[offset];
    if (cc === 0x20 || cc === 0x09 || cc === 0x0A || cc === 0x0C || cc === 0x0D || cc === 0x00 ||
        cc === 0x28 || cc === 0x29 || cc === 0x3C || cc === 0x3E || cc === 0x5B || cc === 0x5D || cc === 0x7B || cc === 0x7D || cc === 0x2F || cc === 0x23) {
      break;
    }
    token += String.fromCharCode(cc);
    offset++;
  }
  return { token, offset };
}

function parseObject(bytes: Uint8Array, offset: number): { obj: any; offset: number } {
  offset = skipWhitespace(bytes, offset);
  const { token, offset: newOffset } = readToken(bytes, offset);
  offset = newOffset;
  
  if (token.startsWith('/')) {
    return { obj: { type: 'name', value: token.substring(1) }, offset };
  }
  
  if (token.startsWith('(') && token.endsWith(')')) {
    return { obj: { type: 'string', value: token.slice(1, -1) }, offset };
  }
  
  if (token === 'true' || token === 'false') {
    return { obj: { type: 'boolean', value: token === 'true' }, offset };
  }
  
  if (token === 'null') {
    return { obj: { type: 'null' }, offset };
  }
  
  if (token === '<<') {
    const dict: Record<string, any> = {};
    while (true) {
      offset = skipWhitespace(bytes, offset);
      if (offset >= bytes.length) break;
      if (bytes[offset] === 0x3E && bytes[offset + 1] === 0x3E) {
        offset += 2;
        break;
      }
      const { token: keyToken, offset: keyOffset } = readToken(bytes, offset);
      if (!keyToken.startsWith('/')) break;
      offset = keyOffset;
      const { obj: value, offset: valueOffset } = parseObject(bytes, offset);
      offset = valueOffset;
      dict[keyToken.substring(1)] = value;
    }
    return { obj: { type: 'dict', value: dict }, offset };
  }
  
  if (token === '[') {
    const arr: any[] = [];
    while (true) {
      offset = skipWhitespace(bytes, offset);
      if (offset >= bytes.length) break;
      if (bytes[offset] === 0x5D) {
        offset++;
        break;
      }
      const { obj, offset: arrOffset } = parseObject(bytes, offset);
      offset = arrOffset;
      arr.push(obj);
    }
    return { obj: { type: 'array', value: arr }, offset };
  }
  
  const num = parseFloat(token);
  if (!isNaN(num)) {
    return { obj: { type: 'number', value: num }, offset };
  }
  
  return { obj: { type: 'unknown', value: token }, offset };
}

function parseTrailerDict(bytes: Uint8Array, offset: number): { trailer: PDFTrailer; offset: number } {
  const { obj, offset: newOffset } = parseObject(bytes, offset);
  if (obj.type !== 'dict') {
    throw new Error('Trailer is not a dictionary');
  }
  return { trailer: obj.value as PDFTrailer, offset: newOffset };
}

export function parsePdf(bytes: Uint8Array): ParsedPDF {
  const headerOffset = detectHeaderOffset(bytes);
  if (headerOffset === -1) {
    throw new Error('Invalid PDF header: %PDF- signature not found');
  }
  
  const headerBytes = bytesToString(bytes.slice(headerOffset, headerOffset + 20));
  const validation = validateHeader(headerBytes);
  if (!validation.valid && validation.issues.some(i => !i.startsWith('Non-standard') && !i.startsWith('Unusual'))) {
    throw new Error(`Invalid PDF header: ${validation.issues.join(', ')}`);
  }
  
  const version = validation.version!;
  
  const startxrefIdx = findLastIndex(bytes, new TextEncoder().encode('startxref'), bytes.length - 1);
  if (startxrefIdx === -1) {
    throw new Error('startxref not found');
  }
  
  let offset = startxrefIdx + 9;
  offset = skipWhitespace(bytes, offset);
  const { value: xrefOffset } = readNumber(bytes, offset);
  
  let trailer: PDFTrailer = {};
  let objects = new Map<number, PDFObject>();
  
  if (xrefOffset > 0 && xrefOffset < bytes.length) {
    offset = xrefOffset;
    offset = skipWhitespace(bytes, offset);
    
    const { token } = readToken(bytes, offset);
    if (token === 'xref') {
      offset += 4;
      offset = skipWhitespace(bytes, offset);
      
      while (true) {
        offset = skipWhitespace(bytes, offset);
        if (offset >= bytes.length) break;
        const peek = bytesToString(bytes.slice(offset, offset + 10));
        if (peek.startsWith('trailer')) break;
        
        const { value: objNum } = readNumber(bytes, offset);
        offset = skipWhitespace(bytes, offset);
        const { value: count } = readNumber(bytes, offset);
        offset = skipWhitespace(bytes, offset);
        
        for (let i = 0; i < count; i++) {
          const line = bytesToString(bytes.slice(offset, offset + 20)).trim();
          const parts = line.split(' ');
          if (parts.length >= 3) {
            const entryOffset = parseInt(parts[0], 10);
            const generation = parseInt(parts[1], 10);
            const inUse = parts[2] === 'n';
            if (!objects.has(objNum + i)) {
              objects.set(objNum + i, {
                objNum: objNum + i,
                genNum: generation,
                data: new Uint8Array(0),
                parsed: { type: 'xref-entry', offset: entryOffset, generation, inUse }
              });
            }
          }
          offset += 20;
        }
      }
      
      offset = skipWhitespace(bytes, offset);
      if (bytesToString(bytes.slice(offset, offset + 7)) === 'trailer') {
        offset += 7;
        const { trailer: parsedTrailer, offset: trailerOffset } = parseTrailerDict(bytes, offset);
        trailer = parsedTrailer;
        offset = trailerOffset;
      }
    } else if (token.startsWith('/') && token.includes('XRef')) {
      const { trailer: parsedTrailer, offset: trailerOffset } = parseTrailerDict(bytes, offset);
      trailer = parsedTrailer;
      offset = trailerOffset;
    }
  }
  
  const xrefOffsetFinal = xrefOffset;
  
  for (const [objNum, obj] of objects.entries()) {
    if (obj.parsed.type === 'xref-entry' && obj.parsed.inUse) {
      const entryOffset = obj.parsed.offset;
      if (entryOffset < bytes.length) {
        let parseOffset = entryOffset;
        parseOffset = skipWhitespace(bytes, parseOffset);
        const { value: readObjNum } = readNumber(bytes, parseOffset);
        parseOffset = skipWhitespace(bytes, parseOffset);
        const { value: readGenNum } = readNumber(bytes, parseOffset);
        parseOffset = skipWhitespace(bytes, parseOffset);
        
        const objToken = bytesToString(bytes.slice(parseOffset, parseOffset + 4));
        if (objToken === 'obj') {
          parseOffset += 3;
          const { obj: parsedObj, offset: afterObj } = parseObject(bytes, parseOffset);
          objects.set(objNum, {
            objNum,
            genNum: readGenNum,
            data: bytes.slice(entryOffset, afterObj),
            parsed: parsedObj
          });
        }
      }
    }
  }
  
  trailer = fixTrailer(trailer, objects);
  objects = walkPrevChain(trailer, bytes, objects);
  trailer = fixTrailer(trailer, objects);
  
  return {
    header: { version, offset: headerOffset },
    version,
    xrefOffset: xrefOffsetFinal,
    trailer,
    objects
  };
}

export function recoverXRef(bytes: Uint8Array, trailer: PDFTrailer): Map<number, XRefEntry> {
  const entries = new Map<number, XRefEntry>();
  
  if (trailer.Prev && trailer.Prev > 0) {
    const prevEntries = recoverXRef(bytes.slice(0, trailer.Prev), trailer);
    for (const [num, entry] of prevEntries.entries()) {
      if (!entries.has(num)) {
        entries.set(num, entry);
      }
    }
  }
  
  let xrefOffset = trailer.Prev || 0;
  if (trailer.XRefStm) {
    xrefOffset = trailer.XRefStm;
  }
  
  if (xrefOffset > 0) {
    const searchStart = Math.max(0, xrefOffset - 100);
    const xrefIdx = findLastIndex(bytes.slice(searchStart, xrefOffset + 100), new TextEncoder().encode('xref'), 100);
    if (xrefIdx !== -1) {
      let offset = searchStart + xrefIdx + 4;
      offset = skipWhitespace(bytes, offset);
      
      while (true) {
        offset = skipWhitespace(bytes, offset);
        if (offset >= bytes.length) break;
        const peek = bytesToString(bytes.slice(offset, offset + 10));
        if (peek.startsWith('trailer')) break;
        
        const { value: objNum } = readNumber(bytes, offset);
        offset = skipWhitespace(bytes, offset);
        const { value: count } = readNumber(bytes, offset);
        offset = skipWhitespace(bytes, offset);
        
        for (let i = 0; i < count; i++) {
          const line = bytesToString(bytes.slice(offset, offset + 20)).trim();
          const parts = line.split(' ');
          if (parts.length >= 3) {
            const entryOffset = parseInt(parts[0], 10);
            const generation = parseInt(parts[1], 10);
            const inUse = parts[2] === 'n';
            const num = objNum + i;
            if (!entries.has(num) || inUse) {
              entries.set(num, { offset: entryOffset, generation, inUse });
            }
          }
          offset += 20;
        }
      }
    }
  }
  
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x6F && bytes[i + 1] === 0x62 && bytes[i + 2] === 0x6A) {
      let parseOffset = i;
      while (parseOffset > 0 && bytes[parseOffset - 1] !== 0x0A && bytes[parseOffset - 1] !== 0x0D) {
        parseOffset--;
      }
      parseOffset = skipWhitespace(bytes, parseOffset);
      const { value: objNum } = readNumber(bytes, parseOffset);
      parseOffset = skipWhitespace(bytes, parseOffset);
      const { value: genNum } = readNumber(bytes, parseOffset);
      parseOffset = skipWhitespace(bytes, parseOffset);
      if (bytesToString(bytes.slice(parseOffset, parseOffset + 3)) === 'obj') {
        if (!entries.has(objNum)) {
          entries.set(objNum, { offset: i, generation: genNum, inUse: true });
        }
      }
    }
  }
  
  return entries;
}

function decompressFlateDecode(data: Uint8Array): Uint8Array {
  let output: number[] = [];
  let i = 0;
  let bfinal = 0;
  let btype = 0;
  
  function readBits(n: number): number {
    let val = 0;
    for (let j = 0; j < n; j++) {
      if (i >= data.length * 8) return val;
      const byteIdx = i >> 3;
      const bitIdx = i & 7;
      val |= ((data[byteIdx] >> bitIdx) & 1) << j;
      i++;
    }
    return val;
  }
  
  function readBit(): number {
    if (i >= data.length * 8) return 0;
    const byteIdx = i >> 3;
    const bitIdx = i & 7;
    const bit = (data[byteIdx] >> bitIdx) & 1;
    i++;
    return bit;
  }
  
  const fixedLitCode = new Array(288).fill(0).map((_, idx) => {
    if (idx <= 143) return { code: (0x030 + idx) << 1, bits: 8, value: idx };
    if (idx <= 255) return { code: (0x190 - 144 + idx) << 1, bits: 9, value: idx };
    if (idx <= 279) return { code: (0x000 - 256 + idx) << 1, bits: 7, value: idx };
    return { code: (0x0C0 - 280 + idx) << 1, bits: 8, value: idx };
  });
  
  const fixedDistCode = new Array(32).fill(0).map((_, idx) => ({
    code: idx << 3, bits: 5, value: idx
  }));
  
  const lenBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const lenExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  
  function decodeHuffman(codes: {code: number, bits: number, value: number}[]): number {
    let code = 0;
    let bits = 0;
    for (let len = 1; len <= 15; len++) {
      code = (code << 1) | readBit();
      bits = len;
      for (const c of codes) {
        if (c.bits === len && c.code === code) {
          return c.value;
        }
      }
    }
    return 0;
  }
  
  while (true) {
    bfinal = readBit();
    btype = readBits(2);
    
    if (btype === 0) {
      i = (i + 7) & ~7;
      const len = readBits(16);
      const nlen = readBits(16);
      for (let j = 0; j < len; j++) {
        output.push(data[(i >> 3) + j]);
      }
      i += len * 8;
      if (bfinal) break;
      continue;
    }
    
    let litCodes, distCodes;
    if (btype === 1) {
      litCodes = fixedLitCode;
      distCodes = fixedDistCode;
    } else {
      const hlit = readBits(5) + 257;
      const hdist = readBits(5) + 1;
      const hclen = readBits(4) + 4;
      const clenOrder = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
      const clen = new Array(19).fill(0);
      for (let j = 0; j < hclen; j++) {
        clen[clenOrder[j]] = readBits(3);
      }
      const buildCodes = (lengths: number[], maxCode: number) => {
        const codes: {code: number, bits: number, value: number}[] = [];
        let code = 0;
        const blCount = new Array(16).fill(0);
        for (const l of lengths) if (l > 0) blCount[l]++;
        const nextCode = new Array(16).fill(0);
        for (let bits = 1; bits <= 15; bits++) {
          code = (code + blCount[bits - 1]) << 1;
          nextCode[bits] = code;
        }
        for (let n = 0; n <= maxCode; n++) {
          const len = lengths[n];
          if (len > 0) {
            codes.push({ code: nextCode[len]++, bits: len, value: n });
          }
        }
        return codes;
      };
      const clCodes = buildCodes(clen, 18);
      const litLengths = new Array(hlit).fill(0);
      const distLengths = new Array(hdist).fill(0);
      let idx = 0;
      while (idx < hlit + hdist) {
        const sym = decodeHuffman(clCodes);
        if (sym <= 15) {
          if (idx < hlit) litLengths[idx] = sym;
          else distLengths[idx - hlit] = sym;
          idx++;
        } else if (sym === 16) {
          const repeat = 3 + readBits(2);
          const prev = idx > 0 ? (idx < hlit ? litLengths[idx - 1] : distLengths[idx - hlit - 1]) : 0;
          for (let j = 0; j < repeat; j++) {
            if (idx < hlit) litLengths[idx] = prev;
            else distLengths[idx - hlit] = prev;
            idx++;
          }
        } else if (sym === 17) {
          const repeat = 3 + readBits(3);
          for (let j = 0; j < repeat; j++) {
            if (idx < hlit) litLengths[idx] = 0;
            else distLengths[idx - hlit] = 0;
            idx++;
          }
        } else if (sym === 18) {
          const repeat = 11 + readBits(7);
          for (let j = 0; j < repeat; j++) {
            if (idx < hlit) litLengths[idx] = 0;
            else distLengths[idx - hlit] = 0;
            idx++;
          }
        }
      }
      litCodes = buildCodes(litLengths, hlit - 1);
      distCodes = buildCodes(distLengths, hdist - 1);
    }
    
    while (true) {
      const sym = decodeHuffman(litCodes);
      if (sym < 256) {
        output.push(sym);
      } else if (sym === 256) {
        break;
      } else {
        const lenIdx = sym - 257;
        let len = lenBase[lenIdx] + readBits(lenExtra[lenIdx]);
        const distSym = decodeHuffman(distCodes);
        const distIdx = distSym;
        let dist = distBase[distIdx] + readBits(distExtra[distIdx]);
        for (let j = 0; j < len; j++) {
          output.push(output[output.length - dist]);
        }
      }
    }
    if (bfinal) break;
  }
  
  return new Uint8Array(output);
}

function parseXRefStream(streamObj: any): XRefEntry[] {
  const entries: XRefEntry[] = [];
  const dict = streamObj.parsed;
  const streamData = streamObj.data;
  
  const filter = dictGet(dict, 'Filter');
  let data = streamData;
  if (filter && filter.type === 'name' && filter.value === 'FlateDecode') {
    data = decompressFlateDecode(streamData);
  } else if (filter && filter.type === 'array') {
    for (const f of filter.value) {
      if (f.type === 'name' && f.value === 'FlateDecode') {
        data = decompressFlateDecode(streamData);
        break;
      }
    }
  }
  
  const index = dictGet(dict, 'Index');
  const w = dictGet(dict, 'W');
  if (!w || w.type !== 'array' || w.value.length < 3) {
    throw new Error('Invalid XRef stream W array');
  }
  
  const [w0, w1, w2] = w.value.map((v: any) => v.type === 'number' ? v.value : 0);
  const entrySize = w0 + w1 + w2;
  
  let ranges: number[][] = [];
  if (index && index.type === 'array') {
    for (let i = 0; i < index.value.length; i += 2) {
      const start = index.value[i].value;
      const count = index.value[i + 1].value;
      ranges.push([start, count]);
    }
  } else {
    const size = dictGet(dict, 'Size');
    ranges = [[0, size?.value || 0]];
  }
  
  let dataOffset = 0;
  for (const [start, count] of ranges) {
    for (let i = 0; i < count; i++) {
      if (dataOffset + entrySize > data.length) break;
      
      let type = 0;
      if (w0 > 0) {
        for (let j = 0; j < w0; j++) {
          type = (type << 8) | data[dataOffset++];
        }
      }
      
      let offset = 0;
      if (w1 > 0) {
        for (let j = 0; j < w1; j++) {
          offset = (offset << 8) | data[dataOffset++];
        }
      }
      
      let generation = 0;
      if (w2 > 0) {
        for (let j = 0; j < w2; j++) {
          generation = (generation << 8) | data[dataOffset++];
        }
      }
      
      const objNum = start + i;
      const inUse = type === 1;
      const isFree = type === 0 && generation === 65535;
      
      if (!entries[objNum] || inUse) {
        entries[objNum] = { offset, generation, inUse: inUse || !isFree };
      }
    }
  }
  
  return entries;
}

function parseXRefTable(bytes: Uint8Array, offset: number): XRefEntry[] {
  const entries: XRefEntry[] = [];
  offset = skipWhitespace(bytes, offset);
  
  const { token } = readToken(bytes, offset);
  if (token !== 'xref') {
    const { trailer } = parseTrailerDict(bytes, offset);
    if (trailer.XRefStm) {
      return [];
    }
    return entries;
  }
  
  offset += 4;
  offset = skipWhitespace(bytes, offset);
  
  while (true) {
    offset = skipWhitespace(bytes, offset);
    if (offset >= bytes.length) break;
    const peek = bytesToString(bytes.slice(offset, offset + 10));
    if (peek.startsWith('trailer')) break;
    
    const { value: objNum } = readNumber(bytes, offset);
    offset = skipWhitespace(bytes, offset);
    const { value: count } = readNumber(bytes, offset);
    offset = skipWhitespace(bytes, offset);
    
    for (let i = 0; i < count; i++) {
      const line = bytesToString(bytes.slice(offset, offset + 20)).trim();
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const entryOffset = parseInt(parts[0], 10);
        const generation = parseInt(parts[1], 10);
        const inUse = parts[2] === 'n';
        const num = objNum + i;
        const isFree = generation === 65535 && !inUse;
        if (!entries[num] || inUse) {
          entries[num] = { offset: entryOffset, generation, inUse: inUse || !isFree };
        }
      }
      offset += 20;
    }
  }
  
  return entries;
}

function linearScanForObjects(bytes: Uint8Array): XRefEntry[] {
  const entries: XRefEntry[] = [];
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x6F && bytes[i + 1] === 0x62 && bytes[i + 2] === 0x6A) {
      let parseOffset = i;
      while (parseOffset > 0 && bytes[parseOffset - 1] !== 0x0A && bytes[parseOffset - 1] !== 0x0D) {
        parseOffset--;
      }
      parseOffset = skipWhitespace(bytes, parseOffset);
      const { value: objNum } = readNumber(bytes, parseOffset);
      parseOffset = skipWhitespace(bytes, parseOffset);
      const { value: genNum } = readNumber(bytes, parseOffset);
      parseOffset = skipWhitespace(bytes, parseOffset);
      if (bytesToString(bytes.slice(parseOffset, parseOffset + 3)) === 'obj') {
        if (!entries[objNum]) {
          entries[objNum] = { offset: i, generation: genNum, inUse: true };
        }
      }
    }
  }
  return entries;
}

function dictGet(dict: any, key: string): any {
  if (dict && dict.type === 'dict' && dict.value) {
    return dict.value[key];
  }
  return dict?.[key];
}

function dictSet(dict: any, key: string, value: any): void {
  if (dict && dict.type === 'dict' && dict.value) {
    dict.value[key] = value;
  } else if (dict) {
    dict[key] = value;
  }
}

function randomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

export function fixTrailer(trailer: PDFTrailer, objectMap: Map<number, PDFObject>): PDFTrailer {
  const fixed = { ...trailer };
  
  if (!fixed.Size) {
    let maxObjNum = 0;
    for (const num of objectMap.keys()) {
      if (num > maxObjNum) maxObjNum = num;
    }
    fixed.Size = maxObjNum + 1;
  }
  
  if (!fixed.Root) {
    for (const [num, obj] of objectMap.entries()) {
      if (obj.parsed.type === 'dict') {
        const type = dictGet(obj.parsed, 'Type');
        if (type && type.type === 'name' && type.value === 'Catalog') {
          fixed.Root = { objNum: num, genNum: obj.genNum };
          break;
        }
      }
    }
  }
  
  if (!fixed.Info) {
    for (const [num, obj] of objectMap.entries()) {
      if (obj.parsed.type === 'dict') {
        const type = dictGet(obj.parsed, 'Type');
        if (type && type.type === 'name' && type.value === 'Info') {
          fixed.Info = { objNum: num, genNum: obj.genNum };
          break;
        }
      }
    }
  }
  
  if (!fixed.ID) {
    fixed.ID = [randomBytes(16), randomBytes(16)];
  }
  
  return fixed;
}

export function walkPrevChain(trailer: PDFTrailer, bytes: Uint8Array, objectMap: Map<number, PDFObject>): Map<number, PDFObject> {
  const mergedMap = new Map(objectMap);
  let currentTrailer = trailer;
  let prevOffset = currentTrailer.Prev;
  
  while (prevOffset && prevOffset > 0 && prevOffset < bytes.length) {
    const prevBytes = bytes.slice(0, prevOffset);
    const prevStartxrefIdx = findLastIndex(prevBytes, new TextEncoder().encode('startxref'), prevBytes.length - 1);
    
    if (prevStartxrefIdx === -1) break;
    
    let offset = prevStartxrefIdx + 9;
    offset = skipWhitespace(prevBytes, offset);
    const { value: xrefOffset } = readNumber(prevBytes, offset);
    
    if (xrefOffset <= 0 || xrefOffset >= prevBytes.length) break;
    
    offset = xrefOffset;
    offset = skipWhitespace(prevBytes, offset);
    
    const { token } = readToken(prevBytes, offset);
    if (token !== 'xref') break;
    
    offset += 4;
    offset = skipWhitespace(prevBytes, offset);
    
    const prevObjects = new Map<number, PDFObject>();
    
    while (true) {
      offset = skipWhitespace(prevBytes, offset);
      if (offset >= prevBytes.length) break;
      const peek = bytesToString(prevBytes.slice(offset, offset + 10));
      if (peek.startsWith('trailer')) break;
      
      const { value: objNum } = readNumber(prevBytes, offset);
      offset = skipWhitespace(prevBytes, offset);
      const { value: count } = readNumber(prevBytes, offset);
      offset = skipWhitespace(prevBytes, offset);
      
      for (let i = 0; i < count; i++) {
        const line = bytesToString(prevBytes.slice(offset, offset + 20)).trim();
        const parts = line.split(' ');
        if (parts.length >= 3) {
          const entryOffset = parseInt(parts[0], 10);
          const generation = parseInt(parts[1], 10);
          const inUse = parts[2] === 'n';
          const num = objNum + i;
          if (inUse && entryOffset < prevBytes.length) {
            let parseOffset = entryOffset;
            parseOffset = skipWhitespace(prevBytes, parseOffset);
            const { value: readObjNum } = readNumber(prevBytes, parseOffset);
            parseOffset = skipWhitespace(prevBytes, parseOffset);
            const { value: readGenNum } = readNumber(prevBytes, parseOffset);
            parseOffset = skipWhitespace(prevBytes, parseOffset);
            
            const objToken = bytesToString(prevBytes.slice(parseOffset, parseOffset + 4));
            if (objToken === 'obj') {
              parseOffset += 3;
              const { obj: parsedObj, offset: afterObj } = parseObject(prevBytes, parseOffset);
              prevObjects.set(num, {
                objNum: num,
                genNum: readGenNum,
                data: prevBytes.slice(entryOffset, afterObj),
                parsed: parsedObj
              });
            }
          }
        }
        offset += 20;
      }
    }
    
    offset = skipWhitespace(prevBytes, offset);
    if (bytesToString(prevBytes.slice(offset, offset + 7)) === 'trailer') {
      offset += 7;
      const { trailer: parsedTrailer, offset: trailerOffset } = parseTrailerDict(prevBytes, offset);
      currentTrailer = parsedTrailer;
    }
    
    for (const [num, obj] of prevObjects.entries()) {
      mergedMap.set(num, obj);
    }
    
    prevOffset = currentTrailer.Prev;
  }
  
  return mergedMap;
}

function getDictValue(obj: any, key: string): any {
  if (!obj || obj.type !== 'dict') return undefined;
  const val = obj.value[key];
  if (val && val.type === 'dict') return val.value;
  if (val && val.type === 'array') return val.value;
  if (val && val.type === 'number') return val.value;
  if (val && val.type === 'string') return val.value;
  if (val && val.type === 'name') return val.value;
  return val;
}

export function recoverPages(trailer: PDFTrailer, objectMap: Map<number, PDFObject>): RecoveredPages {
  const pages: PageInfo[] = [];
  const visited = new Set<number>();
  
  let rootObjNum: number | undefined;
  if (trailer.Root && typeof trailer.Root === 'object' && 'objNum' in trailer.Root) {
    rootObjNum = trailer.Root.objNum;
  }
  
  if (!rootObjNum) {
    for (const [num, obj] of objectMap.entries()) {
      if (obj.parsed.type === 'dict') {
        const type = getDictValue(obj.parsed, 'Type');
        if (type === 'Catalog') {
          rootObjNum = num;
          break;
        }
      }
    }
  }
  
  if (!rootObjNum || !objectMap.has(rootObjNum)) {
    return { pages, orphans: collectOrphans(objectMap, []) };
  }
  
  const rootObj = objectMap.get(rootObjNum)!;
  const pagesRef = getDictValue(rootObj.parsed, 'Pages');
  
  function processPageTree(nodeObjNum: number, parentResources: any): void {
    if (visited.has(nodeObjNum)) return;
    visited.add(nodeObjNum);
    
    const nodeObj = objectMap.get(nodeObjNum);
    if (!nodeObj || nodeObj.parsed.type !== 'dict') return;
    
    const nodeType = getDictValue(nodeObj.parsed, 'Type');
    const kids = getDictValue(nodeObj.parsed, 'Kids');
    const resources = getDictValue(nodeObj.parsed, 'Resources') || parentResources;
    const mediaBox = getDictValue(nodeObj.parsed, 'MediaBox');
    const contents = getDictValue(nodeObj.parsed, 'Contents');
    
    if (nodeType === 'Pages' && kids) {
      for (const kid of kids) {
        if (kid.type === 'number') {
          processPageTree(kid.value, resources);
        } else if (kid.type === 'dict' && kid.value && typeof kid.value.objNum === 'number') {
          processPageTree(kid.value.objNum, resources);
        }
      }
    } else if (nodeType === 'Page') {
      if (!mediaBox || !Array.isArray(mediaBox) || mediaBox.length !== 4) {
        return;
      }
      if (contents === undefined) {
        return;
      }
      pages.push({
        objNum: nodeObjNum,
        mediaBox,
        resources: resources || {},
        contents
      });
    }
  }
  
  if (pagesRef) {
    if (typeof pagesRef === 'number') {
      processPageTree(pagesRef, {});
    } else if (pagesRef && typeof pagesRef === 'object' && 'objNum' in pagesRef) {
      processPageTree(pagesRef.objNum, {});
    }
  }
  
  const pageObjNums = pages.map(p => p.objNum);
  const orphans = collectOrphans(objectMap, pageObjNums);
  
  return { pages, orphans };
}

export function collectOrphans(objectMap: Map<number, PDFObject>, pageObjNums: number[]): number[] {
  const reachable = new Set<number>(pageObjNums);
  const visited = new Set<number>();
  
  function markReachable(objNum: number): void {
    if (visited.has(objNum)) return;
    visited.add(objNum);
    reachable.add(objNum);
    
    const obj = objectMap.get(objNum);
    if (!obj || obj.parsed.type !== 'dict') return;
    
    const dict = obj.parsed.value;
    for (const key of Object.keys(dict)) {
      const val = dict[key];
      if (val && val.type === 'dict' && val.value && typeof val.value.objNum === 'number') {
        markReachable(val.value.objNum);
      } else if (val && val.type === 'array') {
        for (const item of val.value) {
          if (item && item.type === 'dict' && item.value && typeof item.value.objNum === 'number') {
            markReachable(item.value.objNum);
          }
        }
      }
    }
  }
  
  for (const pageNum of pageObjNums) {
    markReachable(pageNum);
  }
  
  const orphans: number[] = [];
  for (const num of objectMap.keys()) {
    if (!reachable.has(num)) {
      orphans.push(num);
    }
  }
  
  return orphans;
}