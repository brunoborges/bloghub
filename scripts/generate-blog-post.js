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

if (!issueNumber || !issueTitle) {
    console.error('Missing required environment variables');
    process.exit(1);
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
        return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code.trim())}</code></pre>`;
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
        if (para.match(/^### /)) {
            return para.replace(/^### (.*$)/m, '<h3>$1</h3>');
        }
        if (para.match(/^## /)) {
            return para.replace(/^## (.*$)/m, '<h2>$1</h2>');
        }
        if (para.match(/^# /)) {
            return para.replace(/^# (.*$)/m, '<h1>$1</h1>');
        }
        
        // Unordered lists
        if (para.match(/^- /m)) {
            const items = para.split('\n').map(line => {
                if (line.match(/^- /)) {
                    return '<li>' + processInlineMarkdown(line.replace(/^- /, '')) + '</li>';
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

// Process inline markdown elements
function processInlineMarkdown(text) {
    return text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// Main execution function
async function main() {
    // Create the discussion first
    const discussionBody = `This is a discussion thread for the blog post: **${issueTitle}**\n\n${issueBody.substring(0, 500)}${issueBody.length > 500 ? '...' : ''}\n\n[Read the full article →](https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io/${process.env.GITHUB_REPOSITORY.split('/')[1]}/posts/${fileName})`;
    
    const discussion = await createGitHubDiscussion(issueTitle, discussionBody);

    // Create HTML template for blog post
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>${escapeHtml(issueTitle)} - BlogHub</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <header>
        <nav>
            <a href="../index.html" class="home-link">← Back to Blog</a>
        </nav>
    </header>
    
    <main>
        <article>
            <header class="article-header">
                <h1>${escapeHtml(issueTitle)}</h1>
                <div class="article-meta">
                    <span class="author">By ${escapeHtml(issueAuthor)}</span>
                    <span class="date">${formatDate(createdDate)}</span>
                    <span class="issue-link">
                        <a href="https://github.com/${process.env.GITHUB_REPOSITORY}/issues/${issueNumber}" target="_blank">
                            View Original Issue #${issueNumber}
                        </a>
                    </span>
                </div>
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
        <p>Published using <a href="https://github.com/${process.env.GITHUB_REPOSITORY}">BlogHub</a> - 
           Powered by GitHub Issues and GitHub Pages</p>
    </footer>
</body>
</html>`;

    // Write the blog post file
    fs.writeFileSync(filePath, htmlContent);

    // Update or create the blog index
    updateBlogIndex();

    console.log(`Generated blog post: ${fileName}`);
    if (discussion) {
        console.log(`Discussion created: ${discussion.url}`);
    }
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
    // Read existing posts
    const posts = [];
    
    if (fs.existsSync(postsDir)) {
        const postFiles = fs.readdirSync(postsDir)
            .filter(file => file.endsWith('.html'));
        
        for (const file of postFiles) {
            const fullPath = path.join(postsDir, file);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Extract title and date from the HTML
            const titleMatch = content.match(/<h1>(.*?)<\/h1>/);
            const dateMatch = content.match(/<span class="date">(.*?)<\/span>/);
            const authorMatch = content.match(/<span class="author">By (.*?)<\/span>/);
            
            // Extract date from filename for better sorting
            const dateFromFilename = file.match(/^(\d{4}-\d{2}-\d{2})/);
            const sortDate = dateFromFilename ? new Date(dateFromFilename[1]) : new Date(0);
            
            if (titleMatch) {
                posts.push({
                    filename: file,
                    title: titleMatch[1],
                    date: dateMatch ? dateMatch[1] : '',
                    author: authorMatch ? authorMatch[1] : '',
                    url: `posts/${file}`,
                    sortDate: sortDate
                });
            }
        }
        
        // Sort posts by creation date, newest first
        posts.sort((a, b) => b.sortDate - a.sortDate);
    }
    
    // Generate index.html
    const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>BlogHub - GitHub-Powered Blog</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>BlogHub</h1>
        <p class="subtitle">A blog powered by GitHub Issues and GitHub Pages</p>
    </header>
    
    <main>
        <section class="posts">
            ${posts.length > 0 ? `
                <h2>Latest Posts</h2>
                <div class="post-list">
                    ${posts.map(post => `
                        <article class="post-preview">
                            <h3><a href="${post.url}">${post.title}</a></h3>
                            <div class="post-meta">
                                <span class="author">${post.author}</span>
                                <span class="date">${post.date}</span>
                            </div>
                        </article>
                    `).join('')}
                </div>
            ` : `
                <div class="no-posts">
                    <h2>Welcome to BlogHub!</h2>
                    <p>No posts yet. Create your first blog post by:</p>
                    <ol>
                        <li>Creating a new <a href="https://github.com/${process.env.GITHUB_REPOSITORY}/issues/new">GitHub Issue</a></li>
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
                This blog is powered by <a href="https://github.com/${process.env.GITHUB_REPOSITORY}">GitHub Issues</a>. 
                Each blog post is created from a GitHub Issue that has been labeled "APPROVED" and closed.
            </p>
            <p>
                <a href="https://github.com/${process.env.GITHUB_REPOSITORY}/issues">View Issues</a> | 
                <a href="https://github.com/${process.env.GITHUB_REPOSITORY}/issues/new">Create New Post</a> |
                <a href="https://github.com/${process.env.GITHUB_REPOSITORY}">GitHub Repository</a>
            </p>
        </div>
    </footer>
</body>
</html>`;
    
    fs.writeFileSync(path.join(docsDir, 'index.html'), indexContent);
    console.log('Updated blog index');
}

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