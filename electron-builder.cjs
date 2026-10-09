// GITHUB_REPOSITORY is supplied automatically by GitHub Actions.
const repository = process.env.GITHUB_REPOSITORY || 'ccFierro/Stabiliza';
if (repository && !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY debe ser propietario/repositorio');
module.exports = {
  appId: 'cl.estabiliza.laboratorio',
  productName: 'Estabiliza',
  directories: { output: 'dist' },
  files: ['*.html', '*.css', '*.js', '!*.test.js', '!ui-test-dom.js', 'desktop/**', 'package.json'],
  asar: true,
  extraResources: [{from:'matlab',to:'matlab'}],
  artifactName: 'Estabiliza-${version}-${arch}.${ext}',
  win: { target: [{ target: 'nsis', arch: ['x64'] }] },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false, createDesktopShortcut: true },
  publish: repository ? [{ provider: 'github', owner: repository.split('/')[0], repo: repository.split('/')[1], releaseType: 'draft' }] : null
};
