#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const requiredFiles = [
  "package.json",
  "tsconfig.json", 
  ".tool-contract.json",
  "README.md",
  "src/types.ts",
  "src/core.ts",
  "src/cli.ts",
  "src/index.ts",
  "tests/types.test.ts",
  "tests/core.test.ts",
  "tests/cli.test.ts",
  "tests/integration.test.ts",
  "biome.json",
  ".gitignore"
];

console.log("🔍 Validating Perplexity Search Tool structure...\n");

let allValid = true;

for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing`);
    allValid = false;
  }
}

// Validate package.json structure
try {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  console.log("\n📦 package.json validation:");
  
  const requiredFields = ["name", "version", "description", "main", "bin", "scripts", "dependencies", "devDependencies"];
  for (const field of requiredFields) {
    if (packageJson[field]) {
      console.log(`✅ ${field}: ${typeof packageJson[field] === 'object' ? 'object' : packageJson[field]}`);
    } else {
      console.log(`❌ ${field}: Missing`);
      allValid = false;
    }
  }
  
  if (packageJson.scripts?.build) {
    console.log(`✅ build script: ${packageJson.scripts.build}`);
  } else {
    console.log("❌ build script: Missing");
    allValid = false;
  }
} catch (error) {
  console.log("❌ Failed to parse package.json:", error.message);
  allValid = false;
}

// Validate tool contract
try {
  const contract = JSON.parse(readFileSync(".tool-contract.json", "utf8"));
  console.log("\n📋 Tool contract validation:");
  
  const requiredContractFields = ["name", "version", "runtime", "entrypoint", "schemas"];
  for (const field of requiredContractFields) {
    if (contract[field]) {
      console.log(`✅ ${field}: ${typeof contract[field] === 'object' ? 'object' : contract[field]}`);
    } else {
      console.log(`❌ ${field}: Missing`);
      allValid = false;
    }
  }
} catch (error) {
  console.log("❌ Failed to parse .tool-contract.json:", error.message);
  allValid = false;
}

// Validate TypeScript config
try {
  const tsConfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
  console.log("\n⚙️ TypeScript config validation:");
  
  if (tsConfig.compilerOptions) {
    console.log("✅ compilerOptions present");
    if (tsConfig.compilerOptions.strict) {
      console.log("✅ Strict mode enabled");
    } else {
      console.log("⚠️ Strict mode not enabled");
    }
  } else {
    console.log("❌ compilerOptions missing");
    allValid = false;
  }
} catch (error) {
  console.log("❌ Failed to parse tsconfig.json:", error.message);
  allValid = false;
}

console.log(`\n${allValid ? "🎉" : "❌"} Structure validation ${allValid ? "passed" : "failed"}`);

if (allValid) {
  console.log("\n📝 Next steps:");
  console.log("1. Run 'bun install' to install dependencies");
  console.log("2. Run 'bun run build' to build the tool");
  console.log("3. Set PERPLEXITY_API_KEY environment variable");
  console.log("4. Run 'bun run dev' to test the tool");
} else {
  console.log("\n🔧 Please fix the missing files or configuration errors above.");
}
