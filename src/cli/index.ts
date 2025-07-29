#!/usr/bin/env node

import { Command } from 'commander';
import { mapCommand } from './commands/map';
import { analyzeCommand } from './commands/analyze';
import { checkCommand } from './commands/check';
import { visualizeCommand } from './commands/visualize';
import { htmlCommand } from './commands/html';
import { diffCommand } from './commands/diff';
import { assemblyCommand } from './commands/assembly';
import { crossContractCommand } from './commands/cross-contract';
import { detectCommand } from './commands/detect';

const program = new Command();

program
  .name('slot-surgeon')
  .description('CLI tooling for Ethereum storage slot mapping and analysis')
  .version('0.1.0');

program.addCommand(analyzeCommand);
program.addCommand(mapCommand);
program.addCommand(checkCommand);
program.addCommand(visualizeCommand);
program.addCommand(htmlCommand);
program.addCommand(diffCommand);
program.addCommand(assemblyCommand);
program.addCommand(crossContractCommand);
program.addCommand(detectCommand);

program.parse();
