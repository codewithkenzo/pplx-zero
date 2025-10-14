# Pull Request Workflow & Best Practices

This document outlines the comprehensive PR workflow and best practices for the pplx-zero project, with special focus on breaking changes and CLI interface refactoring.

## 🚀 Quick Start

### For Breaking Changes (CLI Refactoring)
```bash
# Create PR with automated configuration
./scripts/configure-pr.sh create

# Configure existing PR
./scripts/configure-pr.sh configure 123

# Validate PR configuration
./scripts/configure-pr.sh validate 123
```

## 📋 PR Configuration Summary

Based on the analysis of your breaking change requirements:

| Configuration | Value | Rationale |
|---------------|-------|-----------|
| **Reviewers** | `codewithkenzo` | Single maintainer project |
| **Labels** | `breaking-change,cli,enhancement,bug-fix,high-priority` | Comprehensive categorization |
| **Milestone** | `v1.1.0` | Semantic versioning for breaking changes |
| **Merge Strategy** | `squash` | Clean commit history |
| **Auto-merge** | `disabled` | Breaking changes require manual approval |
| **Assignees** | `codewithkenzo` | Clear ownership |

## 🎯 Label System

### Primary Labels
- **`breaking-change`** - Major API/interface changes requiring version bump
- **`cli`** - CLI interface modifications and improvements
- **`enhancement`** - New features or significant improvements
- **`bug-fix`** - Critical bug fixes and error resolution
- **`high-priority`** - Requires immediate attention and review

### Secondary Labels (as needed)
- **`documentation`** - Documentation updates and improvements
- **`performance`** - Performance optimizations
- **`security`** - Security-related changes
- **`testing`** - Test improvements and coverage updates
- **`dependencies`** - Dependency updates and maintenance

## 🔄 Breaking Change Workflow

### 1. Pre-PR Preparation
```bash
# Ensure all tests pass
bun test

# Check test coverage (must be 85%+)
bun test --coverage

# Type checking
bun run typecheck

# Linting
bun run lint

# Build validation
bun run build
```

### 2. Breaking Change Documentation
Update the following files:

#### CHANGELOG.md
```markdown
## [1.1.0] - 2024-XX-XX

### BREAKING CHANGES
- CLI interface refactoring with new argument parsing
- Updated file attachment handling to match official API specs
- Changed default behavior for async processing

### Added
- Enhanced CLI error handling and validation
- Improved file attachment support (11 official formats)
- Better migration guide and documentation

### Fixed
- Critical bug in duplicate attachment processing
- Memory leaks in large file processing
- Type safety issues in async operations

### Changed
- CLI command structure and argument parsing
- File type validation logic
- Error message formatting
```

#### README.md
```markdown
## Migration Guide (v1.0.x → v1.1.0)

### Breaking Changes
1. **CLI Interface**: Updated command structure
   ```bash
   # Old way
   pplx search "query" --file image.png

   # New way
   pplx "query" --attach image.png
   ```

2. **File Attachments**: Limited to official formats only
   - Supported: PDF, TXT, DOCX, XLSX, PPTX, JPG, PNG, GIF, BMP, TIFF, WEBP
   - Removed: Previously supported unofficial formats

3. **Async Processing**: Updated behavior
   - Better error handling and validation
   - Improved progress reporting
```

### 3. PR Creation Workflow

#### Automated PR Creation
```bash
# Create PR with all metadata configured
./scripts/configure-pr.sh create

# Or against a specific branch
./scripts/configure-pr.sh create develop
```

#### Manual PR Creation (if needed)
1. Create PR through GitHub UI
2. Run configuration script:
   ```bash
   ./scripts/configure-pr.sh configure <pr-number>
   ```

### 4. PR Validation Checklist

#### ✅ Required for All PRs
- [ ] All automated tests pass
- [ ] Test coverage maintained at 85%+
- [ ] Type checking passes without errors
- [ ] Linting passes with no warnings
- [ ] Build completes successfully
- [ ] CLI smoke tests pass

#### ✅ Additional for Breaking Changes
- [ ] Breaking changes documented in CHANGELOG.md
- [ ] Migration guide included in README.md
- [ ] Version updated (semantic versioning)
- [ ] Breaking change notice in PR description
- [ ] All CLI help text updated
- [ ] Examples updated for new interface

#### ✅ Quality Assurance
- [ ] Manual testing completed
- [ ] Breaking change scenarios tested
- [ ] Migration scenarios validated
- [ ] Performance impact assessed
- [ ] Security review completed

## 🛡️ Quality Gates

### Automated Checks
The PR validation workflow (`.github/workflows/pr-validation.yml`) ensures:

1. **Test Suite**: All tests must pass
2. **Coverage**: Minimum 85% test coverage
3. **Type Safety**: TypeScript compilation without errors
4. **Code Quality**: ESLint passes without warnings
5. **Build**: Project builds successfully
6. **CLI Validation**: Smoke tests for CLI functionality

### Manual Review Points
1. **Breaking Change Impact**: Assess user impact
2. **Migration Complexity**: Evaluate migration difficulty
3. **Documentation Quality**: Review clarity and completeness
4. **Performance Impact**: Check for regressions
5. **Security Implications**: Verify no new vulnerabilities

## 📊 PR Status Monitoring

### Using the Configuration Script
```bash
# Check PR status and configuration
./scripts/configure-pr.sh status 123

# Validate PR configuration
./scripts/configure-pr.sh validate 123
```

### Manual Status Check
The script provides detailed information about:
- PR title and description
- Branch information (source → target)
- Current state (open/closed/merged)
- Mergeability status
- Applied labels
- Assigned reviewers
- Milestone information

## 🚨 Emergency Procedures

### Rollback Process
If breaking changes cause critical issues:

1. **Immediate Action**
   ```bash
   # Create hotfix branch from previous tag
   git checkout -b hotfix/v1.0.2 v1.0.1

   # Cherry-pick critical fixes only
   git cherry-pick <commit-sha>

   # Create emergency PR
   ./scripts/configure-pr.sh create main
   ```

2. **Communication**
   - Issue notification to users
   - Clear rollback instructions
   - Timeline for fix availability

3. **Post-mortem**
   - Root cause analysis
   - Improved testing procedures
   - Updated documentation

### Hotfix Release Process
```bash
# Update version for hotfix
npm version 1.0.2 --no-git-tag-version

# Update package.json manually if needed
# Build and test
bun run build && bun test

# Create release PR
./scripts/configure-pr.sh create main
```

## 📈 Performance Monitoring

### Pre-Release Benchmarks
For breaking changes affecting performance:

1. **CLI Response Time**
   ```bash
   # Benchmark CLI startup
   time dist/pplx --version

   # Benchmark search operation
   time dist/pplx "test query"
   ```

2. **Memory Usage**
   ```bash
   # Monitor memory during operations
   /usr/bin/time -v dist/pplx "test query with file" --attach test.pdf
   ```

3. **File Processing**
   ```bash
   # Test with various file sizes
   for size in 1M 5M 10M 25M; do
       dd if=/dev/zero of=test-${size}.bin bs=${size} count=1
       time dist/pplx "test" --attach test-${size}.bin
   done
   ```

### Post-Release Monitoring
- Monitor npm download metrics
- Track GitHub issues and discussions
- Review user feedback and reports
- Performance regression detection

## 🔐 Security Considerations

### Breaking Change Security Review
1. **API Surface Changes**: Review new/modified endpoints
2. **File Handling**: Validate file processing security
3. **Input Validation**: Ensure proper sanitization
4. **Error Messages**: Check for information disclosure
5. **Dependencies**: Review for new vulnerabilities

### Security Testing
```bash
# Test file upload security
curl -X POST -F "file=@malicious.pdf" http://localhost:3000/upload

# Test input validation
dist/pplx "$(printf 'A%.0s' {1..10000})"

# Test error handling
dist/pplx "test" --attach /etc/passwd
```

## 📚 Documentation Standards

### PR Description Template
```markdown
## 🚨 Breaking Change - [Component]

### 📋 Change Summary
- [ ] Breaking changes clearly listed
- [ ] Migration path documented
- [ ] Backward compatibility notes
- [ ] User impact assessment

### 🧪 Testing Status
- [ ] All automated tests pass
- [ ] Manual testing completed
- [ ] Breaking change scenarios validated
- [ ] Migration scenarios tested

### 📦 Release Readiness
- [ ] Version updated correctly
- [ ] CHANGELOG.md updated
- [ ] README updated with migration guide
- [ ] Breaking changes documented

### 🔐 Security & Performance
- [ ] No security regressions
- [ ] Performance improvements validated
- [ ] Memory usage checked
- [ ] Error handling improved

### 📝 Documentation
- [ ] CLI help text updated
- [ ] README updated for breaking changes
- [ ] API documentation updated
- [ ] Examples and usage guides updated

### 🔗 Related Issues
Closes #issue_number
Fixes #issue_number
Related to #issue_number
```

### Commit Message Standards
```bash
# Breaking changes
feat: break cli interface for better usability

# Bug fixes
fix: resolve duplicate attachment processing issue

# Documentation
docs: update migration guide for v1.1.0

# Performance
perf: optimize file processing for large attachments
```

## 🎯 Success Metrics

### PR Quality Metrics
- **Merge Time**: Target < 24 hours for critical fixes
- **Review Coverage**: 100% review for breaking changes
- **Test Coverage**: Maintain 85%+ coverage
- **Documentation**: 100% documentation for breaking changes

### Release Quality Metrics
- **Zero Rollbacks**: No emergency rollbacks within 7 days
- **User Satisfaction**: Positive feedback on migration experience
- **Performance**: No performance regressions
- **Security**: No new security vulnerabilities

## 🔧 Troubleshooting

### Common Issues

#### PR Configuration Fails
```bash
# Check GitHub CLI authentication
gh auth status

# Verify repository access
gh repo view codewithkenzo/pplx-zero

# Check branch permissions
git branch -vv
```

#### Validation Errors
```bash
# Re-run validation with verbose output
./scripts/configure-pr.sh -v validate 123

# Check individual requirements
gh pr view 123 --json labels,milestone,reviewers,assignees
```

#### Merge Conflicts
```bash
# Update main branch
git checkout main
git pull origin main

# Rebase feature branch
git checkout feature-branch
git rebase main

# Resolve conflicts and continue
git rebase --continue
```

### Getting Help
- Check GitHub Actions logs for CI/CD issues
- Review this documentation for workflow guidance
- Consult the project README for general information
- Use GitHub Issues for questions or problems

## 📋 Quick Reference

### Essential Commands
```bash
# Create PR (breaking changes)
./scripts/configure-pr.sh create

# Validate PR
./scripts/configure-pr.sh validate <pr-number>

# Check status
./scripts/configure-pr.sh status <pr-number>

# Full test suite
bun test && bun run typecheck && bun run lint && bun run build

# Release preparation
npm version <version> && git push origin <version>
```

### File Locations
- **PR Configuration**: `.github/pr-config.yml`
- **PR Automation**: `scripts/configure-pr.sh`
- **Validation Workflow**: `.github/workflows/pr-validation.yml`
- **Publishing Workflow**: `.github/workflows/publish.yml`
- **Change Log**: `CHANGELOG.md`
- **Migration Guide**: `README.md` (Migration section)

This comprehensive workflow ensures professional, high-quality releases for the pplx-zero CLI tool while maintaining excellent user experience during breaking changes.