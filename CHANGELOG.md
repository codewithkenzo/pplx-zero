# 📋 CHANGELOG

All notable changes to PPLX-Zero will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-10-14

### 🔧 File Attachment Compatibility Fix

**Breaking Changes:**
- **Reduced supported file types** from 20+ to exactly match Perplexity API (11 formats total)
- **Updated supported formats** to only include officially documented types:
  - Documents: PDF, DOC, DOCX, TXT, RTF (5 types)
  - Images: PNG, JPEG, WebP, HEIF, HEIC, GIF (6 types)

**Features Added:**
- **🖼️ Production-Ready File Attachments** - Full compatibility with Perplexity API specifications
- **📚 Official API Compliance** - Implementation now matches official documentation exactly
- **⚡ Improved Error Handling** - Clear, specific error messages for unsupported file types
- **📏 Increased File Size Limit** - Updated from 40MB to 50MB to match API specifications

**Fixed:**
- JSON, XML, CSV, MD, and other unsupported formats now properly rejected
- Base64 encoding format validated for all supported types
- Clear error messages for unsupported file attachments
- Documentation now accurately reflects actual supported capabilities

**Documentation Updates:**
- Added comprehensive file attachment examples
- Updated CLI help text with correct supported formats
- Enhanced README with multimodal features section
- Added AI model descriptions and use cases

---

## [1.0.0] - 2025-10-13

### 🎉 Initial Release - PPLX-Zero

**Major Rebranding:**
- Renamed from `perplexity-fusion-search` → `pplx-zero`
- New repository: `codewithkenzo/pplx-zero`
- Updated CLI command: `pplx` → `pplx-zero`
- Comprehensive branding with "zero" concept (zero config, zero compromises)

### ✨ Features Added
- **🚀 Lightning Fast Search** - Concurrent query processing with intelligent rate limiting
- **📦 Batch Processing** - Handle multiple searches simultaneously from JSON files
- **🔄 Real-time Streaming** - JSONL progress updates via stderr
- **🛡️ Type Safety** - Full Zod schema validation and TypeScript support
- **⚡ Performance Optimized** - Built with Bun runtime for maximum speed
- **🎯 Zero Configuration** - Works out of the box with just API key
- **🌍 Cross-Platform** - Native Bun runtime support everywhere

### 🔧 Core Architecture
- **Resilience Patterns** - Circuit breaker and retry mechanisms
- **Error Classification** - Comprehensive error handling with proper codes
- **Input Validation** - Strict schema validation preventing injection
- **Timeout Management** - Configurable timeouts with AbortController
- **Memory Efficiency** - Streaming events prevent memory accumulation

### 📊 Technical Improvements
- **API Migration** - Complete migration from web scraping to official Perplexity AI API
- **Concurrent Processing** - Semaphore pattern for controlled concurrency
- **Event Streaming** - Real-time progress updates with JSONL format
- **Multiple Output Formats** - Support for both JSON and JSONL outputs
- **Dry Run Mode** - Input validation without executing searches

### 🛠️ CLI Features
- **Single Query Search** - `pplx-zero "your query"`
- **Batch Processing** - `pplx-zero --input queries.json`
- **Stdin Streaming** - `cat queries.jsonl | pplx-zero --stdin`
- **Custom Configuration** - Adjustable concurrency, timeout, and output format
- **Validation Mode** - `--dry-run` flag for input testing

### 📦 Package Structure
- **Zero Dependencies** - Minimal dependencies beyond core runtime
- **TypeScript First** - Full type safety with strict TypeScript configuration
- **Bun Optimized** - Built and optimized for Bun runtime performance
- **Global Installation** - Easy global npm installation support

### 🧪 Testing & Quality
- **76.56% Test Coverage** - Comprehensive test suite with 64 tests passing
- **Schema Validation** - Zod-powered input/output validation
- **Error Recovery** - Individual query failures don't abort batch operations
- **Performance Monitoring** - Built-in metrics and health checks

### 📚 Documentation
- **Modern README** - Compact, pleasant documentation with emoji design
- **Comprehensive Examples** - Real-world usage patterns and configurations
- **API Reference** - Complete interface documentation
- **Development Guide** - Setup and contribution instructions

### 🔒 Security Features
- **Environment Variable Keys** - Secure API key management
- **Input Sanitization** - Protection against injection attacks
- **Error Filtering** - Sensitive information excluded from outputs
- **Request Validation** - All inputs validated and sanitized

---

## 🔄 Migration from Previous Versions

If you were using the previous `perplexity-fusion-search` package:

```bash
# Uninstall old version
npm uninstall -g perplexity-fusion-search

# Install new PPLX-Zero
npm install -g pplx-zero

# Update your scripts from:
pplx "query"  # old
# to:
pplx-zero "query"  # new
```

**Breaking Changes:**
- CLI command renamed from `pplx` to `pplx-zero`
- Package name changed from `perplexity-fusion-search` to `pplx-zero`
- Repository moved to `codewithkenzo/pplx-zero`

**Non-Breaking Changes:**
- All API interfaces remain the same
- Configuration options unchanged
- Input/output formats consistent
- Environment variables the same

---

## 🤝 Contributing

We use [Semantic Versioning](https://semver.org/) for releases. For patch releases (x.x.1), we only fix bugs. For minor releases (x.1.x), we add new features in a backward-compatible manner. For major releases (1.x.x), we make breaking changes.

**Release Types:**
- `feat:` New features (minor version)
- `fix:` Bug fixes (patch version)
- `BREAKING CHANGE:` Breaking changes (major version)
- `docs:` Documentation updates (no version bump)
- `style:` Code formatting (no version bump)
- `refactor:` Code refactoring (no version bump)
- `test:` Testing improvements (no version bump)
- `chore:` Maintenance tasks (no version bump)