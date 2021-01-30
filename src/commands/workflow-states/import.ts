import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import { WorkflowState } from 'dc-management-sdk-js';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ImportSettingsBuilderOptions } from '../../interfaces/import-settings-builder-options.interface';
import { FileLog } from '../../common/file-log';
import { getDefaultLogPath } from '../../common/log-helpers';
import { asyncQuestion } from '../../common/archive/archive-helpers';
import { readFile } from 'fs';
import { promisify } from 'util';

export type Answer = {
  answer?: string[];
};

export const command = 'import <filePath>';

export const desc = 'Import Workflow States';

export const LOG_FILENAME = (platform: string = process.platform): string =>
  getDefaultLogPath('workflow-states', 'import', platform);

export const builder = (yargs: Argv): void => {
  yargs
    .positional('filePath', {
      describe: 'Source file path containing Workflow States definition',
      type: 'string'
    })
    .option('logFile', {
      type: 'string',
      default: LOG_FILENAME,
      describe: 'Path to a log file to write to.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'Overwrite workflow states without asking.'
    });
};

export const handler = async (
  argv: Arguments<ImportSettingsBuilderOptions & ConfigurationParameters & Answer>
): Promise<void> => {
  const { filePath: sourceFile, logFile, force, answer = true } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  const publishedWorkflowStatesObject = await hub.related.workflowStates.list();
  const publishedWorkflowStates = publishedWorkflowStatesObject.getItems();

  const log = typeof logFile === 'string' || logFile == null ? new FileLog(logFile) : logFile;

  try {
    const exportedWorkflowStates = await promisify(readFile)(sourceFile, { encoding: 'utf8' });
    let importWorkflowStates = JSON.parse(exportedWorkflowStates);

    // Retrieve list of published Workflow States for comparison
    const publishedWorkflowStatesIDs = publishedWorkflowStates.map((x: WorkflowState) => x.id);
    const importWorkflowStatesIDs = importWorkflowStates.map((x: WorkflowState) => x.id);
    const alreadyExists = publishedWorkflowStatesIDs.filter(x => importWorkflowStatesIDs.includes(x));

    if (alreadyExists.length > 0) {
      const question = !force
        ? await asyncQuestion(
            `${alreadyExists.length}/${importWorkflowStatesIDs.length} of the workflow states being imported already exist in the hub. Would you like to update these workflow states instead of skipping them? (y/n) `
          )
        : answer;

      const updateExisting = question || force;

      if (!updateExisting) {
        importWorkflowStates = importWorkflowStates.filter((item: WorkflowState) => !publishedWorkflowStatesIDs.includes(item.id));
      }
    }
    await Promise.all(
      importWorkflowStates.map(async (item: WorkflowState) => {
        const exists = publishedWorkflowStatesIDs.includes(item.id) ? item.id : undefined;

        if (exists) {
          const state = await client.workflowStates.get(exists);

          await state.related.update(
            new WorkflowState({
              label: item.label,
              color: item.color
            })
          );

          log.addAction('UPDATE', exists);
        } else {
          const newItem = await hub.related.workflowStates.create(
            new WorkflowState({
              label: item.label,
              color: item.color
            })
          );

          log.addAction('CREATE', newItem.id || '');
        }
      })
    );

    log.appendLine('Done!');

    if (log) {
      await log.close();
    }

    process.stdout.write('\n');
  } catch (e) {
    console.log(e);
  }
};
