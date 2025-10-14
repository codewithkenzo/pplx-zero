# PPLX-Zero CLI Testing Guide

## Overview
This is a comprehensive test document for the PPLX-Zero CLI tool to verify that Markdown files are properly processed and sent to the Sonar API.

## Features Tested

### 1. File Upload Capabilities
- Testing Markdown (.md) file attachment functionality
- Verifying file parsing and content extraction
- Checking API integration with Perplexity Sonar model

### 2. API Integration
- Sonar model compatibility
- File attachment processing
- Response formatting and accuracy

### 3. CLI Interface
- Simplified short flags (-f for file)
- Model selection (-m sonar)
- Output formatting

## Test Scenarios

### Basic Test
Upload this Markdown file with a simple query to test basic functionality.

### Expected Results
- File should be successfully uploaded to Perplexity API
- Content should be properly parsed and analyzed
- Response should include relevant information from this document

## Technical Details

**File Format**: Markdown (.md)
**File Size**: Approximately 2KB
**Content Type**: Technical documentation
**Target Model**: Sonar (default)
**Query**: "Summarize this document and test file upload functionality"

This document serves as both test content and verification that the file upload feature works correctly with Markdown files.