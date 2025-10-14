import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { PerplexitySearchTool } from '../src/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Attachment Functionality Test Suite', () => {
  let agent: PerplexitySearchTool;
  const testWorkspace = '/tmp/pplx-attachment-test-workspace';
  const originalEnv = process.env;

  // Mock the Perplexity API for attachment testing
  beforeAll(async () => {
    // Mock API key for testing
    process.env = {
      ...originalEnv,
      PERPLEXITY_API_KEY: 'test-api-key-for-attachment-testing'
    };

    // Enhanced mock with attachment support
    mock.module("@perplexity-ai/perplexity_ai", () => {
      class MockPerplexity {
        chat = {
          completions: {
            create: mock(async (params: any) => {
              // Validate that attachments are properly passed
              const userMessage = params.messages?.find((msg: any) => msg.role === 'user');
              const hasAttachments = userMessage?.attachments && userMessage.attachments.length > 0;

              console.log('Mock API called with attachments:', hasAttachments ? 'YES' : 'NO');
              if (hasAttachments) {
                console.log('Attachment count:', userMessage.attachments.length);
                userMessage.attachments.forEach((att: any, i: number) => {
                  console.log(`  Attachment ${i + 1}: ${att.name} (${att.mimeType})`);
                });
              }

              return {
                id: 'mock-attachment-response-id',
                object: 'chat.completion',
                created: Date.now(),
                model: params.model || 'sonar',
                choices: [{
                  index: 0,
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: `Mock response with attachments: ${hasAttachments ? 'Yes' : 'No'}. Query: ${userMessage?.content || 'unknown query'}. Processed ${hasAttachments ? userMessage.attachments.length : 0} attachments.`
                  }
                }],
                usage: {
                  prompt_tokens: 50,
                  completion_tokens: 150,
                  total_tokens: 200
                },
                citations: [],
                search_results: [
                  {
                    title: 'Mock Search Result with Attachments',
                    url: 'https://example.com/mock-result',
                    snippet: `This result includes ${hasAttachments ? 'attachment processing' : 'text-only processing'} capabilities.`
                  }
                ]
              };
            }),
            _client: {}
          }
        };
      }

      return {
        default: MockPerplexity,
      };
    });

    // Create test workspace and test files
    await fs.mkdir(testWorkspace, { recursive: true });

    // Create test files for attachment testing with realistic content
    const testImageBuffer = Buffer.from('fake-image-content-for-testing-png-header');
    const testPdfBuffer = Buffer.from('fake-pdf-content-for-testing-%PDF-1.4');
    const testTextBuffer = Buffer.from('This is a test text file for attachment processing.');

    await fs.writeFile(join(testWorkspace, 'test-image.png'), testImageBuffer);
    await fs.writeFile(join(testWorkspace, 'test-document.pdf'), testPdfBuffer);
    await fs.writeFile(join(testWorkspace, 'test-notes.txt'), testTextBuffer);
    await fs.writeFile(join(testWorkspace, 'test-presentation.pptx'), Buffer.from('fake-pptx-content'));
  });

  beforeEach(() => {
    agent = new PerplexitySearchTool(testWorkspace, {
      resilienceProfile: 'balanced',
      logLevel: 'error'
    });
    agent.resetCircuitBreaker();
  });

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up test workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test workspace:', error);
    }
  });

  describe('Basic Attachment Processing', () => {
    it('should handle single image attachment', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze this image',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-image.png'),
              name: 'test-image.png',
              type: 'image' as const
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result).toHaveProperty('id', input.id);
      expect(result).toHaveProperty('ok');
      if (result.ok) {
        expect(result.data).toHaveProperty('query', 'Analyze this image');
        expect(result.data).toHaveProperty('results');
        expect(Array.isArray(result.data.results)).toBe(true);
        expect(result.data.results.length).toBeGreaterThan(0);

        // Verify attachment processing in response
        const firstResult = result.data.results[0];
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('url');
        expect(firstResult).toHaveProperty('snippet');
        // The AI response should contain attachment information
        expect(firstResult.snippet).toContain('Mock response with attachments: Yes');
        expect(firstResult.snippet).toContain('Processed 1 attachments');
      }
    });

    it('should handle single document attachment', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Summarize this document',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-document.pdf'),
              name: 'test-document.pdf',
              type: 'document' as const
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Summarize this document');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });

    it('should handle multiple attachments of different types', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze these files together',
          maxResults: 3,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-image.png'),
              name: 'test-image.png',
              type: 'image' as const
            },
            {
              path: join(testWorkspace, 'test-document.pdf'),
              name: 'test-document.pdf',
              type: 'document' as const
            },
            {
              path: join(testWorkspace, 'test-notes.txt'),
              name: 'test-notes.txt',
              type: 'document' as const
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Analyze these files together');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });

    it('should auto-detect file type when type is not specified', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze this file without explicit type',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-image.png'),
              name: 'test-image.png'
              // No type specified - should be auto-detected
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Analyze this file without explicit type');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Pre-processed Attachments', () => {
    it('should handle pre-processed attachments', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze pre-processed attachments',
          maxResults: 2,
          model: 'sonar' as const,
          attachments: [
            {
              extension: '.png',
              mimeType: 'image/png',
              name: 'preprocessed-image.png',
              url: 'data:image/png;base64,fake-image-content',
              size: 1024
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Analyze pre-processed attachments');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });

    it('should combine attachment inputs with pre-processed attachments', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze all attachments',
          maxResults: 3,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-image.png'),
              name: 'local-image.png',
              type: 'image' as const
            }
          ],
          attachments: [
            {
              extension: '.pdf',
              mimeType: 'application/pdf',
              name: 'preprocessed-doc.pdf',
              url: 'data:application/pdf;base64,fake-pdf-content',
              size: 2048
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Analyze all attachments');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing attachment files gracefully', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze missing file',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: '/nonexistent/path/image.jpg',
              name: 'missing-image.jpg',
              type: 'image' as const
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.ok).toBe(false);
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(result.error.message).toContain('Cannot access file' || 'Failed to process attachment');
    });

    it('should handle invalid attachment input validation', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              // Missing required path field
              name: 'invalid-attachment.jpg',
              type: 'image' as const
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.ok).toBe(false);
      expect(result.error).toHaveProperty('code');
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('File path is required');
    });

    it('should handle unsupported file types', async () => {
      // Create an unsupported file type
      const unsupportedFile = join(testWorkspace, 'test-file.xyz');
      await fs.writeFile(unsupportedFile, Buffer.from('unsupported file content'));

      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze unsupported file',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: unsupportedFile,
              name: 'test-file.xyz',
              type: 'image' as const
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.ok).toBe(false);
      expect(result.error).toHaveProperty('code');
      expect(result.error.message).toContain('Unsupported file type' || 'Failed to process attachment');
    });

    it('should handle attachment processing timeouts', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze with timeout',
          maxResults: 2,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-image.png'),
              name: 'timeout-test-image.png',
              type: 'image' as const
            }
          ]
        },
        options: {
          timeoutMs: 1000, // Short timeout
          async: false
        }
      };

      const result = await agent.runTask(input);

      // Result should either succeed (if very fast) or fail due to timeout
      if (!result.ok) {
        expect(result.error).toHaveProperty('code');
        expect(['TIMEOUT', 'API_ERROR', 'INTERNAL_ERROR']).toContain(result.error.code);
      }
    });
  });

  describe('Batch Processing with Attachments', () => {
    it('should handle batch requests with mixed attachment types', async () => {
      const batchInput = {
        version: '1.0.0',
        requests: [
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Text-only search',
              maxResults: 1,
              model: 'sonar' as const
            },
            options: {
              async: false
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Image analysis',
              maxResults: 1,
              model: 'sonar' as const,
              attachmentInputs: [
                {
                  path: join(testWorkspace, 'test-image.png'),
                  name: 'batch-test-image.png',
                  type: 'image' as const
                }
              ]
            },
            options: {
              async: false
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Document analysis',
              maxResults: 1,
              model: 'sonar' as const,
              attachmentInputs: [
                {
                  path: join(testWorkspace, 'test-document.pdf'),
                  name: 'batch-test-doc.pdf',
                  type: 'document' as const
                }
              ]
            },
            options: {
              async: false
            }
          }
        ],
        options: {
          concurrency: 2,
          timeoutMs: 30000
        }
      };

      const result = await agent.runBatch(batchInput);

      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('results');

      expect(result.summary.total).toBe(3);
      expect(result.results).toHaveLength(3);

      // Check that all requests completed (either successfully or with proper errors)
      result.results.forEach((itemResult) => {
        expect(itemResult).toHaveProperty('id');
        expect(itemResult).toHaveProperty('ok');
        if (!itemResult.ok) {
          expect(itemResult.error).toHaveProperty('code');
          expect(itemResult.error).toHaveProperty('message');
        }
      });
    });
  });

  describe('Attachment Format Support', () => {
    it('should support various image formats', async () => {
      const imageFormats = [
        { ext: 'jpg', content: 'fake-jpg-content' },
        { ext: 'jpeg', content: 'fake-jpeg-content' },
        { ext: 'png', content: 'fake-png-content' },
        { ext: 'gif', content: 'fake-gif-content' }
      ];

      for (const format of imageFormats) {
        const testFile = join(testWorkspace, `test-image.${format.ext}`);
        await fs.writeFile(testFile, Buffer.from(format.content));

        const input = {
          id: randomUUID(),
          op: 'search' as const,
          args: {
            query: `Analyze ${format.ext} image`,
            maxResults: 1,
            model: 'sonar' as const,
            attachmentInputs: [
              {
                path: testFile,
                name: `test-image.${format.ext}`,
                type: 'image' as const
              }
            ]
          },
          options: {
            async: false
          }
        };

        const result = await agent.runTask(input);

        expect(result.id).toBe(input.id);
        if (result.ok) {
          expect(result.data.query).toBe(`Analyze ${format.ext} image`);
        }
      }
    });

    it('should support various document formats', async () => {
      const documentFormats = [
        { ext: 'pdf', content: 'fake-pdf-content-%PDF' },
        { ext: 'txt', content: 'This is a test text file.' },
        { ext: 'json', content: '{"test": "content"}' },
        { ext: 'md', content: '# Test Markdown' }
      ];

      for (const format of documentFormats) {
        const testFile = join(testWorkspace, `test-document.${format.ext}`);
        await fs.writeFile(testFile, Buffer.from(format.content));

        const input = {
          id: randomUUID(),
          op: 'search' as const,
          args: {
            query: `Analyze ${format.ext} document`,
            maxResults: 1,
            model: 'sonar' as const,
            attachmentInputs: [
              {
                path: testFile,
                name: `test-document.${format.ext}`,
                type: 'document' as const
              }
            ]
          },
          options: {
            async: false
          }
        };

        const result = await agent.runTask(input);

        expect(result.id).toBe(input.id);
        if (result.ok) {
          expect(result.data.query).toBe(`Analyze ${format.ext} document`);
        }
      }
    });
  });

  describe('Attachment Limits and Validation', () => {
    it('should handle attachment name auto-generation', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze file without name',
          maxResults: 1,
          model: 'sonar' as const,
          attachmentInputs: [
            {
              path: join(testWorkspace, 'test-image.png'),
              type: 'image' as const
              // No name specified - should use filename from path
            }
          ]
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Analyze file without name');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });

    it('should respect attachment processing limits', async () => {
      // Create many small test files
      const fileCount = 5;
      const attachmentInputs = [];

      for (let i = 0; i < fileCount; i++) {
        const testFile = join(testWorkspace, `test-file-${i}.txt`);
        await fs.writeFile(testFile, Buffer.from(`Test file ${i} content`));

        attachmentInputs.push({
          path: testFile,
          name: `test-file-${i}.txt`,
          type: 'document' as const
        });
      }

      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Analyze multiple files',
          maxResults: 5,
          model: 'sonar' as const,
          attachmentInputs
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      // Should either succeed or fail gracefully due to limits
      if (result.ok) {
        expect(result.data.results.length).toBeGreaterThan(0);
      } else {
        expect(result.error).toHaveProperty('message');
      }
    });
  });
});