#!/usr/bin/env node

/**
 * 将构建产物复制到 Tabby 插件目录，实现快速部署。
 *
 * 用法:
 *   npm run deploy
 *   npm run build:deploy
 *   node scripts/deploy.js
 *   node scripts/deploy.js --build
 *
 * 环境变量 TABBY_PLUGIN_DIR 可覆盖默认目标目录。
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PLUGIN_NAME = 'tabby-command-tips'

const PLUGIN_ROOT_BY_PLATFORM = {
  win32: path.join(process.env.APPDATA || '', 'tabby', 'plugins', 'node_modules', PLUGIN_NAME),
  darwin: path.join(process.env.HOME || '', 'Library', 'Application Support', 'tabby', 'plugins', 'node_modules', PLUGIN_NAME),
  linux: path.join(process.env.HOME || '', '.config', 'tabby', 'plugins', 'node_modules', PLUGIN_NAME),
}

function copyDirSync (src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  let count = 0
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      count += copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
      count++
    }
  }
  return count
}

function resolvePluginRoot () {
  if (process.env.TABBY_PLUGIN_DIR) {
    return path.resolve(process.env.TABBY_PLUGIN_DIR)
  }
  const root = PLUGIN_ROOT_BY_PLATFORM[process.platform]
  if (!root) {
    console.error(`不支持的平台: ${process.platform}`)
    process.exit(1)
  }
  return root
}

const shouldBuild = process.argv.includes('--build')
if (shouldBuild) {
  console.log('正在构建...')
  execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') })
}

const pluginRoot = resolvePluginRoot()
const srcDist = path.resolve(__dirname, '..', 'dist')
const destDist = path.join(pluginRoot, 'dist')
const srcPkg = path.resolve(__dirname, '..', 'package.json')
const destPkg = path.join(pluginRoot, 'package.json')

if (!fs.existsSync(srcDist)) {
  console.error('dist/ 目录不存在，请先运行 npm run build')
  process.exit(1)
}

fs.mkdirSync(pluginRoot, { recursive: true })
const copied = copyDirSync(srcDist, destDist)
fs.copyFileSync(srcPkg, destPkg)

console.log(`已部署 ${copied} 个文件到 ${destDist}`)
console.log(`package.json 已同步到 ${destPkg}`)
console.log('请重启 Tabby 使插件生效')
