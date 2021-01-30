import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { Hub, WorkflowState } from 'dc-management-sdk-js';
import { nothingExportedExit, promptToExportSettings, writeJsonToFile } from '../../services/export.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';
import ArchiveOptions from '../../common/archive/archive-options';

export const command = 'export <dir>';

export const desc = 'Export Workflow States';

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Output directory for the exported Workflow States',
    type: 'string'
  })
  .alias('f', 'force')
  .option('f', {
    type: 'boolean',
    boolean: true,
    describe: 'If present, there will be no confirmation prompt before exporting workflow states.'
  });
};

export const processWorkflowStates = async (
  outputDir: string,
  hubToExport: Hub,
  workflowStates: WorkflowState[],
  force: boolean | undefined
): Promise<void> => {
  const { id, name, label } = hubToExport;
  let dir = outputDir;
  if (outputDir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }
  const file = path.basename(`workflow-states-${id}-${name}`, '.json');

  const uniqueFilename = dir + path.sep + file + '.json';

  if (!force) {
    if (!(await promptToExportSettings(uniqueFilename))) {
      return nothingExportedExit();
   }
  }

  writeJsonToFile(uniqueFilename, workflowStates);

  process.stdout.write('Workflow States exported successfully! \n');
};

export const handler = async (argv: Arguments<ArchiveOptions & ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir, force } = argv;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const workflowStates = await paginator(hub.related.workflowStates.list);

  await processWorkflowStates(dir, hub, workflowStates, force);
};
