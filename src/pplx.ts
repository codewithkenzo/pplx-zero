#!/usr/bin/env bun
/**
 * PPLX - Perplexity-powered web intelligence agent
 */

import { search, multiSearch } from './core.js';
import { Logger } from './util/monitoring.js';
import type { SearchResult } from './schema.js';

export interface ScoutRequest {
  query: string;
  maxResults?: number;
  country?: string;
  timeout?: number;
  context?: string;
}

export interface ScoutConfig {
  mode: 'single' | 'multi' | 'deep';
  maxResults?: number;
  concurrency?: number;
  timeout?: number;
  filters?: {
    dateRange?: string;
    site?: string[];
    fileType?: string[];
  };
}

export interface ScoutResult {
  query: string;
  results: SearchResult[];
  summary: string;
  insights: string[];
  sources: string[];
  timestamp: string;
  context?: string;
}

export class WebScoutAgent {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      component: 'WebScoutAgent',
    });
  }

  async scout(request: ScoutRequest, config: ScoutConfig = {}): Promise<ScoutResult> {
    const startTime = Date.now();
    this.logger.info('Starting web scouting', { 
      query: request.query, 
      mode: config.mode || 'single',
      context: request.context 
    });

    try {
      const maxResults = request.maxResults || config.maxResults || 5;
      const timeout = request.timeout || config.timeout || 30000;

      let searchResults: SearchResult[] = [];

      if (config.mode === 'multi' && request.query.includes(',')) {
        // Multi-query search
        const queries = request.query.split(',').map(q => q.trim()).filter(q => q.length > 0);
        
        searchResults = await this.multiSearch(queries, {
          maxResults,
          country: request.country,
          timeout,
          concurrency: config.concurrency || 3,
        });
      } else {
        // Single query search
        const result = await search(request.query, {
          maxResults,
          country: request.country,
          timeout,
        });
        
        if (result.success && result.results) {
          searchResults = result.results;
        }
      }

      const scoutResult = this.processResults(request, searchResults, config);
      
      this.logger.info('Web scouting completed', {
        query: request.query,
        resultCount: searchResults.length,
        duration: Date.now() - startTime,
      });

      return scoutResult;

    } catch (error) {
      this.logger.error('Web scouting failed', 
        error instanceof Error ? error : new Error(String(error)),
        { query: request.query }
      );

      throw error;
    }
  }

  async deepScout(queries: string[], config: ScoutConfig = {}): Promise<ScoutResult[]> {
    this.logger.info('Starting deep web scouting', { 
      queryCount: queries.length,
      maxResults: config.maxResults,
      concurrency: config.concurrency 
    });

    const results: ScoutResult[] = [];
    
    for (const query of queries) {
      try {
        const result = await this.scout({ query }, { ...config, mode: 'single' });
        results.push(result);
      } catch (error) {
        this.logger.error('Failed to scout query', 
          error instanceof Error ? error : new Error(String(error)),
          { query }
        );
        
        // Continue with other queries even if one fails
        results.push({
          query,
          results: [],
          summary: `Scouting failed: ${error instanceof Error ? error.message : String(error)}`,
          insights: [],
          sources: [],
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  async competitiveAnalysis(topics: string[], config: ScoutConfig = {}): Promise<{
    topic: string;
    summary: string;
    sources: ScoutResult[];
    insights: string[];
    recommendations: string[];
  }> {
    this.logger.info('Starting competitive analysis', { topics });

    const analysisResults = await this.deepScout(topics, config);
    
    // Aggregate insights across all topics
    const allSources = analysisResults.flatMap(r => r.sources);
    const allInsights = analysisResults.flatMap(r => r.insights);
    
    // Extract common themes and patterns
    const commonThemes = this.extractCommonThemes(analysisResults);
    const recommendations = this.generateRecommendations(analysisResults, commonThemes);

    return {
      topic: topics.join(' vs '),
      summary: `Analyzed ${topics.length} topics with ${analysisResults.length} successful searches and ${allSources.length} total sources.`,
      sources: analysisResults,
      insights: [...allInsights, ...commonThemes],
      recommendations,
    };
  }

  async trendAnalysis(topic: string, timeframe: string = '2024', config: ScoutConfig = {}): Promise<{
    topic: string;
    trends: string[];
    sources: string[];
    summary: string;
    insights: string[];
  }> {
    this.logger.info('Starting trend analysis', { topic, timeframe });

    const trendQueries = [
      `${topic} trends ${timeframe}`,
      `${topic} innovations ${timeframe}`,
      `${topic} best practices ${timeframe}`,
      `${topic} future predictions ${timeframe}`,
      `${topic} market analysis ${timeframe}`,
    ];

    const trendResults = await this.deepScout(trendQueries, config);
    
    const trends = this.extractTrends(trendResults);
    const allSources = trendResults.flatMap(r => r.sources);
    const allInsights = trendResults.flatMap(r => r.insights);

    return {
      topic,
      trends,
      sources: allSources,
      summary: `Analyzed ${trendQueries.length} trend queries for ${topic} in ${timeframe}, identifying ${trends.length} key trends.`,
      insights: allInsights,
    };
  }

  private async multiSearch(
    queries: string[], 
    options: {
      maxResults: number;
      country?: string;
      timeout: number;
      concurrency: number;
    }
  ): Promise<SearchResult[]> {
    const result = await multiSearch(queries, options);
    
    if (result.success && result.results) {
      return result.results.flatMap(r => r.results || []);
    }
    
    return [];
  }

  private processResults(
    request: ScoutRequest, 
    results: SearchResult[], 
    config: ScoutConfig
  ): ScoutResult {
    const insights = this.generateInsights(results, request.query);
    const summary = this.generateSummary(results, request.query);
    const sources = results.map(r => r.url);

    return {
      query: request.query,
      results,
      summary,
      insights,
      sources,
      timestamp: new Date().toISOString(),
      context: request.context,
    };
  }

  private generateInsights(results: SearchResult[], query: string): string[] {
    const insights: string[] = [];
    
    if (results.length === 0) {
      insights.push('No results found for the given query');
      return insights;
    }

    // Analyze result patterns
    const domains = results.map(r => new URL(r.url).hostname);
    const uniqueDomains = [...new Set(domains)];
    
    insights.push(`Found ${results.length} results from ${uniqueDomains.length} sources`);
    
    if (uniqueDomains.length === 1) {
      insights.push(`All results from ${uniqueDomains[0]} - consider broader search terms`);
    }

    // Check for recency
    const currentYear = new Date().getFullYear();
    const recentResults = results.filter(r => {
      if (r.date) {
        const resultYear = new Date(r.date).getFullYear();
        return resultYear >= currentYear - 1;
      }
      return false;
    });

    if (recentResults.length > 0) {
      insights.push(`${recentResults.length} results are from the current or previous year`);
    }

    // Content analysis
    const titles = results.map(r => r.title.toLowerCase());
    const hasTutorials = titles.some(t => t.includes('tutorial') || t.includes('guide') || t.includes('how to'));
    const hasNews = titles.some(t => t.includes('news') || t.includes('update') || t.includes('announcement'));
    
    if (hasTutorials) insights.push('Includes educational/tutorial content');
    if (hasNews) insights.push('Includes recent news/updates');

    return insights;
  }

  private generateSummary(results: SearchResult[], query: string): string {
    if (results.length === 0) {
      return `No results found for: ${query}`;
    }

    const topResult = results[0];
    const domain = new URL(topResult.url).hostname;
    
    return `Found ${results.length} relevant results for "${query}". Top result: "${topResult.title}" from ${domain}.`;
  }

  private extractCommonThemes(results: ScoutResult[]): string[] {
    const allTitles = results.flatMap(r => r.results.map(res => res.title.toLowerCase()));
    const themes: string[] = [];
    
    // Look for common keywords
    const keywords = ['ai', 'machine learning', 'javascript', 'python', 'react', 'vue', 'angular', 'node', 'typescript', 'security', 'performance', 'api'];
    
    for (const keyword of keywords) {
      const count = allTitles.filter(title => title.includes(keyword)).length;
      if (count >= 2) {
        themes.push(`${keyword} appears in ${count} results`);
      }
    }

    return themes;
  }

  private generateRecommendations(results: ScoutResult[], themes: string[]): string[] {
    const recommendations: string[] = [];
    
    if (results.length === 0) {
      recommendations.push('Try using broader search terms or checking spelling');
      recommendations.push('Consider adding specific timeframes or geographic regions');
      return recommendations;
    }

    recommendations.push('Consider cross-referencing with official documentation');
    
    if (themes.length > 0) {
      recommendations.push('Look into emerging trends and best practices');
    }

    const allSources = results.flatMap(r => r.sources);
    if (allSources.length > 10) {
      recommendations.push('Focus on authoritative sources for most reliable information');
    }

    return recommendations;
  }

  private extractTrends(results: ScoutResult[]): string[] {
    const trends: string[] = [];
    const allTitles = results.flatMap(r => r.results.map(res => res.title.toLowerCase()));
    
    // Look for trend indicators
    const trendIndicators = ['trend', 'growth', 'adoption', 'popularity', 'emerging', 'declining', 'rising', 'future'];
    
    for (const indicator of trendIndicators) {
      const matchingTitles = allTitles.filter(title => title.includes(indicator));
      if (matchingTitles.length > 0) {
        trends.push(`${indicator}: ${matchingTitles.length} mentions`);
      }
    }

    return trends;
  }
}

// CLI interface for the web scout agent
if (import.meta.main) {
  const scout = new WebScoutAgent();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const query = args[0];
  
  if (!query) {
    console.error('Usage: web-scout <query> [--mode single|multi|deep] [--max-results <n>] [--country <code>]');
    process.exit(1);
  }
  
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'single';
  const maxResults = args.includes('--max-results') ? parseInt(args[args.indexOf('--max-results') + 1]) : 5;
  const country = args.includes('--country') ? args[args.indexOf('--country') + 1] : undefined;
  
  scout.scout({ query }, { mode, maxResults, country })
    .then(result => {
      console.log('\n🔍 Web Scout Results:');
      console.log('==================');
      console.log(`Query: ${result.query}`);
      console.log(`Results: ${result.results.length}`);
      console.log(`Summary: ${result.summary}`);
      
      if (result.insights.length > 0) {
        console.log('\n💡 Insights:');
        result.insights.forEach(insight => console.log(`  • ${insight}`));
      }
      
      if (result.sources.length > 0) {
        console.log('\n📚 Top Sources:');
        result.sources.slice(0, 5).forEach(source => console.log(`  • ${source}`));
      }
      
      console.log(`\n📅 Searched: ${result.timestamp}`);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

// Exports already handled by interface and class declarations above
