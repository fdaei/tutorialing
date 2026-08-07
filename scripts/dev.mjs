import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commands = [
  { name: 'api', args: ['run', 'dev:api'] },
  { name: 'web', args: ['run', 'dev:web'] },
];

const children = commands.map(({ name, args }) => {
  const child = spawn(npm, args, { stdio: 'inherit' });
  child.on('error', (error) => {
    console.error(`Unable to start ${name}: ${error.message}`);
  });
  return child;
});

let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

const exitCodes = await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on('exit', (code, signal) => {
          if (!stopping) stop();
          resolve(signal ? 0 : (code ?? 1));
        });
      }),
  ),
);

process.exitCode = exitCodes.find((code) => code !== 0) ?? 0;
