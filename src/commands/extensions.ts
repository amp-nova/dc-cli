import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'extensions';

export const desc = 'Extensions';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('extensions', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
