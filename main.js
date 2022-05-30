'use strict';

import { initConf } from './conf.js';
import { Octane } from '@microfocus/alm-octane-js-rest-sdk';
import { writeFileSync } from 'fs';

class Main {
    SHAREDSPACE_ENTITIES_METADATA_URL = '/api/shared_spaces/1001/metadata/entities?show_all=true';
    WORKSPACE_ENTITIES_METADATA_URL = '/api/shared_spaces/1001/workspaces/1002/metadata/entities?show_all=true';
    COMMANDS_PER_ENTITYTYPE_URL = '/admin/metadata/commands?entity=PLACEHOLDER&flavor=DEFAULT';

    prepareCommandRequestEntityMetadata(metadata) {
        let requestEntityMetadata = metadata.data.map(e => {
            let isAggregated = e.features.filter(f => f.name == 'subtypes').length > 0;
            if(isAggregated) {
                console.log('Setting Read request only for entity type \'' + e.name + '\' because it is aggregated and will fail CUD commands construction');
            }

            return {
                name: e.name,
                isAggregated: isAggregated,
                commands: isAggregated ? "&service=Read" : "&service=Create&service=Update&service=Delete&service=Read"
            };
        });

        return requestEntityMetadata;
    }

    async gatherCommands(octaneRestClient, commandsRequestMetadata) {
        let commandsPerEntityType = [];
        for (const commandRequestMetadata of commandsRequestMetadata) {
            const commandsUrl = this.COMMANDS_PER_ENTITYTYPE_URL.replace('PLACEHOLDER', commandRequestMetadata.name) + commandRequestMetadata.commands;

            try {
                let commands = await octaneRestClient.executeCustomRequest(commandsUrl, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });
                commandsPerEntityType[commandRequestMetadata.name] = commands;
            } catch(e) {
                console.log('Could not retrieve commands for \'' + commandRequestMetadata.name + '\'');
                console.log('Status: ' + e.response.status + '\nResponse data: ');
                console.log(e.response.data);
            }
        }

        return commandsPerEntityType;
    }

    async run() {
        let conf = initConf();

        const octaneRestClient = new Octane({
            server: conf.octane.server,
            sharedSpace: conf.octane.sharedSpace,
            workspace: conf.octane.workspace,
            user: conf.octane.user,
            password: conf.octane.password,
            headers: conf.octane.headers
        });

        let sharedspaceEntitiesMetadata = await octaneRestClient.executeCustomRequest(this.SHAREDSPACE_ENTITIES_METADATA_URL, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });
        let workspaceEntitiesMetadata = await octaneRestClient.executeCustomRequest(this.WORKSPACE_ENTITIES_METADATA_URL, Octane.operationTypes.get, undefined, { 'ALM-OCTANE-TECH-PREVIEW': true });

        const sharedspaceCommandsRequestEntityMetadata = this.prepareCommandRequestEntityMetadata(sharedspaceEntitiesMetadata);
        const workspaceCommandRequestEntityMetadata = this.prepareCommandRequestEntityMetadata(workspaceEntitiesMetadata);

        const sharedspaceEntityTypesCommands = await this.gatherCommands(octaneRestClient, sharedspaceCommandsRequestEntityMetadata);
        let sharedspaceEntityTypesCommandsCount = this.detectDuplicateCommandsPerService(sharedspaceEntityTypesCommands);
        this.generateReport(sharedspaceEntityTypesCommandsCount, 'sharedspaceCommands.json');

        const workspaceEntityTypesCommands = await this.gatherCommands(octaneRestClient, workspaceCommandRequestEntityMetadata);
        let workSpaceEntityTypesCommandsCount = this.detectDuplicateCommandsPerService(workspaceEntityTypesCommands);
        this.generateReport(workSpaceEntityTypesCommandsCount, 'workspaceCommands.json');
    }

    detectDuplicateCommandsPerService(commandsPerEntityType) {
        let result = {};
        for(const [key, value] of Object.entries(commandsPerEntityType)) {
            result[key] = {};

            for(let i = 0; i < value.length; i++) {
                const resultKey = value[i].service;
                result[key][resultKey] = {};

                for(let j = 0; j < value[i].commands.length; j++) {
                    let command = value[i].commands[j];

                    if(result[key][resultKey][command.name]) {
                        result[key][resultKey][command.name] = result[key][resultKey][command.name] + 1;
                    } else {
                        result[key][resultKey][command.name] = 1;
                    }
                }
            }
        }

        return result;
    }

    generateReport(commandsCountPerEntityTypeOnSpace, reportName, logToConsole) {
        let json = JSON.stringify(commandsCountPerEntityTypeOnSpace);

        if(logToConsole) {
            console.log(json);
        }

        try {
            writeFileSync('./' + reportName, json);
        } catch(e) {
            console.log('Could not generate report: ' + reportName);
        }
    }
}

new Main().run();