# Contributing to APK Builder

Thank you for your interest in contributing to APK Builder! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/alltechdev/apk/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check [Discussions](https://github.com/alltechdev/apk/discussions) for similar ideas
2. Create a new discussion or issue with:
   - Clear description of the feature
   - Use case and benefits
   - Possible implementation approach

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/apk.git
   cd apk
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments where necessary
   - Update documentation

4. **Test your changes**
   - Ensure the server starts without errors
   - Test all affected functionality
   - Verify no regressions

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   ```

   Use conventional commit messages:
   - `Add:` for new features
   - `Fix:` for bug fixes
   - `Update:` for improvements
   - `Docs:` for documentation
   - `Refactor:` for code refactoring

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Link related issues

## Development Setup

1. Install prerequisites (Node.js, Java, Android SDK)
2. Clone your fork
3. Run `./setup.sh` or follow manual setup in README
4. Make changes
5. Test locally

## Code Style

- Use ES6+ JavaScript features
- Use meaningful variable names
- Add JSDoc comments for functions
- Keep functions small and focused
- Use async/await instead of callbacks
- Handle errors appropriately

Example:
```javascript
/**
 * Process and resize an icon image
 * @param {Buffer|string} iconData - Image data
 * @param {string} buildDir - Build directory path
 * @returns {Promise<string|null>} Path to processed icon or null
 */
async function processIcon(iconData, buildDir) {
  // Implementation
}
```

## Testing

While we don't have automated tests yet, please manually test:
- Server startup
- Socket.IO connections
- APK generation with various configurations
- File upload and processing
- Error handling

## Documentation

When adding features:
- Update README.md if needed
- Add JSDoc comments
- Update API documentation
- Include examples

## Questions?

Feel free to:
- Open a discussion
- Ask in pull request comments
- Contact maintainers

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

Thank you for contributing! 🚀
