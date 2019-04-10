/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as FabricClient from 'fabric-client';
import * as CaClient from 'fabric-ca-client';
import * as log4js from 'log4js';
import { inspect } from 'util';

const logger = log4js.getLogger('FabricHelper');

const LOGGING_LEVEL = process.env.LOGGING_LEVEL
    ? process.env.LOGGING_LEVEL
    : 'info';

logger.setLevel(LOGGING_LEVEL);
FabricClient.setLogger(logger);

export default class FabricHelper {
    private clients: object;
    private channels: object;
    private ORGS: any;
    private caClients: any;

    private channel: string;
    private keyValueStoreBasePath: string;
    private cryptoDir: string;

    static getLogger(moduleName: string, loggingLevel: string = 'INFO') {
        const logger = log4js.getLogger(moduleName);
        logger.setLevel(loggingLevel);
        return logger;
    }

    constructor(
        networkConfigFilePath: string,
        channelName: string,
        keyValueStoreBasePath: string,
        cryptoDir: string
    ) {
        FabricClient.addConfigFile(networkConfigFilePath);
        this.ORGS = FabricClient.getConfigSetting('network-config');
        this.clients = {};
        this.channels = {};
        this.caClients = {};
        this.channel = channelName;
        this.keyValueStoreBasePath = keyValueStoreBasePath;
        this.cryptoDir = cryptoDir;

        // set up the client and channel objects for each org
        for (const key in this.ORGS) {
            if (key.indexOf('org') === 0) {
                const client = new FabricClient();

                const cryptoSuite = FabricClient.newCryptoSuite();
                cryptoSuite.setCryptoKeyStore(
                    FabricClient.newCryptoKeyStore({
                        path: this.getKeyStoreForOrg(this.ORGS[key].name)
                    })
                );
                client.setCryptoSuite(cryptoSuite);

                const channel = client.newChannel(this.channel);
                channel.addOrderer(this.newOrderer(client));

                this.clients[key] = client;
                this.channels[key] = channel;

                this.setupPeers(channel, key, client);

                const caUrl = this.ORGS[key].ca.url;
                const caName = this.ORGS[key].ca.name;

                logger.info('The Org for this CA is: ' + key);
                logger.info('The CA Name is: ' + caName);
                logger.info('The CA UrL is: ' + caUrl);
                this.caClients[key] = new CaClient(
                    caUrl,
                    null /*defautl TLS opts*/,
                    caName,
                    cryptoSuite
                );
            }
        }
    }

    private getKeyStoreForOrg(org: string): string {
        return this.keyValueStoreBasePath + '_' + org;
    }

    private newOrderer(client: FabricClient): FabricClient.Orderer {
        const caRootsPath = this.ORGS.orderer.tls_cacerts;
        const data = fs.readFileSync(path.join(this.cryptoDir, caRootsPath));
        const caroots = Buffer.from(data).toString();
        return client.newOrderer(this.ORGS.orderer.url, {
            pem: caroots
        });
    }
    private setupPeers(
        channel: FabricClient.Channel,
        org: string,
        client: FabricClient
    ) {
        const orgMspId: string = this.ORGS[org].mspid;

        for (const key in this.ORGS[org].peers) {
            const data = fs.readFileSync(
                path.join(
                    this.cryptoDir,
                    this.ORGS[org].peers[key]['tls_cacerts']
                )
            );

            logger.debug('\nData from file:');
            logger.debug(Buffer.from(data).toString());

            const peer = client.newPeer(this.ORGS[org].peers[key].requests, {
                pem: Buffer.from(data).toString()
            });
            peer.setName(key);

            channel.addPeer(peer, orgMspId);
        }
    }

    private getOrgName(org: string): string {
        logger.debug(`Org name : ${this.ORGS[org].name}`);
        return this.ORGS[org].name;
    }

    private getMspID(org: string): string {
        logger.debug(`MSP ID : ${this.ORGS[org].mspid}`);
        return this.ORGS[org].mspid;
    }

    private readAllFiles(dir: string): string[] {
        let files: any = fs.readdirSync(dir);
        // We should remove hidden files to avoid nasty surprises
        // For instance, macOS may add the infamous .DS_Store file
        files = files.filter((item) => !/(^|\/)\.[^\/\.]/g.test(item));
        const certs = [];
        files.forEach((file_name) => {
            const file_path = path.join(dir, file_name);
            const data = fs.readFileSync(file_path);
            certs.push(data);
        });
        return certs;
    }

    // APIs

    public getChannelForOrg(org: string): FabricClient.Channel {
        return this.channels[org];
    }

    public getClientForOrg(org: string): FabricClient {
        return this.clients[org];
    }

    public async getOrgAdmin(userOrg: string): Promise<FabricClient.User> {
        logger.debug(`Getting org admin for user org: ${userOrg}`);
        const admin = this.ORGS[userOrg].admin;

        const keyPath = path.join(this.cryptoDir, admin.key);
        logger.debug(`Org admin keyPath: ${keyPath}`);
        const keyPEM = Buffer.from(this.readAllFiles(keyPath)[0]).toString();

        const certPath = path.join(this.cryptoDir, admin.cert);
        logger.debug(`The certPath: ${certPath}`);
        const certPEM = this.readAllFiles(certPath)[0].toString();

        const client = this.getClientForOrg(userOrg);
        const cryptoSuite = FabricClient.newCryptoSuite();

        if (userOrg) {
            cryptoSuite.setCryptoKeyStore(
                FabricClient.newCryptoKeyStore({
                    path: this.getKeyStoreForOrg(this.getOrgName(userOrg))
                })
            );
            client.setCryptoSuite(cryptoSuite);
        }

        const store = await FabricClient.newDefaultKeyValueStore({
            path: this.getKeyStoreForOrg(this.getOrgName(userOrg))
        });

        client.setStateStore(store);

        logger.debug(`keyPEM: ${inspect(keyPEM)}`);
        logger.debug(`certPEM: ${inspect(certPEM)}`);

        return await client.createUser({
            username: 'peer' + userOrg + 'Admin',
            mspid: this.getMspID(userOrg),
            cryptoContent: {
                privateKeyPEM: keyPEM,
                signedCertPEM: certPEM
            },
            skipPersistence: true
        });
    }
}

// FabricHelper.prototype.newRemotes = function(names, forPeers, userOrg) {
//     let client = this.getClientForOrg(userOrg);

//     let targets = [];
//     // find the peer that match the names
//     for (let idx in names) {
//         let peerName = names[idx];
//         if (this.ORGS[userOrg].peers[peerName]) {
//             // found a peer matching the name
//             let data = fs.readFileSync(
//                 path.join(
//                     this.cryptoDir,
//                     this.ORGS[userOrg].peers[peerName]['tls_cacerts']
//                 )
//             );
//             let grpcOpts = {
//                 pem: Buffer.from(data).toString(),
//                 'ssl-target-name-override': null
//             };

//             if (forPeers) {
//                 targets.push(
//                     client.newPeer(
//                         this.ORGS[userOrg].peers[peerName].requests,
//                         grpcOpts
//                     )
//                 );
//             } else {
//                 let eh = client.newEventHub();
//                 eh.setPeerAddr(
//                     this.ORGS[userOrg].peers[peerName].events,
//                     grpcOpts
//                 );
//                 targets.push(eh);
//             }
//         }
//     }

//     if (targets.length === 0) {
//         logger.error(
//             util.format('Failed to find peers matching the names %s', names)
//         );
//     }

//     return targets;
// };

// //-------------------------------------//
// // APIs
// //-------------------------------------//

// FabricHelper.prototype.newPeers = function(names, org) {
//     return this.newRemotes(names, true, org);
// };

// FabricHelper.prototype.newEventHubs = function(names, org) {
//     return this.newRemotes(names, false, org);
// };

// FabricHelper.prototype.getAdminUser = function(username, password, userOrg) {
//     var member;
//     var client = this.getClientForOrg(userOrg);

//     return FabricClient.newDefaultKeyValueStore({
//         path: this.getKeyStoreForOrg(this.getOrgName(userOrg))
//     }).then((store) => {
//         client.setStateStore(store);
//         // clearing the user context before switching
//         client._userContext = null;
//         return client.getUserContext(username, true).then((user) => {
//             if (user && user.isEnrolled()) {
//                 logger.info('Successfully loaded member from persistence');
//                 return user;
//             } else {
//                 let caClient = this.caClients[userOrg];
//                 // need to enroll it with CA server
//                 return caClient
//                     .enroll({
//                         enrollmentID: username,
//                         enrollmentSecret: password
//                     })
//                     .then((enrollment) => {
//                         logger.info(
//                             "Successfully enrolled user '" + username + "'"
//                         );
//                         member = new User(username);
//                         member.setCryptoSuite(client.getCryptoSuite());
//                         return member.setEnrollment(
//                             enrollment.key,
//                             enrollment.certificate,
//                             this.getMspID(userOrg)
//                         );
//                     })
//                     .then(() => {
//                         return client.setUserContext(member);
//                     })
//                     .then(() => {
//                         return member;
//                     })
//                     .catch((err) => {
//                         logger.error(
//                             'Failed to enroll and persist user. Error: ' +
//                                 err.stack
//                                 ? err.stack
//                                 : err
//                         );
//                         return null;
//                     });
//             }
//         });
//     });
// };

// FabricHelper.prototype.getRegisteredUsers = function(
//     username,
//     userOrg,
//     isJson
// ) {
//     var member;
//     var client = this.getClientForOrg(userOrg);
//     var enrollmentSecret = null;
//     return FabricClient.newDefaultKeyValueStore({
//         path: this.getKeyStoreForOrg(this.getOrgName(userOrg))
//     })
//         .then((store) => {
//             client.setStateStore(store);
//             // clearing the user context before switching
//             client._userContext = null;
//             return client.getUserContext(username, true).then((user) => {
//                 if (user && user.isEnrolled()) {
//                     logger.info('Successfully loaded member from persistence');
//                     return user;
//                 } else {
//                     let caClient = this.caClients[userOrg];
//                     return this.getAdminUser(userOrg)
//                         .then(function(adminUserObj) {
//                             member = adminUserObj;
//                             return caClient.register(
//                                 {
//                                     enrollmentID: username,
//                                     affiliation: userOrg + '.department1'
//                                 },
//                                 member
//                             );
//                         })
//                         .then(
//                             (secret) => {
//                                 enrollmentSecret = secret;
//                                 logger.debug(
//                                     username + ' registered successfully'
//                                 );
//                                 return caClient.enroll({
//                                     enrollmentID: username,
//                                     enrollmentSecret: secret
//                                 });
//                             },
//                             (err) => {
//                                 logger.debug(username + ' failed to register');
//                                 console.log(err);
//                                 return '' + err;
//                                 //return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
//                             }
//                         )
//                         .then((message) => {
//                             if (
//                                 message &&
//                                 typeof message === 'string' &&
//                                 message.includes('Error:')
//                             ) {
//                                 logger.error(username + ' enrollment failed');
//                                 return message;
//                             }
//                             logger.debug(username + ' enrolled successfully');

//                             member = new User(username);
//                             member._enrollmentSecret = enrollmentSecret;
//                             return member.setEnrollment(
//                                 message.key,
//                                 message.certificate,
//                                 this.getMspID(userOrg)
//                             );
//                         })
//                         .then(
//                             () => {
//                                 client.setUserContext(member);
//                                 return member;
//                             },
//                             (err) => {
//                                 logger.error(
//                                     util.format(
//                                         '%s enroll failed: %s',
//                                         username,
//                                         err.stack ? err.stack : err
//                                     )
//                                 );
//                                 return '' + err;
//                             }
//                         );
//                 }
//             });
//         })
//         .then(
//             (user) => {
//                 if (isJson && isJson === true) {
//                     var response = {
//                         success: true,
//                         secret: user._enrollmentSecret,
//                         message: username + ' enrolled Successfully'
//                     };
//                     return response;
//                 }
//                 return user;
//             },
//             (err) => {
//                 logger.error(
//                     util.format(
//                         'Failed to get registered user: %s, error: %s',
//                         username,
//                         err.stack ? err.stack : err
//                     )
//                 );
//                 return '' + err;
//             }
//         );
// };

// /**
//  * Inspect the result of a proposal and returns true if the prosal result was successful, false otherwise.
//  */
// FabricHelper.prototype.inspectProposalResult = function(proposalResult) {
//     let proposalResponses = proposalResult[0];
//     let proposal = proposalResult[1];
//     let all_good = true;
//     for (var i in proposalResponses) {
//         let one_good = false;
//         if (
//             proposalResponses &&
//             proposalResponses[i].response &&
//             proposalResponses[i].response.status === 200
//         ) {
//             one_good = true;
//             logger.info('Proposal was good');
//         } else {
//             logger.error('Proposal was bad');
//         }
//         all_good = all_good & one_good;
//     }
//     if (all_good) {
//         logger.info(
//             util.format(
//                 'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
//                 proposalResponses[0].response.status,
//                 proposalResponses[0].response.message,
//                 proposalResponses[0].response.payload,
//                 proposalResponses[0].endorsement.signature
//             )
//         );
//     } else {
//         throw new Error(
//             'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200.'
//         );
//     }

//     return all_good;
// };

// FabricHelper.prototype.processChaincodeInstantiateProposal = function(
//     transactionId,
//     proposalResult,
//     org
// ) {
//     var proposalResponses = proposalResult[0];
//     var proposal = proposalResult[1];

//     var request = {
//         proposalResponses: proposalResponses,
//         proposal: proposal
//     };
//     // set the transaction listener and set a timeout of 30sec
//     // if the transaction did not get committed within the timeout period,
//     // fail the test

//     let data = fs.readFileSync(
//         path.join(this.cryptoDir, this.ORGS[org].peers['peer1']['tls_cacerts'])
//     );
//     let tlsCert = Buffer.from(data).toString();

//     let eh = this.getClientForOrg(org).newEventHub();
//     eh.setPeerAddr(this.ORGS[org].peers['peer1']['events'], {
//         pem: tlsCert
//     });
//     eh.connect();

//     let txPromise = new Promise(function(resolve, reject) {
//         let handle = setTimeout(function() {
//             eh.disconnect();
//             reject();
//         }, 30000);
//         eh.registerTxEvent(transactionId, function(tx, code) {
//             logger.info(
//                 'The transaction has been committed on peer ' +
//                     eh._ep._endpoint.addr
//             );
//             clearTimeout(handle);
//             eh.unregisterTxEvent(transactionId);
//             eh.disconnect();

//             if (code !== 'VALID') {
//                 logger.error('The transaction was invalid, code = ' + code);
//                 reject();
//             } else {
//                 logger.info('The chaincode instantiate transaction was valid.');
//                 resolve();
//             }
//         });
//     });
//     let channel = this.getChannelForOrg(org);
//     let sendPromise = channel.sendTransaction(request);
//     return Promise.all([sendPromise].concat([txPromise]));
// };

// FabricHelper.prototype.processChaincodeInvokeProposal = function(
//     transactionId,
//     proposalResult,
//     org
// ) {
//     var proposalResponses = proposalResult[0];
//     var proposal = proposalResult[1];

//     var request = {
//         proposalResponses: proposalResponses,
//         proposal: proposal
//     };
//     // set the transaction listener and set a timeout of 30sec
//     // if the transaction did not get committed within the timeout period,
//     // fail the test

//     let data = fs.readFileSync(
//         path.join(this.cryptoDir, this.ORGS[org].peers['peer1']['tls_cacerts'])
//     );
//     let tlsCert = Buffer.from(data).toString();

//     let eh = this.getClientForOrg(org).newEventHub();
//     eh.setPeerAddr(this.ORGS[org].peers['peer1']['events'], {
//         pem: tlsCert,
//         'ssl-target-name-override': this.ORGS[org].peers['peer1'][
//             'server-hostname'
//         ]
//     });
//     eh.connect();

//     let txPromise = new Promise(function(resolve, reject) {
//         let handle = setTimeout(function() {
//             eh.disconnect();
//             reject();
//         }, 30000);
//         eh.registerTxEvent(transactionId, function(tx, code) {
//             logger.info(
//                 'The transaction has been committed on peer ' +
//                     eh._ep._endpoint.addr
//             );
//             clearTimeout(handle);
//             eh.unregisterTxEvent(transactionId);
//             eh.disconnect();

//             if (code !== 'VALID') {
//                 logger.error('The transaction was invalid, code = ' + code);
//                 reject();
//             } else {
//                 logger.info('The chaincode invoke transaction was valid.');
//                 resolve();
//             }
//         });
//     });
//     let channel = this.getChannelForOrg(org);
//     let sendPromise = channel.sendTransaction(request);
//     return Promise.all([sendPromise].concat([txPromise]));
// };
