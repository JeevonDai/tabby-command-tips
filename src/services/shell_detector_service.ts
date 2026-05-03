/** Shell 检测服务：通过环境变量或进程名识别当前 Shell 类型及历史文件路径。 */

import { Injectable } from '@angular/core'
import { LogService, Logger } from 'tabby-core'

/** Shell 检测结果，包含类型标识和对应的历史文件路径。 */
export interface ShellInfo {
  type: 'bash' | 'zsh' | 'fish' | 'powershell' | 'unknown'
  historyFile: string | null
}

/** Shell 名称到类型和历史文件路径的映射表。 */
const SHELL_MAP: Record<string, { type: ShellInfo['type']; historyFile: string }> = {
  bash: {
    type: 'bash',
    historyFile: '~/.bash_history',
  },
  zsh: {
    type: 'zsh',
    historyFile: '~/.zsh_history',
  },
  fish: {
    type: 'fish',
    historyFile: '~/.local/share/fish/fish_history',
  },
  pwsh: {
    type: 'powershell',
    historyFile: '~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt',
  },
  powershell: {
    type: 'powershell',
    historyFile: '~/.local/share/powershell/PSReadLine/ConsoleHost_history.txt',
  },
}

/** Shell 检测器，优先通过环境变量识别，回退到进程名匹配。 */
@Injectable()
export class ShellDetectorService {
  private readonly logger: Logger

  constructor (private log: LogService) {
    this.logger = log.create('command-tips')
  }

  /** 从 SHELL 环境变量识别 Shell 类型。 */
  public detectFromEnv (env: Record<string, string>): ShellInfo {
    const shellPath = env.SHELL
    if (!shellPath) {
      return { type: 'unknown', historyFile: null }
    }
    return this.matchShellFromPath(shellPath)
  }

  /** 从终端进程名称识别 Shell 类型，支持 .exe 后缀。 */
  public detectFromProcessName (processName: string): ShellInfo {
    const clean = processName.replace(/\.exe$/i, '').toLowerCase()
    if (SHELL_MAP[clean]) {
      return { ...SHELL_MAP[clean] }
    }
    for (const [key, value] of Object.entries(SHELL_MAP)) {
      if (clean.includes(key)) {
        return { ...value }
      }
    }
    return { type: 'unknown', historyFile: null }
  }

  /** 综合检测：优先使用环境变量，回退到进程名匹配。 */
  public detect (env: Record<string, string>, processName: string): ShellInfo {
    const fromEnv = this.detectFromEnv(env)
    if (fromEnv.type !== 'unknown') {
      return fromEnv
    }
    return this.detectFromProcessName(processName)
  }

  private matchShellFromPath (shellPath: string): ShellInfo {
    const parts = shellPath.split('/')
    const basename = parts[parts.length - 1].toLowerCase()
    if (SHELL_MAP[basename]) {
      return { ...SHELL_MAP[basename] }
    }
    return { type: 'unknown', historyFile: null }
  }
}
