import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';
import { FetchClientService } from '../../services/fetch-client-service-class';

export const command = 'get-search-api-key <indexId> <keyId>';

export const desc = 'Get Search API Key';

export type Key = {
  keyId: string;
};

export const builder = (yargs: Argv): void => {
  yargs
    .positional('indexId', {
      describe: 'Index ID',
      type: 'string'
    })
    .positional('keyId', {
      describe: 'Key ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments & Key>
): Promise<void> => {
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);

  const apiKey = await fetchClient.getSearchApiKey(argv.indexId, argv.keyId);

  new DataPresenter(apiKey).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
