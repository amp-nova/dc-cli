import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { Hub } from 'dc-management-sdk-js';
import { nothingExportedExit, promptToExportSettings, writeJsonToFile } from '../../services/export.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';
import { FetchClientService } from '../../services/fetch-client-service-class';

export const command = 'export <dir>';

export const desc = 'Export Extensions';

export const builder = (yargs: Argv): void => {
  yargs.positional('dir', {
    describe: 'Output directory for the exported Extensions',
    type: 'string'
  });
};

export const processExtensions = async (
  outputDir: string,
  hubToExport: Hub,
  extensions: string[]
): Promise<void> => {
  const { id, name } = hubToExport;
  let dir = outputDir;
  if (outputDir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }
  const file = path.basename(`extensions-${id}-${name}`, '.json');

  const uniqueFilename = dir + path.sep + file + '.json';

  if (!(await promptToExportSettings(uniqueFilename))) {
    return nothingExportedExit();
  }

  writeJsonToFile(uniqueFilename, extensions);

  process.stdout.write('Extensions exported successfully! \n');
};

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;
  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);

  const fetchClient = new FetchClientService();
  await fetchClient.init(argv);
  const extensionsList = await fetchClient.getExtensionsList();

  await processExtensions(dir, hub, extensionsList);
};
