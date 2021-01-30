import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'indexes';

export const desc = 'Indexes';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('indexes', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
