import { jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';


beforeAll(async () => {

  const fixturesPath = path.join(__dirname, 'fixtures');
  await fs.ensureDir(fixturesPath);
});

afterAll(async () => {

  const tempPath = path.join(__dirname, 'temp');
  if (await fs.pathExists(tempPath)) {
    await fs.remove(tempPath);
  }
});


global.mockConsole = () => {
  const consoleMock = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  };

  jest.spyOn(console, 'log').mockImplementation(consoleMock.log);
  jest.spyOn(console, 'error').mockImplementation(consoleMock.error);
  jest.spyOn(console, 'warn').mockImplementation(consoleMock.warn);
  jest.spyOn(console, 'info').mockImplementation(consoleMock.info);

  return consoleMock;
};
