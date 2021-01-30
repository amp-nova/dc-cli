import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'hierarchies';

export const desc = 'Hierarchies';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('hierarchies', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
