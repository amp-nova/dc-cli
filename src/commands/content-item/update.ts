import { Arguments, Argv } from 'yargs';
import DataPresenter, { RenderingArguments, RenderingOptions } from '../../view/data-presenter';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { ContentItem } from 'dc-management-sdk-js';
import { ConfigurationParameters } from '../configure';
import { singleItemTableOptions } from '../../common/table/table.consts';
import BuilderOptions from '../../interfaces/builder-options';
import { readFile } from 'fs';
import { promisify } from 'util';
import { PublishQueue } from '../../common/import/publish-queue';

export const command = 'update <id> <file>';

export const desc = 'Get Content Item';

interface UpdateContext {
  file: string;
}

export const builder = (yargs: Argv): void => {
  yargs
    .positional('id', {
      describe: 'Content Item ID',
      type: 'string'
    })
    .positional('file', {
      describe: 'File with Content Item update data',
      type: 'string'
    })
    .option('publish', {
      type: 'boolean',
      boolean: true,
      describe: 'Publish content item.'
    })
    .options(RenderingOptions);
};

export const handler = async (
  argv: Arguments<BuilderOptions & ConfigurationParameters & RenderingArguments & UpdateContext>
): Promise<void> => {
  const client = dynamicContentClientFactory(argv);

  const contentItem: ContentItem = await client.contentItems.get(argv.id);
  const updateContent = await promisify(readFile)(argv.file, { encoding: 'utf8' });
  const updateJson = JSON.parse(updateContent);
  contentItem.related.update(updateJson);

  if (argv.publish) {
    const pubQueue = new PublishQueue(argv);
    await pubQueue.publish(contentItem);
  }

  new DataPresenter(contentItem.toJSON()).render({
    json: argv.json,
    tableUserConfig: singleItemTableOptions
  });
};
