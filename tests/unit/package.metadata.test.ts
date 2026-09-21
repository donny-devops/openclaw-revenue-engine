import { readFileSync } from 'node:fs';
import path from 'node:path';

type PackageJson = {
  devDependencies?: Record<string, string>;
};

type PackageLock = {
  packages?: Record<string, {
    devDependencies?: Record<string, string>;
    version?: string;
  }>;
};

describe('package metadata', () => {
  const repositoryRoot = path.resolve(__dirname, '../..');
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as PackageJson;
  const packageLock = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package-lock.json'), 'utf8'),
  ) as PackageLock;

  it('keeps the TypeScript devDependency on the supported major version for eslint', () => {
    expect(packageJson.devDependencies?.typescript).toMatch(/^>=5\.\d+\.\d+ <6\.0\.0$/);
    expect(packageLock.packages?.['']?.devDependencies?.typescript).toBe(
      packageJson.devDependencies?.typescript,
    );
    expect(packageLock.packages?.['node_modules/typescript']?.version).toMatch(/^5\./);
  });
});
