import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'webhooks';

export const desc = 'Webhooks';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('webhooks', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
