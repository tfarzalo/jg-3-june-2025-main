const fs = require('fs');
const path = require('path');

// Map old paths to new paths
const importMap = [
  { from: '../dateUtils', to: '../utils/dateUtils' },
  { from: '../formatUtils', to: '../utils/formatUtils' },
  { from: '../stringUtils', to: '../utils/stringUtils' },
  { from: '../auth', to: '../features/auth' },
  { from: '../jobs', to: '../features/jobs' },
  { from: '../properties', to: '../features/properties' },
  { from: '../Button', to: '../components/Button' },
  { from: '../Modal', to: '../components/Modal' },
  { from: '../Input', to: '../components/Input' }
];

function updateImports(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      updateImports(fullPath);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let updated = content;
      importMap.forEach(({ from, to }) => {
        const regex = new RegExp(from.replace(/\./g, '\\.'), 'g');
        updated = updated.replace(regex, to);
      });
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  });
}
updateImports('src');