import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/setup-entry.ts',
  ],
  deps: {
    skipNodeModulesBundle: true,
  },
});
