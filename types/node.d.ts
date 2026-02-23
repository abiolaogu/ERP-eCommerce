declare module 'crypto' {
  export function randomUUID(): string;
}

declare namespace NodeJS {
  interface Process {
    env: Record<string, string | undefined>;
    exit(code?: number): never;
    on(event: 'SIGINT' | 'SIGTERM', handler: () => void): void;
  }
}

declare const process: NodeJS.Process;
