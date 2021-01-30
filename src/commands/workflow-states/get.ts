import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { WorkflowState } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';

export const command = 'get <id>';

export const desc = 'Get Workflow State';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Workflow State ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const workflowState: WorkflowState = await client.workflowStates.get(argv.id);
  new DataPresenter(workflowState.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
