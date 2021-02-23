import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Webhook } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';

export const command = 'get <id>';

export const desc = 'Get Webhook';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Webhook ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);

  const webhook: Webhook = await hub.related.webhooks.get(argv.id);
  new DataPresenter(webhook.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
