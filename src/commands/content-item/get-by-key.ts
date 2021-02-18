import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';
import { FetchClientService } from '../../services/fetch-client-service-class';

export const command = 'get-by-key <key>';

export const desc = 'Get Content Item by Delivery Key';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('key', {
      describe: 'Content Item Delivery Key',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);

  const contentItem = await fetchClient.getContentItemByKey(argv.key);
  new DataPresenter(contentItem).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
