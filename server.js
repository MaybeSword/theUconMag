const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;
const ARTICLES_DIR = path.join(__dirname, 'articles');
const COVER_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/articles', express.static(ARTICLES_DIR));

// ── helpers ──────────────────────────────────────────────────────────────────

function readFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8').trim() : null;
}

function findCover(dir, slug) {
  for (const ext of COVER_EXTS) {
    if (fs.existsSync(path.join(dir, `cover.${ext}`))) {
      return `/articles/${slug}/cover.${ext}`;
    }
  }
  return null;
}

function getExcerpt(mdPath) {
  if (!fs.existsSync(mdPath)) return '';
  return fs.readFileSync(mdPath, 'utf-8')
    .replace(/^#+.*/gm, '')        // strip headings
    .replace(/[*_`\[\]]/g, '')     // strip markdown syntax
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 220);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function getArticles() {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR)
    .filter(slug => {
      const full = path.join(ARTICLES_DIR, slug);
      return fs.statSync(full).isDirectory() && !slug.startsWith('.');
    })
    .map(slug => {
      const dir = path.join(ARTICLES_DIR, slug);
      const stat = fs.statSync(dir);
      const title = readFile(path.join(dir, 'title.txt')) || slug;
      const category = readFile(path.join(dir, 'category.txt')) || 'SATIRE';
      const cover = findCover(dir, slug);
      const excerpt = getExcerpt(path.join(dir, 'article.md'));
      const rawDate = readFile(path.join(dir, 'date.txt'));
      const date = rawDate ? new Date(rawDate) : stat.mtime;
      return { slug, title, category, cover, excerpt, date, dateStr: formatDate(date) };
    })
    .sort((a, b) => b.date - a.date);
}

// ── routes ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const articles = getArticles();
  res.render('index', { articles });
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/jhon', (req, res) => {
  res.render('jhon');
});

app.get('/article/:slug', (req, res) => {
  const { slug } = req.params;
  const dir = path.join(ARTICLES_DIR, slug);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return res.status(404).render('404');
  }

  const stat = fs.statSync(dir);
  const title = readFile(path.join(dir, 'title.txt')) || slug;
  const category = readFile(path.join(dir, 'category.txt')) || 'SATIRE';
  const cover = findCover(dir, slug);
  const rawDate = readFile(path.join(dir, 'date.txt'));
  const dateStr = formatDate(rawDate ? new Date(rawDate) : stat.mtime);

  const mdPath = path.join(dir, 'article.md');
  const content = fs.existsSync(mdPath)
    ? marked(fs.readFileSync(mdPath, 'utf-8'))
    : '<p>No content found.</p>';

  const related = getArticles().filter(a => a.slug !== slug).slice(0, 4);
  res.render('article', { title, category, cover, content, dateStr, slug, related });
});

app.use((req, res) => res.status(404).render('404'));

app.listen(PORT, () => {
  console.log(`\n  UConn Mag → http://localhost:${PORT}\n`);
});
