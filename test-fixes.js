#!/usr/bin/env bun
/**
 * Test script to verify attachment and advanced model fixes
 */

import { executeSearch } from './src/cli/commands/search.js';

async function testAdvancedModel() {
  console.log('Testing advanced model without attachments...');

  try {
    const result = await executeSearch(
      'What is the capital of France?',
      {
        model: 'sonar-reasoning',
        maxResults: 5,
        concurrency: 5,
        timeout: 30000,
        batchSize: 20,
        useSearchAPI: true,
        outputFormat: 'json',
        async: false,
      }
    );

    console.log('✅ Advanced model test result:');
    console.log('   Mode:', result.mode);
    console.log('   Success:', result.success);
    console.log('   Has content:', !!result.results?.content);
    console.log('   Content type:', typeof result.results?.content);

    if (result.results?.content) {
      console.log('   Content preview:', result.results.content.substring(0, 100) + '...');
    }
  } catch (error) {
    console.error('❌ Advanced model test failed:', error.message);
  }
}

async function testWithDummyFile() {
  console.log('\nTesting with dummy file attachment...');

  try {
    // Create a dummy text file
    const dummyPath = '/tmp/test-attachment.txt';
    await Bun.write(dummyPath, 'This is a test document for attachment testing.');

    const result = await executeSearch(
      'Summarize the attached document',
      {
        model: 'sonar-pro',
        maxResults: 5,
        concurrency: 5,
        timeout: 30000,
        batchSize: 20,
        useSearchAPI: true,
        outputFormat: 'json',
        async: false,
      },
      [dummyPath]
    );

    console.log('✅ Attachment test result:');
    console.log('   Mode:', result.mode);
    console.log('   Success:', result.success);
    console.log('   Has content:', !!result.results?.content);
    console.log('   Content type:', typeof result.results?.content);

    if (result.results?.content) {
      console.log('   Content preview:', result.results.content.substring(0, 100) + '...');
    }

    // Clean up
    await Bun.file(dummyPath).delete();
  } catch (error) {
    console.error('❌ Attachment test failed:', error.message);
  }
}

async function testNormalSearch() {
  console.log('\nTesting normal search API...');

  try {
    const result = await executeSearch(
      'What is TypeScript?',
      {
        model: 'sonar',
        maxResults: 5,
        concurrency: 5,
        timeout: 30000,
        batchSize: 20,
        useSearchAPI: true,
        outputFormat: 'json',
        async: false,
      }
    );

    console.log('✅ Normal search test result:');
    console.log('   Mode:', result.mode);
    console.log('   Success:', result.success);
    console.log('   Has results:', !!result.results?.results);
    console.log('   Results count:', result.results?.results?.length || 0);
  } catch (error) {
    console.error('❌ Normal search test failed:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing PPLX-Zero CLI fixes...\n');

  // Check for API key
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY environment variable not set');
    console.log('Please set your API key and run again');
    process.exit(1);
  }

  await testAdvancedModel();
  await testWithDummyFile();
  await testNormalSearch();

  console.log('\n✨ Tests completed!');
}

runTests().catch(console.error);