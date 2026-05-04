// 测试环境模块 mock 注册
// 在测试运行前拦截对 tabby-core、tabby-terminal、tabby-settings 的 require，
// 用轻量 mock 替代，避免 ngx-toastr 等外部依赖缺失导致的加载失败

const Module = require('module')

const originalResolveFilename = Module._resolveFilename

const mockMap: Record<string, any> = {
  'tabby-core': {
    ConfigService: class ConfigService {},
    LogService: class LogService {},
    Logger: class Logger {
      warn () {}
      info () {}
      debug () {}
    },
  },
  'tabby-terminal': {
    TerminalDecorator: class TerminalDecorator {
      attach () {}
      detach () {}
    },
    BaseTerminalTabComponent: class BaseTerminalTabComponent {},
  },
  'tabby-settings': {
    SettingsTabProvider: class SettingsTabProvider {},
  },
  'ngx-toastr': {},
}

Module._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (mockMap[request]) {
    return request
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const originalLoad = Module._load
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (mockMap[request]) {
    return mockMap[request]
  }
  return originalLoad.call(this, request, parent, isMain)
}
