'use strict';

const childProcess = require('node:child_process');
const { EventEmitter } = require('node:events');

function createFakeChildProcess() {
  const child = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;
  child.unref = () => child;
  child.ref = () => child;
  child.pid = 0;
  return child;
}

function isNetUseCommand(command, args = []) {
  const normalizedCommand = String(command ?? '').trim().toLowerCase();
  const firstArg = Array.isArray(args) ? String(args[0] ?? '').trim().toLowerCase() : '';

  return normalizedCommand === 'net use'
    || (normalizedCommand === 'net' && firstArg === 'use');
}

function respond(callback, error, stdout = '', stderr = '') {
  if (typeof callback === 'function') {
    queueMicrotask(() => callback(error, stdout, stderr));
  }
}

const originalExec = childProcess.exec;
childProcess.exec = function patchedExec(command, options, callback) {
  if (isNetUseCommand(command)) {
    const child = createFakeChildProcess();
    respond(typeof options === 'function' ? options : callback, null, '', '');
    return child;
  }

  return originalExec.call(this, command, options, callback);
};

const originalExecFile = childProcess.execFile;
childProcess.execFile = function patchedExecFile(file, args, options, callback) {
  if (isNetUseCommand(file, args)) {
    const child = createFakeChildProcess();
    respond(typeof options === 'function' ? options : callback, null, '', '');
    return child;
  }

  return originalExecFile.call(this, file, args, options, callback);
};
