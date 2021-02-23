import DataPresenter, { RenderingOptions, RenderingArguments } from '../../view/data-presenter';

import { ConfigurationParameters } from '../configure';
import { Arguments, Argv } from 'yargs';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { WorkflowState } from 'dc-management-sdk-js';
import { singleItemTableOptions } from '../../common/table/table.consts';

export const command = 'update <id>';

export const desc = 'Update a Workflow State';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      type: 'string',
      describe: 'workflow-state ID'
    })
    .options({
      label: {
        type: 'string',
        describe: 'workflow-state label'
      },
      color: {
        type: 'string',
        describe: 'workflow-state color'
      },
      ...RenderingOptions
    });
};

interface WorkflowStateUpdateBuilderOptions {
  id: string;
  label?: string;
  color?: string;
}

export const handler = async (
  argv: Arguments<WorkflowStateUpdateBuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const { id, label, color } = argv;
  const workflowState = await client.workflowStates.get(id);
  const mutatedWorkflowState = new WorkflowState({
    ...(label ? { label } : {}),
    ...(color ? { color } : {}),
    _links: workflowState._links
  });
  const updatedWorkflowState = await workflowState.related.update(mutatedWorkflowState);

  new DataPresenter(updatedWorkflowState.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
