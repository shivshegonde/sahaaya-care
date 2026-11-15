import { spawn } from 'node:child_process';

console.log('Starting Sahaaya Care Full-Stack Development Services...');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Start Server on port 4003
const serverProc = spawn(npmCmd, ['run', 'dev:server'], {
  stdio: 'inherit',
  shell: true
});

// 2. Start Vite Client on port 3000
const clientProc = spawn(npmCmd, ['run', 'dev:client'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
