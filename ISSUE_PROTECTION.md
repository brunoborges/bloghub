This repository has automatic issue protection enabled to ensure only the repository owner can create blog posts.

## Issue Templates

The repository includes helpful issue templates:

### 📝 Blog Post Template
- **For**: Repository owner only
- **Purpose**: Provides structure and reminders for creating blog posts
- **Features**: 
  - Clear instructions for blog content
  - Reminders about labeling and publishing process
  - Example Markdown structure

### ❓ Question/Feedback Template  
- **For**: General users (will be auto-closed)
- **Purpose**: Redirects users to appropriate channels
- **Redirects to**: Discussions tab, blog URL, fork options

### ⚙️ Template Configuration
- **Blank issues**: Disabled to encourage template use
- **Quick links**: Direct access to Discussions, blog, and fork options

## How It Works

When a new issue is created:

### ✅ **If created by repository owner**
- Issue remains open and can be used to create blog posts
- Normal blog publishing workflow continues

### 🚫 **If created by anyone else**
- Issue is automatically closed within seconds
- A polite comment explains the restriction
- User is provided with alternative ways to engage

## Alternative Ways to Contribute

If you're not the repository owner but want to engage:

- **💬 Join Discussions**: Participate in existing blog post discussions
- **🍴 Fork & Create**: Fork this repository to create your own blog
- **📧 Direct Contact**: Reach out to the repository owner directly
- **⭐ Show Support**: Star the repository if you find it useful

## Technical Implementation

The protection is implemented via GitHub Actions workflow (`.github/workflows/issue-guard.yml`) that:

1. Triggers on every new issue creation
2. Compares issue author with repository owner
3. Automatically closes non-owner issues with explanation
4. Allows owner issues to proceed normally

This ensures the blog remains under the owner's editorial control while still allowing community engagement through discussions.