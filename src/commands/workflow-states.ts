import { Argv } from 'yargs';
import YargsCommandBuilderOptions from '../common/yargs/yargs-command-builder-options';

export const command = 'workflow-states';

export const desc = 'Workflow States';

export const builder = (yargs: Argv): Argv =>
  yargs
    .commandDir('workflow-states', YargsCommandBuilderOptions)
    .demandCommand()
    .help();

export const handler = (): void => {
  /* do nothing */
};
