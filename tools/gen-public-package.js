#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.join.bind(path, __dirname, '..');

// eslint-disable-next-line import/no-dynamic-require
const { scripts, husky, devDependencies, ...packageJson } = require(root('package.json'));
const packageJsonStr = JSON.stringify(packageJson, null, 2);
fs.writeFileSync(root('dist', 'package.json'), packageJsonStr);
