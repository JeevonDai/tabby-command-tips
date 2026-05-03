import { Injectable } from '@angular/core'
import { LogService, Logger } from 'tabby-core'

export interface ShellInfo {
  type: 'bash' | 'zsh' | 'fish' | 'powershell' | 'unknown'
  historyFile: string | null
}

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

@Injectable({ providedIn: 'root' })
export class ShellDetectorService {
  private logger: Logger

  constructor (private log: LogService) {
    this.logger = log.create('command-tips')
  }

  detectFromEnv (env: Record<string, string>): ShellInfo {
    const shellPath = env.SHELL
    if (!shellPath) {
      return { type: 'unknown', historyFile: null }
    }
    return this.matchShellFromPath(shellPath)
  }

  detectFromProcessName (processName: string): ShellInfo {
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

  detect (env: Record<string, string>, processName: string): ShellInfo {
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
