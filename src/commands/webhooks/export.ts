import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import paginator from '../../common/dc-management-sdk-js/paginator';
import { Hub, Webhook } from 'dc-management-sdk-js';
import { nothingExportedExit, promptToExportSettings, writeJsonToFile } from '../../services/export.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';
import ArchiveOptions from '../../common/archive/archive-options';

export const command = 'export <dir>';

export const desc = 'Export Webhooks';

export interface ExportWebhooksOptions {
  excludeSearch?: boolean;
}

export const builder = (yargs: Argv): void => {
  yargs
    .positional('dir', {
      describe: 'Output directory for the exported Webhooks',
      type: 'string'
    })
    .option('excludeSearch', {
      type: 'boolean',
      boolean: true,
      describe: 'Exclude search index integration webhooks.'
    })
    .alias('f', 'force')
    .option('f', {
      type: 'boolean',
      boolean: true,
      describe: 'If present, there will be no confirmation prompt before exporting webhooks.'
    });
};

export const processWebhooks = async (
  outputDir: string,
  hubToExport: Hub,
  webhooks: Webhook[],
  force: boolean | undefined
): Promise<void> => {
  const { id, name, label } = hubToExport;
  let dir = outputDir;
  if (outputDir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }
  const file = path.basename(`webhooks-${id}-${name}`, '.json');

  const uniqueFilename = dir + path.sep + file + '.json';

  if (!force) {
    if (!(await promptToExportSettings(uniqueFilename))) {
      return nothingExportedExit();
    }
  }

  writeJsonToFile(uniqueFilename, webhooks);

  process.stdout.write('Webhooks exported successfully! \n');
};

export const handler = async (
  argv: Arguments<ArchiveOptions & ExportBuilderOptions & ConfigurationParameters & ExportWebhooksOptions>
): Promise<void> => {
  const { dir, excludeSearch, force } = argv;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  let webhooks = await paginator(hub.related.webhooks.list);

  if (excludeSearch) {
    webhooks = webhooks.filter((item: any) => !item.label.startsWith('Search Index: '));
  }
  await processWebhooks(dir, hub, webhooks, force);
};
