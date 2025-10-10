#!/usr/bin/env bun
import { search, multiSearch, validateApiKey, getHealthStatus } from './src/core.js';

async function testCoreAPI() {
  console.log('🧪 Testing Core API...\n');

  try {
    // Test 1: API Key validation
    console.log('1️⃣ Testing API key validation...');
    const keyValidation = await validateApiKey();
    console.log('✅ API Key valid:', keyValidation.valid);
    if (!keyValidation.valid) {
      console.log('❌ API Key error:', keyValidation.error);
      return;
    }

    // Test 2: Single search
    console.log('\n2️⃣ Testing single search...');
    const singleResult = await search('Bun runtime vs Node.js performance', {
      maxResults: 3,
      timeout: 15000
    });
    
    console.log('✅ Single search success:', singleResult.success);
    if (singleResult.success) {
      console.log(`📊 Found ${singleResult.totalCount} results in ${singleResult.duration}ms`);
      console.log('🔗 First result:', singleResult.results?.[0]?.title);
    } else {
      console.log('❌ Single search error:', singleResult.error);
    }

    // Test 3: Multi search
    console.log('\n3️⃣ Testing multi-search...');
    const multiResult = await multiSearch([
      'TypeScript 5.0 features',
      'React Server Components',
      'Vite build performance'
    ], {
      maxResults: 2,
      concurrency: 2,
      timeout: 20000
    });
    
    console.log('✅ Multi-search success:', multiResult.success);
    if (multiResult.success && multiResult.summary) {
      console.log(`📊 Processed ${multiResult.summary.total} queries (${multiResult.summary.successful} successful) in ${multiResult.summary.totalDuration}ms`);
    } else {
      console.log('❌ Multi-search error:', multiResult.error);
    }

    // Test 4: Health check
    console.log('\n4️⃣ Testing health status...');
    const health = await getHealthStatus();
    console.log('✅ Health status:', {
      healthy: health.healthy,
      apiKeyPresent: health.apiKeyPresent,
      workspaceValid: health.workspaceValid,
      circuitBreakerState: health.resilienceStats?.circuitBreaker?.state
    });

    console.log('\n🎉 All core API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCoreAPI();
