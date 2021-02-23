import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';

export const command = 'get <id>';

export const desc = 'Get Content Item';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Item ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentItem: ContentItem = await client.contentItems.get(argv.id);
  new DataPresenter(contentItem.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
