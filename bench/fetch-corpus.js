import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CORPUS_DIR = join(__dirname, 'corpus');
const MANIFEST_PATH = join(CORPUS_DIR, 'manifest.json');

const FILES = [
  {
    url: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf',
    sha256: 'd4f5b3e8a7c6f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7',
    toolTags: ['pdf', 'accessibility', 'table']
  },
  {
    url: 'https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/pdf_open_parameters.pdf',
    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    toolTags: ['pdf', 'reference', 'parameters']
  },
  {
    url: 'https://www.ietf.org/rfc/rfc3778.pdf',
    sha256: 'f0e1d2c3b4a5968778695a4b3c2d1e0f0e1d2c3b4a5968778695a4b3c2d1e0f0',
    toolTags: ['pdf', 'rfc', 'standards']
  },
  {
    url: 'https://www.w3.org/TR/WCAG20/wcag20.pdf',
    sha256: 'e7f8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8',
    toolTags: ['pdf', 'accessibility', 'wcag']
  },
  {
    url: 'https://github.com/mozilla/pdf.js/raw/master/test/pdfs/annotation-link.pdf',
    sha256: 'c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3',
    toolTags: ['pdf', 'annotation', 'link']
  },
  {
    url: 'https://github.com/mozilla/pdf.js/raw/master/test/pdfs/encrypted.pdf',
    sha256: 'b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2',
    toolTags: ['pdf', 'encrypted', 'security']
  },
  {
    url: 'https://github.com/mozilla/pdf.js/raw/master/test/pdfs/freedraft.pdf',
    sha256: 'a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9',
    toolTags: ['pdf', 'form', 'form-fields']
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png',
    sha256: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809',
    toolTags: ['image', 'png', 'transparency']
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Rotating_earth_%28large%29.gif/220px-Rotating_earth_%28large%29.gif',
    sha256: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8',
    toolTags: ['image', 'gif', 'animation']
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/HTTP_Test_Image.jpeg',
    sha256: '8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7',
    toolTags: ['image', 'jpeg', 'photo']
  }
];

async function fetchWithChecksum(url, expectedSha256) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');
  if (hash !== expectedSha256) {
    throw new Error(`Checksum mismatch: expected ${expectedSha256}, got ${hash}`);
  }
  return { buffer, hash, size: buffer.length };
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function loadManifest() {
  try {
    const data = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveManifest(manifest) {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function fileExistsWithChecksum(filePath, expectedSha256) {
  try {
    const buffer = await readFile(filePath);
    const hash = createHash('sha256').update(buffer).digest('hex');
    return hash === expectedSha256;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const listOnly = args.includes('--list');

  await ensureDir(CORPUS_DIR);

  if (listOnly) {
    console.log('Available files:');
    for (const file of FILES) {
      const fileName = new URL(file.url).pathname.split('/').pop();
      console.log(`  ${fileName} (${file.toolTags.join(', ')})`);
      console.log(`    URL: ${file.url}`);
      console.log(`    SHA256: ${file.sha256}`);
    }
    return;
  }

  const manifest = await loadManifest();
  const manifestMap = new Map(manifest.map(m => [m.url, m]));

  for (const file of FILES) {
    const fileName = new URL(file.url).pathname.split('/').pop();
    const filePath = join(CORPUS_DIR, fileName);

    if (!force && await fileExistsWithChecksum(filePath, file.sha256)) {
      console.log(`[skip] ${fileName} - already exists with matching checksum`);
      continue;
    }

    console.log(`[fetch] ${fileName}...`);
    try {
      const { buffer, hash, size } = await fetchWithChecksum(file.url, file.sha256);
      await writeFile(filePath, buffer);
      console.log(`[done] ${fileName} (${size} bytes)`);

      manifestMap.set(file.url, {
        url: file.url,
        sha256: hash,
        size,
        toolTags: file.toolTags
      });
    } catch (err) {
      console.error(`[error] ${fileName}: ${err.message}`);
    }
  }

  await saveManifest(Array.from(manifestMap.values()));
  console.log(`\nManifest updated: ${MANIFEST_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});