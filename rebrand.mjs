import fs from 'fs';
import path from 'path';

const exts = ['.js', '.cjs', '.json', '.md', '.html'];
const skip = ['node_modules', '.git'];

// keep hosting hosts and the Toxic-v2 repo name untouched
const keep = /([\w./:-]*toxicx\.tech[\w./-]*|toxicx\.png|Toxic-v2)/g;

const subs = [
  [/Toxic-MD-Bot/g, 'BANNY-XMD-Bot'],
  [/Toxic-MD Bot/g, 'BANNY XMD Bot'],
  [/TOXIC-MD/g, 'BANNY XMD'],
  [/Toxic-MD/g, 'BANNY XMD'],
  [/Toxic-md/g, 'BANNY XMD'],
  [/Toxic MD/g, 'BANNY XMD'],
  [/TOXIC-AI/g, 'BANNY-AI'],
];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (skip.includes(f)) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!exts.includes(path.extname(p))) continue;

    let s = fs.readFileSync(p, 'utf8');
    let t = s.replace(/xhclintohn\/Toxic-MD/g, 'adeztech2/BANNY-XMD-'); // your repo first

    const masks = [];
    t = t.replace(keep, m => `\u0000${masks.push(m) - 1}\u0000`);
    for (const [a, b] of subs) t = t.replace(a, b);
    t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => masks[i]);

    if (t !== s) { fs.writeFileSync(p, t); console.log('updated', p); }
  }
}
walk('.');

// package.json needs a lowercase name
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = 'banny-xmd';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

// app.json keyword
if (fs.existsSync('app.json')) {
  fs.writeFileSync('app.json', fs.readFileSync('app.json', 'utf8').replace('"toxic-md"', '"banny-xmd"'));
}
console.log('Done: BANNY XMD');
