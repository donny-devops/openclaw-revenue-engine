import packageJson from '../../package.json';
import packageLock from '../../package-lock.json';

const semverGte = require('semver/functions/gte') as (version: string, minimum: string) => boolean;

type LockPackage = {
  version?: string;
  dev?: boolean;
};

function expectVersionAtLeast(actual: string, minimum: string) {
  if (!semverGte(actual, minimum)) {
    throw new Error(`Expected ${actual} to be at least ${minimum}`);
  }
}

function packageVersionsFor(name: string): string[] {
  return Object.entries(packageLock.packages as Record<string, LockPackage>)
    .filter(([packagePath, pkg]) => {
      const segments = packagePath.split('/');
      return segments[segments.length - 1] === name && pkg?.dev !== true && typeof pkg?.version === 'string';
    })
    .map(([, pkg]) => pkg!.version as string);
}

describe('package manifests security regression', () => {
  it('pins the patched morgan dependency range', () => {
    const declaredRange = packageJson.dependencies.morgan;
    expect(declaredRange.startsWith('^')).toBe(true);
    expectVersionAtLeast(declaredRange.slice(1), '1.12.1');
  });

  it('locks patched production dependency versions used by Trivy', () => {
    const morganVersions = packageVersionsFor('morgan');
    expect(morganVersions.length).toBeGreaterThan(0);
    morganVersions.forEach((version) => {
      expectVersionAtLeast(version, '1.12.1');
    });

    const qsVersions = packageVersionsFor('qs');
    expect(qsVersions.length).toBeGreaterThan(0);
    qsVersions.forEach((version) => {
      expectVersionAtLeast(version, '6.16.0');
    });
  });
});
