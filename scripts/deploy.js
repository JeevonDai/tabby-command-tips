#!/usr/bin/env node

/**
 * 将构建产物复制到 Tabby 插件目录，实现快速部署。
 * 用法: node scripts/deploy.js
 */

const fs = require('fs')
const path = require('path')

const PLUGIN_DIR_NAME = 'tabby-commnad-tips'

const APPDATA = process.env.APPDATA || ''
const PLUGIN_BASE = {
  win32: path.join(APPDATA, 'tabby', 'plugins'),
  darwin: path.join(process.env.HOME, 'Library', 'Application Support', 'tabby', 'plugins'),
  linux: path.join(process.env.HOME, '.config', 'tabby', 'plugins'),
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

const platform = process.platform
const baseDir = PLUGIN_BASE[platform]
if (!baseDir) {
  console.error(`不支持的平台: ${platform}`)
  process.exit(1)
}

const srcDist = path.resolve(__dirname, '..', 'dist')
const destDir = path.join(baseDir, PLUGIN_DIR_NAME, 'dist')

if (!fs.existsSync(srcDist)) {
  console.error('dist/ 目录不存在，请先运行 npm run build')
  process.exit(1)
}

const copied = copyDirSync(srcDist, destDir)

// 复制 package.json（Tabby 需要它来识别插件）
const srcPkg = path.resolve(__dirname, '..', 'package.json')
const destPkg = path.join(baseDir, PLUGIN_DIR_NAME, 'package.json')
fs.copyFileSync(srcPkg, destPkg)

console.log(`已部署 ${copied} 个文件到 ${destDir}`)
console.log('package.json 已同步')
console.log('请重启 Tabby 使插件生效')
