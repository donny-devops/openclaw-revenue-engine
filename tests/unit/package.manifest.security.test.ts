import packageJson from '../../package.json';
import packageLock from '../../package-lock.json';

describe('package manifests security regression', () => {
  it('pins the patched morgan dependency range', () => {
    expect(packageJson.dependencies.morgan).toBe('^1.12.1');
  });

  it('locks patched production dependency versions used by Trivy', () => {
    expect(packageLock.packages['node_modules/morgan']?.version).toBe('1.12.1');
    expect(packageLock.packages['node_modules/qs']?.version).toBe('6.16.0');
  });
});
