export abstract class Logger {
  abstract warn (...args: any[]): void
  abstract info (...args: any[]): void
  abstract debug (...args: any[]): void
}

export class ConsoleLogger extends Logger {
  warn (...args: any[]): void {}
  info (...args: any[]): void {}
  debug (...args: any[]): void {}
}

export abstract class LogService {
  abstract create (name: string): Logger
}
