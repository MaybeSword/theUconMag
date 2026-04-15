const ejs  = require('ejs');
const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');

const OUT         = path.join(__dirname, 'docs');
const ARTICLES_DIR = path.join(__dirname, 'articles');
const PUBLIC_DIR  = path.join(__dirname, 'public');
const VIEWS_DIR   = path.join(__dirname, 'views');
const COVER_EXTS  = new Set(['jpg', 'jpeg', 'png', 'webp']);

// ── helpers (mirrors server.js) ───────────────────────────────────────────────

function readFile(fp) {
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8').trim() : null;
}

function findCover(dir, slug) {
  const file = fs.readdirSync(dir).find(f => {
    const ext = f.split('.').pop().toLowerCase();
    return COVER_EXTS.has(ext);
  });
  return file ? `/articles/${slug}/${file}` : null;
}

function getExcerpt(mdPath) {
  if (!fs.existsSync(mdPath)) return '';
  return fs.readFileSync(mdPath, 'utf-8')
    .replace(/^#+.*/gm, '').replace(/[*_`\[\]]/g, '').replace(/\n+/g, ' ')
    .trim().substring(0, 220);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getArticles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR)
    .filter(slug => fs.statSync(path.join(ARTICLES_DIR, slug)).isDirectory() && !slug.startsWith('.'))
    .map(slug => {
      const dir  = path.join(ARTICLES_DIR, slug);
      const stat = fs.statSync(dir);
      const title    = readFile(path.join(dir, 'title.txt'))    || slug;
      const category = readFile(path.join(dir, 'category.txt')) || 'SATIRE';
      const cover    = findCover(dir, slug);
      const excerpt  = getExcerpt(path.join(dir, 'article.md'));
      const rawDate  = readFile(path.join(dir, 'date.txt'));
      const date     = rawDate ? new Date(rawDate) : stat.mtime;
      return { slug, title, category, cover, excerpt, date, dateStr: formatDate(date) };
    })
    .sort((a, b) => b.date - a.date);
}

// ── fs helpers ────────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry), d = path.join(dest, entry);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function write(outPath, html) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');
}

function render(template, data) {
  return ejs.renderFile(path.join(VIEWS_DIR, template), data, { views: VIEWS_DIR });
}

// ── build ─────────────────────────────────────────────────────────────────────

async function build() {
  // clean output
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
  fs.mkdirSync(OUT);

  // static assets
  copyDir(PUBLIC_DIR, OUT);
  if (fs.existsSync(ARTICLES_DIR)) copyDir(ARTICLES_DIR, path.join(OUT, 'articles'));

  // prevent Jekyll processing
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  // custom domain
  fs.writeFileSync(path.join(OUT, 'CNAME'), 'theucon.com');

  const articles = getArticles();

  // index
  write(path.join(OUT, 'index.html'), await render('index.ejs', { articles }));
  console.log('✓  index.html');

  // about
  write(path.join(OUT, 'about', 'index.html'), await render('about.ejs', {}));
  console.log('✓  about/index.html');

  // jhon
  write(path.join(OUT, 'jhon', 'index.html'), await render('jhon.ejs', {}));
  console.log('✓  jhon/index.html');

  // 404
  write(path.join(OUT, '404.html'), await render('404.ejs', {}));
  console.log('✓  404.html');

  // articles
  for (const a of articles) {
    const mdPath  = path.join(ARTICLES_DIR, a.slug, 'article.md');
    const content = fs.existsSync(mdPath)
      ? marked(fs.readFileSync(mdPath, 'utf-8'))
      : '<p>No content found.</p>';
    const related = articles.filter(r => r.slug !== a.slug).slice(0, 4);
    const html = await render('article.ejs', {
      title: a.title, category: a.category, cover: a.cover,
      content, dateStr: a.dateStr, slug: a.slug, related,
      pageTitle: a.title
    });
    write(path.join(OUT, 'article', a.slug, 'index.html'), html);
    console.log(`✓  article/${a.slug}/index.html`);
  }

  console.log('\nBuild complete → docs/');
}

build().catch(err => { console.error(err); process.exit(1); });
