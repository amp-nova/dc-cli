import { Arguments } from 'yargs';
import { CommandOptions } from '../../interfaces/command-options.interface';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import { ConfigurationParameters } from '../configure';
import { SortingOptions, PagingParameters } from '../../common/yargs/sorting-options';
import { FetchClientService } from '../../services/fetch-client-service-class';

export const command = 'list';

export const desc = "List Extensions";

export const builder: CommandOptions = {
  ...SortingOptions,
  ...RenderingOptions
};

export const itemMapFn = ({ id, label}: any): object => {
  return { ID: id, Label: label };
};

export const handler = async (
  argv: Arguments<ConfigurationParameters & RenderingArguments & PagingParameters>
): Promise<void> => {
  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);

  // Retrieve extensions list using fetch client as
  // extensions are not in dc-management-sdk scope for now
  const extensionsList = await fetchClient.getExtensionsList();

  new DataPresenter(extensionsList).render({
    json: argv.json,
    itemMapFn: itemMapFn
  });
};
