#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Get issue data from environment variables
const issueNumber = process.env.ISSUE_NUMBER;
const issueTitle = process.env.ISSUE_TITLE;
const issueBody = process.env.ISSUE_BODY || '';
const issueAuthor = process.env.ISSUE_AUTHOR;
const issueCreatedAt = process.env.ISSUE_CREATED_AT;
const issueUpdatedAt = process.env.ISSUE_UPDATED_AT;
const issueAction = process.env.GITHUB_EVENT_ACTION || 'closed'; // 'closed', 'edited', 'deleted', or 'unlabeled'
const issueLabels = process.env.ISSUE_LABELS ? JSON.parse(process.env.ISSUE_LABELS) : [];

// Configuration
const POSTS_PER_PAGE = 10;
const EXCERPT_LENGTH = 200;

if (!issueNumber || !issueTitle) {
    console.error('Missing required environment variables');
    process.exit(1);
}

// Get tags from labels (exclude system labels like APPROVED)
function getTagsFromLabels(labels) {
    const systemLabels = ['approved', 'blog', 'post'];
    return labels
        .map(label => typeof label === 'string' ? label : label.name)
        .filter(name => !systemLabels.includes(name.toLowerCase()))
        .map(name => ({
            name: name,
            slug: name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
        }));
}

// Calculate reading time
function calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes === 1 ? '1 min read' : `${minutes} min read`;
}

// Generate excerpt from content
function generateExcerpt(markdown, length = EXCERPT_LENGTH) {
    // Remove markdown formatting for excerpt
    let text = markdown
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`[^`]+`/g, '') // Remove inline code
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Remove images
        .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.match(/\[([^\]]+)\]/)[1]) // Keep link text
        .replace(/[#*_~>`]/g, '') // Remove markdown symbols
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();
    
    if (text.length <= length) return text;
    return text.substring(0, length).replace(/\s+\S*$/, '') + '...';
}

// Function to find existing blog post by issue number
function findExistingBlogPost(issueNum) {
    if (!fs.existsSync(postsDir)) {
        return null;
    }
    
    const postFiles = fs.readdirSync(postsDir)
        .filter(file => file.endsWith('.html'));
    
    for (const file of postFiles) {
        const fullPath = path.join(postsDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Look for the issue link that contains this issue number
        const issueLinkMatch = content.match(/View Original Issue #(\d+)/);
        if (issueLinkMatch && issueLinkMatch[1] === issueNum) {
            return {
                filename: file,
                path: fullPath,
                content: content
            };
        }
    }
    
    return null;
}

// Function to extract existing discussion URL from blog post
function extractDiscussionUrl(htmlContent) {
    const discussionMatch = htmlContent.match(/<a href="([^"]*discussions[^"]*)" target="_blank" class="discussion-link">/);
    return discussionMatch ? discussionMatch[1] : null;
}

// Function to create GitHub Discussion
async function createGitHubDiscussion(title, body) {
    const token = process.env.GITHUB_TOKEN;
    const repository = process.env.GITHUB_REPOSITORY;
    
    if (!token || !repository) {
        console.warn('GitHub token or repository not available, skipping discussion creation');
        return null;
    }

    const [owner, repo] = repository.split('/');
    
    // First, get the repository ID and discussion categories
    const repoQuery = `
        query {
            repository(owner: "${owner}", name: "${repo}") {
                id
                discussionCategories(first: 10) {
                    nodes {
                        id
                        name
                        slug
                    }
                }
            }
        }
    `;

    try {
        const repoData = await makeGraphQLRequest(token, repoQuery);
        const repositoryId = repoData.data.repository.id;
        const categories = repoData.data.repository.discussionCategories.nodes;
        
        // Find the "bloghub" category first, fallback to "General" or "Announcements", then first available
        let categoryId = categories.find(cat => 
            cat.name.toLowerCase() === 'bloghub' ||
            cat.slug === 'bloghub'
        )?.id;
        
        if (!categoryId) {
            categoryId = categories.find(cat => 
                cat.name.toLowerCase() === 'general' || 
                cat.name.toLowerCase() === 'announcements' ||
                cat.slug === 'general' ||
                cat.slug === 'announcements'
            )?.id;
        }
        
        if (!categoryId && categories.length > 0) {
            categoryId = categories[0].id;
        }
        
        if (!categoryId) {
            console.warn('No discussion categories found, skipping discussion creation');
            return null;
        }

        // Create the discussion
        const createDiscussionMutation = `
            mutation {
                createDiscussion(input: {
                    repositoryId: "${repositoryId}"
                    categoryId: "${categoryId}"
                    title: "${title.replace(/"/g, '\\"')}"
                    body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
                }) {
                    discussion {
                        id
                        number
                        url
                        title
                    }
                }
            }
        `;

        const discussionData = await makeGraphQLRequest(token, createDiscussionMutation);
        
        if (discussionData.data && discussionData.data.createDiscussion) {
            const discussion = discussionData.data.createDiscussion.discussion;
            console.log(`Created GitHub Discussion: ${discussion.url}`);
            return discussion;
        } else {
            console.warn('Failed to create discussion:', discussionData.errors);
            return null;
        }
    } catch (error) {
        console.warn('Error creating GitHub Discussion:', error.message);
        return null;
    }
}

// Helper function to make GraphQL requests
function makeGraphQLRequest(token, query) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query });
        
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: '/graphql',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'User-Agent': 'BlogHub-Script/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve(parsed);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// Create docs directory if it doesn't exist
const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

// Create posts directory
const postsDir = path.join(docsDir, 'posts');
if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
}

// Generate blog post filename
const createdDate = new Date(issueCreatedAt);
const dateStr = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD format
const slug = issueTitle.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();

const fileName = `${dateStr}-${slug}.html`;
const filePath = path.join(postsDir, fileName);

// Simple markdown to HTML converter
function simpleMarkdownToHtml(markdown) {
    let html = markdown;

    // Handle code blocks first (before other processing)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
        const langClass = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${langClass}>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Split by double newlines to handle paragraphs
    const paragraphs = html.split(/\n\n+/);
    
    html = paragraphs.map(para => {
        para = para.trim();
        if (!para) return '';
        
        // Skip if already processed as code block
        if (para.startsWith('<pre><code')) {
            return para;
        }
        
        // Headers
        if (para.match(/^###### /)) {
            return para.replace(/^###### (.*$)/m, '<h6>$1</h6>');
        }
        if (para.match(/^##### /)) {
            return para.replace(/^##### (.*$)/m, '<h5>$1</h5>');
        }
        if (para.match(/^#### /)) {
            return para.replace(/^#### (.*$)/m, '<h4>$1</h4>');
        }
        if (para.match(/^### /)) {
            return para.replace(/^### (.*$)/m, '<h3>$1</h3>');
        }
        if (para.match(/^## /)) {
            return para.replace(/^## (.*$)/m, '<h2>$1</h2>');
        }
        if (para.match(/^# /)) {
            return para.replace(/^# (.*$)/m, '<h1>$1</h1>');
        }
        
        // Blockquotes
        if (para.match(/^> /m)) {
            const quoteContent = para.split('\n')
                .map(line => line.replace(/^> ?/, ''))
                .join('<br>');
            return '<blockquote>' + processInlineMarkdown(quoteContent) + '</blockquote>';
        }
        
        // Tables
        if (para.includes('|') && para.match(/\|[\s-]+\|/)) {
            return parseTable(para);
        }
        
        // Horizontal rule
        if (para.match(/^([-*_]){3,}$/)) {
            return '<hr>';
        }
        
        // Unordered lists
        if (para.match(/^[-*+] /m)) {
            const items = para.split('\n').map(line => {
                if (line.match(/^[-*+] /)) {
                    return '<li>' + processInlineMarkdown(line.replace(/^[-*+] /, '')) + '</li>';
                }
                return line;
            }).join('\n');
            return '<ul>' + items.replace(/\n/g, '') + '</ul>';
        }
        
        // Ordered lists  
        if (para.match(/^\d+\. /m)) {
            const items = para.split('\n').map(line => {
                if (line.match(/^\d+\. /)) {
                    return '<li>' + processInlineMarkdown(line.replace(/^\d+\. /, '')) + '</li>';
                }
                return line;
            }).join('\n');
            return '<ol>' + items.replace(/\n/g, '') + '</ol>';
        }
        
        // Regular paragraphs
        return '<p>' + processInlineMarkdown(para.replace(/\n/g, '<br>')) + '</p>';
    }).join('\n\n');

    return html;
}

// Parse markdown table to HTML
function parseTable(tableMarkdown) {
    const lines = tableMarkdown.trim().split('\n');
    if (lines.length < 2) return '<p>' + tableMarkdown + '</p>';
    
    let html = '<table>';
    
    // Header row
    const headers = lines[0].split('|').map(cell => cell.trim()).filter(cell => cell);
    html += '<thead><tr>';
    headers.forEach(header => {
        html += `<th>${processInlineMarkdown(header)}</th>`;
    });
    html += '</tr></thead>';
    
    // Body rows (skip separator line)
    html += '<tbody>';
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell);
        if (cells.length > 0) {
            html += '<tr>';
            cells.forEach(cell => {
                html += `<td>${processInlineMarkdown(cell)}</td>`;
            });
            html += '</tr>';
        }
    }
    html += '</tbody></table>';
    
    return html;
}

// Process inline markdown elements
function processInlineMarkdown(text) {
    return text
        // Images (must come before links)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Main execution function
async function main() {
    console.log(`Processing issue #${issueNumber} (${issueAction}): ${issueTitle}`);
    
    const tags = getTagsFromLabels(issueLabels);
    const readingTime = calculateReadingTime(issueBody);
    const excerpt = generateExcerpt(issueBody);
    const repository = process.env.GITHUB_REPOSITORY || '';
    const [repoOwner, repoName] = repository.split('/');
    const siteUrl = `https://${repoOwner}.github.io/${repoName}`;
    
    // Check if this is an update to an existing post
    const existingPost = findExistingBlogPost(issueNumber);
    let discussion = null;
    let existingDiscussionUrl = null;
    
    if (existingPost) {
        console.log(`Found existing blog post: ${existingPost.filename}`);
        existingDiscussionUrl = extractDiscussionUrl(existingPost.content);
        if (existingDiscussionUrl) {
            console.log(`Preserving existing discussion: ${existingDiscussionUrl}`);
            discussion = { url: existingDiscussionUrl };
        }
    }
    
    // Only create a new discussion if this is a new post
    if (!existingPost && !discussion) {
        const discussionBody = `This is a discussion thread for the blog post: **${issueTitle}**\n\n${issueBody.substring(0, 500)}${issueBody.length > 500 ? '...' : ''}\n\n[Read the full article →](${siteUrl}/posts/${fileName})`;
        discussion = await createGitHubDiscussion(issueTitle, discussionBody);
    }

    // Generate tags HTML
    const tagsHtml = tags.length > 0 ? `
                <div class="article-tags">
                    ${tags.map(tag => `<a href="../index.html?tag=${tag.slug}" class="tag">${escapeHtml(tag.name)}</a>`).join('')}
                </div>` : '';

    // Create HTML template for blog post with SEO meta tags
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="${escapeHtml(excerpt)}">
    <meta name="author" content="${escapeHtml(issueAuthor)}">
    <meta name="keywords" content="${tags.map(t => escapeHtml(t.name)).join(', ')}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(issueTitle)}">
    <meta property="og:description" content="${escapeHtml(excerpt)}">
    <meta property="og:url" content="${siteUrl}/posts/${fileName}">
    <meta property="og:site_name" content="BlogHub">
    <meta property="article:author" content="${escapeHtml(issueAuthor)}">
    <meta property="article:published_time" content="${issueCreatedAt}">
    ${issueUpdatedAt ? `<meta property="article:modified_time" content="${issueUpdatedAt}">` : ''}
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(issueTitle)}">
    <meta name="twitter:description" content="${escapeHtml(excerpt)}">
    
    <title>${escapeHtml(issueTitle)} - BlogHub</title>
    <link rel="stylesheet" href="../styles.css">
    <link rel="alternate" type="application/rss+xml" title="BlogHub RSS Feed" href="../feed.xml">
    
    <!-- Prism.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
</head>
<body>
    <header>
        <nav class="top-nav">
            <a href="../index.html" class="home-link">← Back to Blog</a>
            <button class="theme-toggle" onclick="toggleDarkMode()" aria-label="Toggle dark mode">🌙</button>
        </nav>
    </header>
    
    <main>
        <article>
            <header class="article-header">
                <h1>${escapeHtml(issueTitle)}</h1>
                <div class="article-meta">
                    <span class="author">By ${escapeHtml(issueAuthor)}</span>
                    <span class="date">${formatDate(createdDate)}</span>
                    <span class="reading-time">📖 ${readingTime}</span>
                    <span class="issue-link">
                        <a href="https://github.com/${repository}/issues/${issueNumber}" target="_blank">
                            View Original Issue #${issueNumber}
                        </a>
                    </span>
                </div>${tagsHtml}
            </header>
            
            <div class="article-content">
                ${simpleMarkdownToHtml(issueBody)}
            </div>
            
            ${discussion ? `
            <div class="discussion-section">
                <hr>
                <h3>💬 Discussion</h3>
                <p>Have thoughts, questions, or feedback about this post? Join the discussion!</p>
                <p><a href="${discussion.url}" target="_blank" class="discussion-link">
                    💬 Comment and discuss on GitHub →
                </a></p>
            </div>
            ` : ''}
        </article>
    </main>
    
    <footer>
        <p>Published using <a href="https://github.com/${repository}">BlogHub</a> - 
           Powered by GitHub Issues and GitHub Pages</p>
    </footer>
    
    <!-- Prism.js for syntax highlighting -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-go.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-rust.min.js"></script>
    
    <!-- Dark mode script -->
    <script>
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            document.querySelector('.theme-toggle').textContent = isDark ? '☀️' : '🌙';
        }
        
        // Check saved preference
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            document.querySelector('.theme-toggle').textContent = '☀️';
        }
    </script>
</body>
</html>`;

    // Write the blog post file
    fs.writeFileSync(filePath, htmlContent);

    // Save post metadata for search and feeds
    savePostMetadata({
        issueNumber,
        title: issueTitle,
        excerpt,
        author: issueAuthor,
        date: issueCreatedAt,
        updatedAt: issueUpdatedAt,
        tags: tags.map(t => t.name),
        slug: fileName,
        readingTime,
        url: `posts/${fileName}`
    });

    // Update blog index, RSS feed, and sitemap
    updateBlogIndex();
    generateRssFeed();
    generateSitemap();
    generateSearchIndex();

    if (existingPost) {
        console.log(`Updated existing blog post: ${fileName}`);
    } else {
        console.log(`Generated new blog post: ${fileName}`);
    }
    
    if (discussion && !existingDiscussionUrl) {
        console.log(`Discussion created: ${discussion.url}`);
    } else if (existingDiscussionUrl) {
        console.log(`Discussion preserved: ${existingDiscussionUrl}`);
    }
}

// Save post metadata to JSON file
function savePostMetadata(metadata) {
    const metadataPath = path.join(docsDir, 'posts-metadata.json');
    let allMetadata = [];
    
    if (fs.existsSync(metadataPath)) {
        try {
            allMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
            allMetadata = [];
        }
    }
    
    // Update or add metadata
    const existingIndex = allMetadata.findIndex(p => p.issueNumber === metadata.issueNumber);
    if (existingIndex >= 0) {
        allMetadata[existingIndex] = metadata;
    } else {
        allMetadata.push(metadata);
    }
    
    // Sort by date, newest first
    allMetadata.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    fs.writeFileSync(metadataPath, JSON.stringify(allMetadata, null, 2));
    console.log('Updated posts metadata');
}

// Generate RSS feed
function generateRssFeed() {
    const repository = process.env.GITHUB_REPOSITORY || '';
    const [repoOwner, repoName] = repository.split('/');
    const siteUrl = `https://${repoOwner}.github.io/${repoName}`;
    
    const metadataPath = path.join(docsDir, 'posts-metadata.json');
    let posts = [];
    
    if (fs.existsSync(metadataPath)) {
        try {
            posts = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
            posts = [];
        }
    }
    
    const rssItems = posts.slice(0, 20).map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/${post.url}</link>
      <guid isPermaLink="true">${siteUrl}/${post.url}</guid>
      <description><![CDATA[${post.excerpt}]]></description>
      <author>${post.author}</author>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      ${post.tags.map(tag => `<category>${tag}</category>`).join('\n      ')}
    </item>`).join('');
    
    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BlogHub</title>
    <description>A blog powered by GitHub Issues and GitHub Pages</description>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>en-us</language>${rssItems}
  </channel>
</rss>`;
    
    fs.writeFileSync(path.join(docsDir, 'feed.xml'), rssFeed);
    console.log('Generated RSS feed');
}

// Generate sitemap
function generateSitemap() {
    const repository = process.env.GITHUB_REPOSITORY || '';
    const [repoOwner, repoName] = repository.split('/');
    const siteUrl = `https://${repoOwner}.github.io/${repoName}`;
    
    const metadataPath = path.join(docsDir, 'posts-metadata.json');
    let posts = [];
    
    if (fs.existsSync(metadataPath)) {
        try {
            posts = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
            posts = [];
        }
    }
    
    const urls = posts.map(post => `
  <url>
    <loc>${siteUrl}/${post.url}</loc>
    <lastmod>${post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : new Date(post.date).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>${urls}
</urlset>`;
    
    fs.writeFileSync(path.join(docsDir, 'sitemap.xml'), sitemap);
    console.log('Generated sitemap');
}

// Generate search index for client-side search
function generateSearchIndex() {
    const metadataPath = path.join(docsDir, 'posts-metadata.json');
    let posts = [];
    
    if (fs.existsSync(metadataPath)) {
        try {
            posts = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
            posts = [];
        }
    }
    
    // Create a lightweight search index
    const searchIndex = posts.map(post => ({
        title: post.title,
        excerpt: post.excerpt,
        url: post.url,
        tags: post.tags,
        date: post.date,
        author: post.author
    }));
    
    fs.writeFileSync(path.join(docsDir, 'search-index.json'), JSON.stringify(searchIndex));
    console.log('Generated search index');
}

// Execute main function
main().catch(error => {
    console.error('Error generating blog post:', error);
    process.exit(1);
});

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function updateBlogIndex() {
    const repository = process.env.GITHUB_REPOSITORY || '';
    const [repoOwner, repoName] = repository.split('/');
    const siteUrl = `https://${repoOwner}.github.io/${repoName}`;
    
    // Read posts from metadata
    const metadataPath = path.join(docsDir, 'posts-metadata.json');
    let posts = [];
    
    if (fs.existsSync(metadataPath)) {
        try {
            posts = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
            posts = [];
        }
    }
    
    // Collect all unique tags
    const allTags = [...new Set(posts.flatMap(p => p.tags || []))].sort();
    
    // Generate index.html with search, pagination, tags, and dark mode
    const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="A blog powered by GitHub Issues and GitHub Pages">
    <meta property="og:type" content="website">
    <meta property="og:title" content="BlogHub">
    <meta property="og:description" content="A blog powered by GitHub Issues and GitHub Pages">
    <meta property="og:url" content="${siteUrl}">
    
    <title>BlogHub - GitHub-Powered Blog</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="alternate" type="application/rss+xml" title="BlogHub RSS Feed" href="feed.xml">
</head>
<body>
    <header>
        <div class="header-content">
            <div class="header-title">
                <h1>BlogHub</h1>
                <p class="subtitle">A blog powered by GitHub Issues and GitHub Pages</p>
            </div>
            <div class="header-actions">
                <a href="feed.xml" class="rss-link" title="RSS Feed">📡 RSS</a>
                <button class="theme-toggle" onclick="toggleDarkMode()" aria-label="Toggle dark mode">🌙</button>
            </div>
        </div>
    </header>
    
    <main>
        <!-- Search Section -->
        <section class="search-section">
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search posts..." aria-label="Search posts">
                <button onclick="clearSearch()" class="clear-search" aria-label="Clear search">✕</button>
            </div>
        </section>
        
        ${allTags.length > 0 ? `
        <!-- Tags Section -->
        <section class="tags-section">
            <div class="tags-container">
                <button class="tag active" onclick="filterByTag('')">All</button>
                ${allTags.map(tag => `<button class="tag" onclick="filterByTag('${tag.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}')">${tag}</button>`).join('')}
            </div>
        </section>
        ` : ''}
        
        <section class="posts">
            ${posts.length > 0 ? `
                <h2>Latest Posts</h2>
                <div class="post-list" id="postList">
                    ${posts.map((post, index) => `
                        <article class="post-preview" data-tags="${(post.tags || []).map(t => t.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')).join(',')}" data-page="${Math.floor(index / POSTS_PER_PAGE) + 1}">
                            <h3><a href="${post.url}">${post.title}</a></h3>
                            <p class="post-excerpt">${post.excerpt}</p>
                            <div class="post-meta">
                                <span class="author">${post.author}</span>
                                <span class="date">${new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <span class="reading-time">📖 ${post.readingTime}</span>
                            </div>
                            ${(post.tags || []).length > 0 ? `
                            <div class="post-tags">
                                ${post.tags.map(tag => `<span class="tag-small">${tag}</span>`).join('')}
                            </div>
                            ` : ''}
                        </article>
                    `).join('')}
                </div>
                
                <!-- Pagination -->
                ${posts.length > POSTS_PER_PAGE ? `
                <div class="pagination" id="pagination">
                    <button onclick="prevPage()" id="prevBtn" disabled>← Previous</button>
                    <span id="pageInfo">Page 1 of ${Math.ceil(posts.length / POSTS_PER_PAGE)}</span>
                    <button onclick="nextPage()" id="nextBtn">Next →</button>
                </div>
                ` : ''}
                
                <div id="noResults" class="no-results" style="display: none;">
                    <p>No posts found matching your search.</p>
                </div>
            ` : `
                <div class="no-posts">
                    <h2>Welcome to BlogHub!</h2>
                    <p>No posts yet. Create your first blog post by:</p>
                    <ol>
                        <li>Creating a new <a href="https://github.com/${repository}/issues/new">GitHub Issue</a></li>
                        <li>Writing your article content in Markdown format</li>
                        <li>Adding the <code>APPROVED</code> label</li>
                        <li>Closing the issue to publish the blog post</li>
                    </ol>
                </div>
            `}
        </section>
    </main>
    
    <footer>
        <div class="footer-content">
            <p>
                <strong>How it works:</strong> 
                This blog is powered by <a href="https://github.com/${repository}">GitHub Issues</a>. 
                Each blog post is created from a GitHub Issue that has been labeled "APPROVED" and closed.
            </p>
            <p>
                <a href="https://github.com/${repository}/issues/new">Create New Post</a> |
                <a href="https://github.com/${repository}">GitHub Repository</a> |
                <a href="feed.xml">RSS Feed</a> |
                <a href="sitemap.xml">Sitemap</a>
            </p>
        </div>
    </footer>
    
    <script>
        // Dark mode
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            document.querySelector('.theme-toggle').textContent = isDark ? '☀️' : '🌙';
        }
        
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            document.querySelector('.theme-toggle').textContent = '☀️';
        }
        
        // Pagination
        let currentPage = 1;
        const postsPerPage = ${POSTS_PER_PAGE};
        const totalPosts = ${posts.length};
        const totalPages = Math.ceil(totalPosts / postsPerPage);
        let currentTag = '';
        let searchQuery = '';
        
        function updateDisplay() {
            const posts = document.querySelectorAll('.post-preview');
            let visibleCount = 0;
            let pageCount = 0;
            
            posts.forEach((post, index) => {
                const tags = post.dataset.tags.split(',');
                const matchesTag = !currentTag || tags.includes(currentTag);
                const title = post.querySelector('h3').textContent.toLowerCase();
                const excerpt = post.querySelector('.post-excerpt')?.textContent.toLowerCase() || '';
                const matchesSearch = !searchQuery || title.includes(searchQuery) || excerpt.includes(searchQuery);
                
                if (matchesTag && matchesSearch) {
                    visibleCount++;
                    const pageNum = Math.ceil(visibleCount / postsPerPage);
                    if (pageNum === currentPage) {
                        post.style.display = 'block';
                        pageCount++;
                    } else {
                        post.style.display = 'none';
                    }
                } else {
                    post.style.display = 'none';
                }
            });
            
            const filteredTotal = visibleCount;
            const filteredPages = Math.ceil(filteredTotal / postsPerPage);
            
            document.getElementById('noResults').style.display = visibleCount === 0 ? 'block' : 'none';
            
            const pagination = document.getElementById('pagination');
            if (pagination) {
                if (filteredPages <= 1) {
                    pagination.style.display = 'none';
                } else {
                    pagination.style.display = 'flex';
                    document.getElementById('pageInfo').textContent = 'Page ' + currentPage + ' of ' + filteredPages;
                    document.getElementById('prevBtn').disabled = currentPage === 1;
                    document.getElementById('nextBtn').disabled = currentPage >= filteredPages;
                }
            }
        }
        
        function prevPage() {
            if (currentPage > 1) {
                currentPage--;
                updateDisplay();
            }
        }
        
        function nextPage() {
            currentPage++;
            updateDisplay();
        }
        
        function filterByTag(tag) {
            currentTag = tag;
            currentPage = 1;
            
            document.querySelectorAll('.tags-section .tag').forEach(btn => {
                btn.classList.remove('active');
                if ((tag === '' && btn.textContent === 'All') || 
                    btn.textContent.toLowerCase().replace(/[^\\w\\s-]/g, '').replace(/\\s+/g, '-') === tag) {
                    btn.classList.add('active');
                }
            });
            
            updateDisplay();
        }
        
        // Search
        document.getElementById('searchInput')?.addEventListener('input', function(e) {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1;
            updateDisplay();
        });
        
        function clearSearch() {
            document.getElementById('searchInput').value = '';
            searchQuery = '';
            currentPage = 1;
            updateDisplay();
        }
        
        // Check URL for tag filter
        const urlParams = new URLSearchParams(window.location.search);
        const tagParam = urlParams.get('tag');
        if (tagParam) {
            filterByTag(tagParam);
        } else {
            updateDisplay();
        }
    </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(docsDir, 'index.html'), indexContent);
    console.log('Updated blog index');
}
