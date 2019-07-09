/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import * as path from 'path';
import FabricHelper from './FabricHelper';
import * as FabricClient from 'fabric-client';
import { inspect } from 'util';
import { DEFAULT_CHAINCODE_TYPE } from './constants';

const logger = FabricHelper.getLogger('install-chaincode');

export async function installChaincode(
    connectionProfilePath: string,
    channelName: string,
    chaincodeName: string,
    chaincodePath: string,
    chaincodeVersion: string,
    org: string,
    chaincodeType: FabricClient.ChaincodeType = DEFAULT_CHAINCODE_TYPE,
    credentialFilePath: string
): Promise<void> {
    logger.debug(
        `============ Install chaincode called for organization: ${org} ============`
    );

    let installProposalResponses: [
        (FabricClient.ProposalResponse | Error)[],
        FabricClient.Proposal
    ];

    const helper: FabricHelper = new FabricHelper(
        connectionProfilePath,
        channelName,
        path.join(process.env.HOME, 'fabric-client-kvs'),
        org,
        credentialFilePath
    );

    const gateway = await helper.getGateway();
    if (!gateway){
        logger.info('gateway not found..');
        return
    }
    if (gateway == null || gateway == undefined){
        logger.info('invalid gateway object')
    }

    const client = gateway.getClient();
    const user: FabricClient.User = await helper.getOrgAdmin(org, credentialFilePath);
    const installTargetPeers = client.getPeersForOrg(org);

    logger.debug(`Successfully retrieved admin user: ${user}`);

    const request: FabricClient.ChaincodeInstallRequest = {
        targets: installTargetPeers,
        chaincodePath: chaincodePath,
        chaincodeId: chaincodeName,
        chaincodeVersion: chaincodeVersion,
        chaincodeType: chaincodeType
    };

    logger.debug(
        `Calling client.installChaincode with request: ${inspect(request)}`
    );

    try {
        installProposalResponses = await installChaincodeOnPeersInRequest(
            client,
            request
        );
    } catch (err) {
        throw err;
    }

    FabricHelper.inspectProposalResponses(installProposalResponses);

    // })
    // const peerNames: string = FabricHelper.getPeerNamesAsStringForChannel(
    //     channel
    // );

    logger.info(
        `Successfully installed chaincode (${chaincodeName}) on peers (${installTargetPeers}) for organization ${org}`
    );
}

async function installChaincodeOnPeersInRequest(
    client: FabricClient,
    request: FabricClient.ChaincodeInstallRequest
): Promise<[(FabricClient.ProposalResponse | Error)[], FabricClient.Proposal]> {
    let proposalResponses: [
        (FabricClient.ProposalResponse | Error)[],
        FabricClient.Proposal
    ];

    try {
        logger.debug(
            `calling FabricClient.installchaincode with request: ${inspect(
                request
            )}`
        );
        proposalResponses = await client.installChaincode(request);
    } catch (err) {
        logger.error(`Failed to send install proposal due to error: ` + err);
        throw new Error(`Failed to send install proposal due to error: ` + err);
    }

    return proposalResponses;
}
