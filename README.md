# BlogHub 📝

A GitHub-powered blogging platform that uses **Issues as your content editor** and **GitHub Pages for hosting**. Write your blog posts in Markdown using GitHub Issues, and they'll automatically be converted to beautiful HTML blog posts!

## 🚀 How It Works

1. **Draft**: Create a new GitHub Issue with your blog post content in Markdown
2. **Review**: Add the `APPROVED` label when your post is ready
3. **Publish**: Close the issue to automatically generate and deploy your blog post
4. **Enjoy**: Your post is now live on GitHub Pages!

## ✨ Features

- 📝 **Markdown Editor**: Use GitHub Issues as your familiar Markdown editor
- 🤖 **Automatic Publishing**: GitHub Actions automatically converts and deploys posts
- 🎨 **Beautiful Design**: Clean, responsive blog design
- 🔗 **SEO Friendly**: Proper HTML structure with meta tags
- 📱 **Mobile Responsive**: Looks great on all devices
- 🔒 **Version Control**: All your content is versioned in Git
- 🆓 **Free Hosting**: Powered by GitHub Pages

## 🎯 Getting Started

### 1. Setup Repository

1. Fork or clone this repository
2. Enable GitHub Pages in Settings → Pages → Source: "GitHub Actions"
3. Ensure GitHub Actions are enabled in Settings → Actions

### 2. Create Your First Blog Post

1. Go to the **Issues** tab
2. Click **"New Issue"**
3. Write your blog post:
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
│   └── blog-publisher.yml     # GitHub Actions workflow
├── scripts/
│   └── generate-blog-post.js  # Blog post generator script  
├── docs/
│   ├── index.html             # Blog homepage
│   ├── styles.css             # Blog styling
│   └── posts/                 # Generated blog posts
├── README.md                  # This file
└── .gitignore                # Git ignore rules
```

## 🔧 Customization

### Styling

Edit `docs/styles.css` to customize the appearance of your blog.

### Blog Generator

Modify `scripts/generate-blog-post.js` to change how blog posts are generated from Issues.

### Workflow

Edit `.github/workflows/blog-publisher.yml` to customize the publishing process.

## 📖 Writing Tips

### Markdown Support

Your blog posts support full Markdown including:

- **Headers**: `# ## ###`
- **Bold/Italic**: `**bold**` `*italic*`
- **Links**: `[text](url)`
- **Images**: `![alt](url)`
- **Code**: `` `inline` `` and ```code blocks```
- **Lists**: Bullet and numbered lists
- **Tables**: GitHub-flavored markdown tables
- **Blockquotes**: `> quote text`

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
export GITHUB_REPOSITORY="yourusername/bloghub"

# Run the generator
node scripts/generate-blog-post.js
```

### Workflow Testing

The GitHub Actions workflow is triggered when:
- An issue is closed
- The issue has the `APPROVED` label

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