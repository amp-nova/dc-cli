import { Arguments, Argv } from 'yargs';
import { ConfigurationParameters } from '../configure';
import dynamicContentClientFactory from '../../services/dynamic-content-client-factory';
import { DynamicContent, Hub, Webhook } from 'dc-management-sdk-js';
import { nothingExportedExit, promptToExportSettings, writeJsonToFile } from '../../services/export.service';
import { ExportBuilderOptions } from '../../interfaces/export-builder-options.interface';
import * as path from 'path';

export const command = 'export <id> <dir>';

export const desc = 'Export Hierarchy';

export const builder = (yargs: Argv): void => {
  yargs
  .positional('id', {
    describe: 'Root Node ID',
    type: 'string',
    requiresArg: true
  })
  .positional('dir', {
    describe: 'Output directory for the exported Hierarchy',
    type: 'string',
    requiresArg: true
  });
};

export const processHierarchy = async (
  outputDir: string,
  hubToExport: Hub,
  nodeId: any,
  hierarchy: any
): Promise<void> => {
  const { id, name } = hubToExport;
  let dir = outputDir;
  if (outputDir.substr(-1) === path.sep) {
    dir = dir.slice(0, -1);
  }
  const file = path.basename(`hierarchy-${id}-${name}-${nodeId}`, '.json');

  const uniqueFilename = dir + path.sep + file + '.json';

  if (!(await promptToExportSettings(uniqueFilename))) {
    return nothingExportedExit();
  }

  writeJsonToFile(uniqueFilename, hierarchy);

  process.stdout.write('Hierarchy exported successfully! \n');
};

/**
 * Build a hierarchy model of Content Item from a node
 * @param client DynamicContent client
 * @param nodeId Node to start from, usually a root node (eg. Pages, Taxonomies, Configuration)
 * @param model Model being built
 * @param parentId Parent ID for the current node being visited
 * @param level Current depth level in the recursion
 * @param depth Maximym depth (999) in case of a loop
 */
async function buildHierarchyModel(
    client: DynamicContent, 
    nodeId: any, 
    model: any, 
    parentId: any = null, 
    level: number = 0, 
    depth: number = 999) {
  if (level > depth) return;
  var item = await client.hierarchies.children.get(nodeId);
  console.log(item.label + " - id: " + item.id + ", parentId: " + parentId);
  var childrenModel: any[] = [];
  var contentItem = await client.contentItems.get(item.id);
  model.push({
      id: item.id,
      label: item.label,
      contentItem,
      children: childrenModel
  });
  var children = item.children;

  // Children order doesn't matter so we can get them all in parallel
  await Promise.all(
    children.map((item: any) => buildHierarchyModel(client, item.id, childrenModel, nodeId, level + 1, depth))
  );

  // Previous implementation
  // for(let i = 0; i < children.length; i++) {
  //   await buildHierarchyModel(client, children[i].id, childrenModel, nodeId, level + 1, depth);
  // }
}

export const handler = async (argv: Arguments<ExportBuilderOptions & ConfigurationParameters>): Promise<void> => {
  const { dir } = argv;

  const client = dynamicContentClientFactory(argv);
  const hub = await client.hubs.get(argv.hubId);
  let hierarchy: any[] = [];
  await buildHierarchyModel(client, argv.id, hierarchy);

  if (hierarchy.length > 0)
    await processHierarchy(dir, hub, argv.id, hierarchy[0]);
};
