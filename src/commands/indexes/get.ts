import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';
import { FetchClientService } from '../../services/fetch-client-service-class';

export const command = 'get <id>';

export const desc = 'Get Index';

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Index ID',
      type: 'string'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments>
): Promise<void> => {
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);

  const index = await fetchClient.getIndex(argv.id);

  new DataPresenter(index).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
