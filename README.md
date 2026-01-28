# BlogHub 📝

A GitHub-powered blogging platform that uses **Issues as your content editor** and **GitHub Pages for hosting**. Write your blog posts in Markdown using GitHub Issues, and they'll automatically be converted to beautiful HTML blog posts!

## 🚀 How It Works

1. **Draft**: Create a new GitHub Issue with your blog post content in Markdown
2. **Review**: Add the `APPROVED` label when your post is ready
3. **Publish**: Close the issue to automatically generate and deploy your blog post
4. **Enjoy**: Your post is now live on GitHub Pages!

## ✨ Features

### Core Features
- 📝 **Markdown Editor**: Use GitHub Issues as your familiar Markdown editor
- 🤖 **Automatic Publishing**: GitHub Actions automatically converts and deploys posts
- 🎨 **Beautiful Design**: Clean, responsive blog design
- 📱 **Mobile Responsive**: Looks great on all devices
- 🔒 **Version Control**: All your content is versioned in Git
- 🆓 **Free Hosting**: Powered by GitHub Pages
- 🔒 **Owner Protection**: Only repository owner can create issues/posts
- 💬 **Discussion Integration**: Each post gets its own GitHub Discussion thread

### SEO & Discovery
- 🔗 **SEO Optimized**: Meta tags, Open Graph, and Twitter Cards for social sharing
- 📡 **RSS Feed**: Subscribers can follow your blog via `feed.xml`
- 🗺️ **Sitemap**: Automatic `sitemap.xml` generation for search engines
- 🔍 **Client-Side Search**: Fast search across all posts

### User Experience
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 🏷️ **Tags & Categories**: Organize posts with labels (uses GitHub Issue labels)
- 📖 **Reading Time**: Estimated reading time for each post
- 📄 **Post Excerpts**: Automatic excerpt generation for post previews
- 📑 **Pagination**: Paginated post listing for better navigation
- ✨ **Syntax Highlighting**: Beautiful code blocks with Prism.js

### Content Management
- ✏️ **Edit Posts**: Update posts by editing the issue (with `APPROVED` label)
- 🗑️ **Unpublish Posts**: Remove the `APPROVED` label to unpublish
- 📊 **Full Markdown**: Tables, blockquotes, images, lists, and more

## 🎯 Getting Started

### 1. Setup Repository

1. Fork or clone this repository
2. Enable GitHub Pages in Settings → Pages → Source: "GitHub Actions"
3. Ensure GitHub Actions are enabled in Settings → Actions

### 2. Create Your First Blog Post

**Note**: Only the repository owner can create issues. If someone else tries to create an issue, it will be automatically closed with an explanation.

1. Go to the **Issues** tab
2. Click **"New Issue"**
3. **Select "📝 Blog Post"** template (provides helpful guidance)
4. Write your blog post:
   - **Title**: This becomes your blog post title
   - **Body**: Write your content in Markdown format
4. Add the `APPROVED` label
5. Close the issue
6. Wait a few minutes for GitHub Actions to build and deploy

### 3. View Your Blog

Your blog will be available at: `https://yourusername.github.io/repositoryname`

## 📁 Repository Structure

```
bloghub/
├── .github/workflows/
│   ├── blog-publisher.yml     # GitHub Actions workflow
│   └── issue-guard.yml        # Owner-only issue protection
├── scripts/
│   └── generate-blog-post.js  # Blog post generator script  
├── docs/
│   ├── index.html             # Blog homepage (with search & pagination)
│   ├── styles.css             # Blog styling (with dark mode)
│   ├── feed.xml               # RSS feed (auto-generated)
│   ├── sitemap.xml            # Sitemap (auto-generated)
│   ├── search-index.json      # Search index (auto-generated)
│   ├── posts-metadata.json    # Post metadata (auto-generated)
│   └── posts/                 # Generated blog posts
├── README.md                  # This file
└── .gitignore                 # Git ignore rules
```

## 🛡️ Issue Protection & Community

### Repository Owner Only
Only the repository owner can create issues to maintain editorial control. If others try to create issues, they'll be automatically closed with a helpful message explaining alternatives.

### Community Engagement
While only owners can create posts, everyone can:
- 💬 **Join Discussions**: Each blog post has its own GitHub Discussion thread
- 🍴 **Fork & Create**: Fork the repository to start your own blog
- ⭐ **Show Support**: Star the repository if you find it useful
- 📧 **Direct Contact**: Reach out to the owner for collaboration

See [ISSUE_PROTECTION.md](ISSUE_PROTECTION.md) for technical details.

## 🔧 Customization

### Styling

Edit `docs/styles.css` to customize the appearance of your blog. The CSS uses CSS variables for easy theming and includes built-in dark mode support.

### Blog Generator

Modify `scripts/generate-blog-post.js` to change how blog posts are generated from Issues.

### Workflow

Edit `.github/workflows/blog-publisher.yml` to customize the publishing process.

## 🏷️ Using Tags

Add labels to your GitHub Issues to categorize posts:

1. Create labels in your repository (e.g., `javascript`, `tutorial`, `announcement`)
2. Add labels to your issue before closing
3. The `APPROVED` label is reserved for publishing - other labels become tags
4. Readers can filter posts by tag on the blog homepage

## 📖 Writing Tips

### Markdown Support

Your blog posts support full Markdown including:

- **Headers**: `# ## ### #### #####`
- **Bold/Italic**: `**bold**` `*italic*` `~~strikethrough~~`
- **Links**: `[text](url)`
- **Images**: `![alt](url)` (lazy-loaded automatically)
- **Code**: `` `inline` `` and fenced code blocks with syntax highlighting
- **Lists**: Bullet (`-`, `*`, `+`) and numbered lists
- **Tables**: GitHub-flavored markdown tables
- **Blockquotes**: `> quote text`
- **Horizontal Rules**: `---` or `***`

### Syntax Highlighting

Code blocks support syntax highlighting for many languages:

```javascript
function hello() {
    console.log("Hello, BlogHub!");
}
```

Supported languages include: JavaScript, TypeScript, Python, Bash, JSON, YAML, CSS, Java, Go, Rust, and more.

### Example Issue Template

```markdown
# My First Blog Post

Welcome to my blog! This is written in **Markdown** and will become a beautiful HTML blog post.

## Features I Love

- Easy to write
- Automatic publishing  
- Beautiful styling
- Mobile responsive

## Code Example

```javascript
function hello() {
    console.log("Hello, BlogHub!");
}
```

Check out [GitHub](https://github.com) for more amazing tools!
```

## 🛠️ Development

### Local Testing

To test the blog post generator locally:

```bash
# Set environment variables
export ISSUE_NUMBER=1
export ISSUE_TITLE="Test Post"
export ISSUE_BODY="# Hello World\nThis is a test post."
export ISSUE_AUTHOR="yourusername"  
export ISSUE_CREATED_AT="2024-01-01T00:00:00Z"
export ISSUE_UPDATED_AT="2024-01-02T00:00:00Z"
export ISSUE_LABELS='[{"name": "tutorial"}, {"name": "javascript"}]'
export GITHUB_REPOSITORY="yourusername/bloghub"

# Run the generator
node scripts/generate-blog-post.js
```

### Workflow Testing

The GitHub Actions workflow is triggered when:
- An issue is **closed** with the `APPROVED` label → publishes the post
- An issue is **edited** with the `APPROVED` label → updates the post
- The `APPROVED` label is **removed** → unpublishes the post

## 📡 RSS & Sitemap

Your blog automatically generates:
- **RSS Feed**: `https://yourusername.github.io/bloghub/feed.xml`
- **Sitemap**: `https://yourusername.github.io/bloghub/sitemap.xml`

Submit the sitemap to Google Search Console for better SEO.

## 📋 Requirements

- GitHub repository with Issues enabled
- GitHub Pages enabled
- GitHub Actions enabled
- Node.js (automatically provided by GitHub Actions)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test the changes
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙋‍♂️ Support

- 📖 Check the [Issues](../../issues) for common questions
- 🐛 Report bugs by creating a new Issue
- 💡 Request features through Issues
- 📚 Read GitHub's documentation on [Issues](https://docs.github.com/en/issues) and [Pages](https://docs.github.com/en/pages)

---

**Happy Blogging! 🎉**