const fs = require('fs');
const path = require('path');

function moveDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    fs.renameSync(srcPath, destPath);
  });
  fs.rmdirSync(src);
}

// 1. Move utility files to src/utils/
const utilsSrc = path.join('src');
const utilsDest = path.join('src', 'utils');
if (!fs.existsSync(utilsDest)) fs.mkdirSync(utilsDest);
['dateUtils.js', 'formatUtils.js', 'stringUtils.js'].forEach(utilFile => {
  const srcPath = path.join(utilsSrc, utilFile);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, path.join(utilsDest, utilFile));
  }
});

// 2. Move feature folders to src/features/
const features = ['auth', 'jobs', 'properties'];
const featuresDest = path.join('src', 'features');
if (!fs.existsSync(featuresDest)) fs.mkdirSync(featuresDest);
features.forEach(feature => {
  const srcPath = path.join('src', feature);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, path.join(featuresDest, feature));
  }
});

// 3. Move generic components to src/components/
const componentsSrc = path.join('src', 'components');
if (!fs.existsSync(componentsSrc)) fs.mkdirSync(componentsSrc);
['Button.js', 'Modal.js', 'Input.js'].forEach(compFile => {
  const srcPath = path.join('src', compFile);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, path.join(componentsSrc, compFile));
  }
});

// 4. Move scripts to tools/
const scriptsSrc = 'scripts';
const scriptsDest = 'tools';
if (fs.existsSync(scriptsSrc)) {
  if (!fs.existsSync(scriptsDest)) fs.mkdirSync(scriptsDest);
  fs.readdirSync(scriptsSrc).forEach(file => {
    fs.renameSync(path.join(scriptsSrc, file), path.join(scriptsDest, file));
  });
  fs.rmdirSync(scriptsSrc);
}

// 5. Move .bolt to tools/ if it exists
const boltSrc = '.bolt';
if (fs.existsSync(boltSrc)) {
  fs.renameSync(boltSrc, path.join('tools', '.bolt'));
}

console.log('File structure reorganization complete.');