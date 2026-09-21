import packageJson from '../../package.json';
import packageLock from '../../package-lock.json';

function parseVersion(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10));
}

function expectVersionAtLeast(actual: string, minimum: string) {
  const actualParts = parseVersion(actual);
  const minimumParts = parseVersion(minimum);
  const length = Math.max(actualParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;

    if (actualPart > minimumPart) {
      return;
    }

    if (actualPart < minimumPart) {
      throw new Error(`Expected ${actual} to be at least ${minimum}`);
    }
  }
}

describe('package manifests security regression', () => {
  it('pins the patched morgan dependency range', () => {
    expect(packageJson.dependencies.morgan).toBe('^1.12.1');
  });

  it('locks patched production dependency versions used by Trivy', () => {
    expectVersionAtLeast(packageLock.packages['node_modules/morgan']?.version ?? '0.0.0', '1.12.0');
    expectVersionAtLeast(packageLock.packages['node_modules/qs']?.version ?? '0.0.0', '6.16.0');
  });
});
