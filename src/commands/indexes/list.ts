import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import { SortingOptions, PagingParameters } from '../../common/yargs/sorting-options';
import { FetchClientService } from '../../services/fetch-client-service-class';

export const command = 'list';

export const desc = 'List Indexes';

export const builder: CommandOptions = {
  ...SortingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({ id, name, type }: any): object => {
  return { ID: id, Name: name, Type: type };
};

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);

  const indexesList = await fetchClient.getIndexesList();

  new DataPresenter(indexesList).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
