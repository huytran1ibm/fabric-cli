import * as FabricClient from 'fabric-client';
import { installChaincode } from './install-chaincode';
import FabricHelper from './FabricHelper';
import { DEFAULT_CHAINCODE_TYPE } from './constants';

const EXAMPLE_CHAINCODE_PATH = '/tmp/my_chaincode_src_dir/';
const EXAMPLE_CHAINCODE_NAME = 'examplechaincode';
const EXAMPLE_CHAINCODE_VERSION = '002';
const EXAMPLE_CHANNEL_NAME = 'examplechannel';
const EXAMPLE_CRYPTO_DIR_PATH = `${__dirname}/..`;
const EXAMPLE_CHAINCODE_LANGUAGE1 = 'node';

const PATH_TO_EXAMPLE_NETWORK_CONFIG = `${__dirname}/../../testData/example-network-config.json`;
let exampleNetworkConfig: any = require(PATH_TO_EXAMPLE_NETWORK_CONFIG);
exampleNetworkConfig = exampleNetworkConfig['network-config'];

const EXAMPLE_ORGS = ['org1', 'org2', 'org3'];

describe('Install chaincode', () => {
    describe('installChaincode', () => {
        beforeAll(() => {
            (FabricClient.prototype.installChaincode as any) = jest.fn();
            (FabricHelper.inspectProposalResponses as any) = jest.fn();
            (FabricClient.Channel.prototype.getPeers as any) = jest.fn(() => {
                return [];
            });
        });
        afterEach(() => {
            jest.clearAllMocks();
        });
        it('should call FabricClient.installChaincode with the expected request', async () => {
            const exampleRequest: FabricClient.ChaincodeInstallRequest = {
                targets: [],
                chaincodePath: EXAMPLE_CHAINCODE_PATH,
                chaincodeId: EXAMPLE_CHAINCODE_NAME,
                chaincodeVersion: EXAMPLE_CHAINCODE_VERSION,
                chaincodeType: EXAMPLE_CHAINCODE_TYPE
            };

            await installChaincode(
                EXAMPLE_CONNECTION_PROFILE_PATH,
                EXAMPLE_CHANNEL_NAME,
                EXAMPLE_CHAINCODE_NAME,
                EXAMPLE_CHAINCODE_PATH,
                EXAMPLE_CHAINCODE_VERSION,
                EXAMPLE_ORGNAME,
                EXAMPLE_CHAINCODE_TYPE,
                EXAMPLE_CREDENTIAL_FILE_PATH
            );

            expect(FabricClient.prototype.installChaincode).toBeCalledTimes(1);
            expect(FabricClient.prototype.installChaincode).toBeCalledWith(exampleRequest);

        });
        it('should default the chaincodeType to "golang" if non is supplied', async () => {
            const exampleRequest: FabricClient.ChaincodeInstallRequest = {
                targets: [],
                chaincodePath: EXAMPLE_CHAINCODE_PATH,
                chaincodeId: EXAMPLE_CHAINCODE_NAME,
                chaincodeVersion: EXAMPLE_CHAINCODE_VERSION,
                chaincodeType: DEFAULT_CHAINCODE_TYPE
            };

            await installChaincode(
                EXAMPLE_CONNECTION_PROFILE_PATH,
                EXAMPLE_CHANNEL_NAME,
                EXAMPLE_CHAINCODE_NAME,
                EXAMPLE_CHAINCODE_PATH,
                EXAMPLE_CHAINCODE_VERSION,
                EXAMPLE_ORGNAME,
                DEFAULT_CHAINCODE_TYPE,
                EXAMPLE_CREDENTIAL_FILE_PATH
            );

            expect(FabricClient.prototype.installChaincode).toBeCalledTimes(1);
            expect(FabricClient.prototype.installChaincode).toBeCalledWith(
                exampleRequest
            );
        });
        it('should inspect the proposalResponses', async () => {
            await installChaincode(
                EXAMPLE_CONNECTION_PROFILE_PATH,
                EXAMPLE_CHANNEL_NAME,
                EXAMPLE_CHAINCODE_NAME,
                EXAMPLE_CHAINCODE_PATH,
                EXAMPLE_CHAINCODE_VERSION,
                EXAMPLE_ORGNAME,
                EXAMPLE_CHAINCODE_TYPE,
                EXAMPLE_CREDENTIAL_FILE_PATH
            );

            expect(FabricHelper.inspectProposalResponses).toBeCalledTimes(1);
        });


        it('should throw an error if installChaincode fails', async () => {
            const testError = new Error('Test Error');
            const expectedError = new Error(
                `Error: Failed to send install proposal due to ${testError}`
            );
            (FabricClient.prototype.installChaincode as any) = jest.fn(() => {
                throw testError;
            });

            await expect(
                installChaincode(
                    EXAMPLE_CONNECTION_PROFILE_PATH,
                    EXAMPLE_CHANNEL_NAME,
                    EXAMPLE_CHAINCODE_NAME,
                    EXAMPLE_CHAINCODE_PATH,
                    EXAMPLE_CHAINCODE_VERSION,
                    EXAMPLE_ORGNAME,
                    EXAMPLE_CHAINCODE_TYPE,
                    EXAMPLE_CREDENTIAL_FILE_PATH
                )
            ).rejects.toThrow(expectedError);
        });
    });
});
