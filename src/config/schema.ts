/**
 * Configuration schema definitions with Zod validation
 * Provides type-safe configuration with runtime validation and error messages
 */

import { z } from 'zod';

/**
 * Valid AI models supported by the CLI
 */
export const VALID_MODELS = [
  'sonar',
  'sonar-pro',
  'sonar-reasoning',
  'sonar-deep-research',
] as const;

/**
 * Valid output formats
 */
export const VALID_OUTPUT_FORMATS = [
  'json',
  'jsonl',
] as const;

/**
 * Configuration schema for default settings
 */
export const DefaultsSchema = z.object({
  model: z.enum(VALID_MODELS).optional(),
  maxResults: z.number().int().min(1).max(20).optional().default(5),
  concurrency: z.number().int().min(1).max(20).optional().default(5),
  timeout: z.number().int().min(1000).max(300000).optional().default(30000),
  batchSize: z.number().int().min(1).max(100).optional().default(20),
  outputFormat: z.enum(VALID_OUTPUT_FORMATS).optional().default('json'),
  stream: z.boolean().optional().default(false),
  useSearchApi: z.boolean().optional().default(true),
  temperature: z.number().min(0).max(2).optional().default(0.1),
  maxTokens: z.number().int().min(1).max(32000).optional().default(4000),
}).strict();

/**
 * Profile configuration schema
 */
export const ProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaults: DefaultsSchema.optional(),
  apiKey: z.string().min(1).optional(),
  webhook: z.string().url().optional(),
  inherit: z.string().optional(), // Inherit from another profile
  aliases: z.record(z.string().min(1), z.string().min(1)).optional(),
}).strict();

/**
 * Aliases configuration schema
 */
export const AliasesSchema = z.record(z.string().min(1).max(50), z.string().min(1));

/**
 * Experimental features schema
 */
export const ExperimentalSchema = z.object({
  features: z.array(z.string().min(1)).optional(),
  enableDebug: z.boolean().optional().default(false),
  betaModels: z.boolean().optional().default(false),
  advancedFeatures: z.boolean().optional().default(false),
}).strict();

/**
 * Environment-specific configuration schema
 */
export const EnvironmentSchema = z.object({
  name: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
  profiles: z.array(z.string()).optional(),
}).strict();

/**
 * Main configuration schema
 */
export const PplxConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/).describe('Configuration file version'),
  defaults: DefaultsSchema.optional(),
  profiles: z.record(z.string().min(1), ProfileSchema).optional(),
  aliases: AliasesSchema.optional(),
  experimental: ExperimentalSchema.optional(),
  environments: z.record(z.string().min(1), EnvironmentSchema).optional(),
  metadata: z.object({
    created: z.string().datetime().optional(),
    updated: z.string().datetime().optional(),
    source: z.string().optional(),
    description: z.string().max(1000).optional(),
  }).optional(),
}).passthrough(); // Allow additional fields for backward compatibility

/**
 * Type definitions
 */
export type PplxConfig = z.infer<typeof PplxConfigSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Aliases = z.infer<typeof AliasesSchema>;
export type Experimental = z.infer<typeof ExperimentalSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  config?: PplxConfig;
  errors: string[];
  warnings: string[];
}

/**
 * Validate configuration object against schema
 */
export function validateConfig(config: unknown): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // First ensure it's an object
    if (typeof config !== 'object' || config === null) {
      return {
        valid: false,
        errors: ['Configuration must be a JSON object'],
        warnings,
      };
    }

    // Add default version if missing
    const configWithVersion = { version: '1.0.0', ...config };

    const result = PplxConfigSchema.safeParse(configWithVersion);

    if (result.success) {
      // Check for deprecated or unusual configurations
      const validatedConfig = result.data;

      // Check for deprecated options
      if (validatedConfig.defaults?.timeout === 30000) {
        warnings.push('Default timeout value detected - consider customizing for your needs');
      }

      if (validatedConfig.experimental?.features?.includes('deprecated')) {
        warnings.push('Deprecated experimental features are enabled');
      }

      // Check profile inheritance cycles
      if (validatedConfig.profiles) {
        const visited = new Set<string>();
        for (const [profileName, profile] of Object.entries(validatedConfig.profiles)) {
          if (profile.inherit) {
            if (hasInheritanceCycle(profileName, validatedConfig.profiles, visited)) {
              errors.push(`Circular inheritance detected in profile "${profileName}"`);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        config: validatedConfig,
        errors,
        warnings,
      };
    } else {
      // Format Zod errors nicely
      const formattedErrors = result.error.issues.map(issue => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });

      return {
        valid: false,
        errors: formattedErrors,
        warnings,
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }
}

/**
 * Check for circular inheritance in profiles
 */
function hasInheritanceCycle(
  profileName: string,
  profiles: Record<string, Profile>,
  visited: Set<string>
): boolean {
  if (visited.has(profileName)) {
    return true;
  }

  visited.add(profileName);
  const profile = profiles[profileName];

  if (profile?.inherit && profiles[profile.inherit]) {
    return hasInheritanceCycle(profile.inherit, profiles, visited);
  }

  visited.delete(profileName);
  return false;
}

/**
 * Validate profile configuration
 */
export function validateProfile(profile: unknown): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const result = ProfileSchema.safeParse(profile);

    if (result.success) {
      return {
        valid: true,
        config: { version: '1.0.0', profiles: { [result.data.name]: result.data } },
        errors,
        warnings,
      };
    } else {
      const formattedErrors = result.error.issues.map(issue => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });

      return {
        valid: false,
        errors: formattedErrors,
        warnings,
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`Profile validation error: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }
}

/**
 * Merge configuration objects with proper precedence
 */
export function mergeConfigs(base: PplxConfig, override: Partial<PplxConfig>): PplxConfig {
  return {
    ...base,
    ...override,
    defaults: {
      ...base.defaults,
      ...override.defaults,
    },
    profiles: {
      ...base.profiles,
      ...override.profiles,
    },
    aliases: {
      ...base.aliases,
      ...override.aliases,
    },
    experimental: {
      ...base.experimental,
      ...override.experimental,
    },
    environments: {
      ...base.environments,
      ...override.environments,
    },
    metadata: {
      ...base.metadata,
      ...override.metadata,
      updated: new Date().toISOString(),
    },
  };
}

/**
 * Create default configuration
 */
export function createDefaultConfig(): PplxConfig {
  return {
    version: '1.0.0',
    defaults: {
      model: 'sonar',
      maxResults: 5,
      concurrency: 5,
      timeout: 30000,
      batchSize: 20,
      outputFormat: 'json',
      stream: false,
      useSearchApi: true,
      temperature: 0.1,
      maxTokens: 4000,
    },
    metadata: {
      created: new Date().toISOString(),
      description: 'PPLX-Zero CLI configuration',
    },
  };
}

/**
 * Schema version information
 */
export const SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_VERSIONS = ['1.0.0'];