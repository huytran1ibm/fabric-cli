import * as FabricClient from 'fabric-client';
import FabricHelper from './FabricHelper';
import { invokeChaincode } from './invoke-chaincode';
import { Network, Gateway } from 'fabric-network';


const EXAMPLE_CONNECTION_PROFILE_PATH = '/Users/marcjabbour/Downloads/fabric-cli-master-functional/updatedTestData/connection-profile.json';
const EXAMPLE_CHANNEL_NAME = 'channel1';
const EXAMPLE_CHAINCODE_NAME = 'UnitTests1';
const EXAMPLE_FUNCTION_NAME = 'exampleFunction';
const EXAMPLE_ARGS = [];
const EXAMPLE_ORG = 'org1msp';
const IS_QUERY = true;
const NOT_QUERY = false;
const EXAMPLE_TIMEOUT = 120000;
const EXAMPLE_CREDENTIAL_FILE_PATH = '/Users/marcjabbour/Downloads/fabric-cli-master-functional/updatedTestData/admin-identity-file.json';

const exampleResponsePayload = Buffer.from('Test payload');

const exampleProposalResponse1: any = {
    response: {
        status: 200,
        message: 'test response 1',
        payload: exampleResponsePayload
    }
};

const exampleProposalResponse2: any = {
    response: {
        status: 200,
        message: 'test response 2',
        payload: exampleResponsePayload
    }
};

const exampleBadProposalResponse1: any = {
    response: { status: 400 }
};

const exampleProposal: any = {};

const exampleProposalResponses = [
    [exampleProposalResponse1, exampleProposalResponse2],
    exampleProposal
];

const exampleProposalResponsesWithBad = [
    [
        exampleProposalResponse1,
        exampleBadProposalResponse1,
        exampleProposalResponse2
    ]
];

const exampleBroadcastResponse = {
    status: 'SUCCESS'
};

const exampleBroadcastResponseBad = {
    status: 'BAD',
    info: 'Test bad response'
};

const exampleInvokeResult = {
    message: 'test response 1',
    payload: 'Test payload',
    status: 200
};

const exampleTx: FabricClient.TransactionId = {
    getTransactionID: jest.fn(() => {
        return 'testTxId';
    }),
    getNonce: jest.fn(),
    isAdmin: jest.fn()
};

describe('invokeChaincode', () => {
    let emptyGatewayObj = new Gateway();
    let emptyClientObj = new FabricClient();
    let emptyNetworkObj : Network = {
        getChannel: jest.fn(),
        getContract: jest.fn(),
        addBlockListener: jest.fn(),
        addCommitListener: jest.fn()
    };
    let emptyChannelObj = new FabricClient.Channel(EXAMPLE_CHANNEL_NAME, emptyClientObj);
    beforeEach(async () => {
        (FabricHelper.prototype.getGateway as any) = jest.fn(() => {
            return emptyGatewayObj;
        });
        (emptyGatewayObj.getClient as any) = jest.fn(()  =>  {
            return emptyClientObj;
        });
        (emptyGatewayObj.getNetwork as any) = jest.fn(()  =>  {
            return emptyNetworkObj;
        });
        (emptyNetworkObj.getChannel as any) = jest.fn(()  =>  {
            return emptyChannelObj;
        });
        (FabricHelper.prototype.getOrgAdmin as any) = jest.fn(() => {
            return new FabricClient.User(null);
        });
        (FabricClient.prototype.newTransactionID as any) = jest.fn(() => {
            return exampleTx;
        });
    });

    it(`should return a response object on successful invoke`, async () => {
        (FabricClient.Channel.prototype.initialize as any) = jest.fn();
        (FabricClient.Channel.prototype
            .sendTransactionProposal as any) = jest.fn(() => {
            return exampleProposalResponses;
        });
        (FabricClient.Channel.prototype.sendTransaction as any) = jest.fn(
            () => {
                return exampleBroadcastResponse;
            }
        );

        (FabricHelper.registerAndConnectTxEventHub as any) = jest.fn();

        const result = await invokeChaincode(
            EXAMPLE_CONNECTION_PROFILE_PATH,
            EXAMPLE_CHANNEL_NAME,
            EXAMPLE_CHAINCODE_NAME,
            EXAMPLE_FUNCTION_NAME,
            EXAMPLE_ARGS,
            EXAMPLE_ORG,
            NOT_QUERY,
            EXAMPLE_TIMEOUT,
            EXAMPLE_CREDENTIAL_FILE_PATH
        );

        expect(result).toEqual(exampleInvokeResult);
    });

    it(`should call sendTransactionProposal with the expected request object`, async () => {
        (FabricClient.Channel.prototype.initialize as any) = jest.fn();
        (FabricClient.Channel.prototype
            .sendTransactionProposal as any) = jest.fn(() => {
            return exampleProposalResponses;
        });
        (FabricClient.Channel.prototype.sendTransaction as any) = jest.fn(
            () => {
                return exampleBroadcastResponse;
            }
        );


        (FabricHelper.registerAndConnectTxEventHub as any) = jest.fn();

        await invokeChaincode(
            EXAMPLE_CONNECTION_PROFILE_PATH,
            EXAMPLE_CHANNEL_NAME,
            EXAMPLE_CHAINCODE_NAME,
            EXAMPLE_FUNCTION_NAME,
            EXAMPLE_ARGS,
            EXAMPLE_ORG,
            NOT_QUERY,
            EXAMPLE_TIMEOUT,
            EXAMPLE_CREDENTIAL_FILE_PATH
        );

        const request: FabricClient.ChaincodeInvokeRequest = {
            chaincodeId: EXAMPLE_CHAINCODE_NAME,
            args: EXAMPLE_ARGS,
            txId: exampleTx,
            fcn: EXAMPLE_FUNCTION_NAME
        };

        expect(
            FabricClient.Channel.prototype.sendTransactionProposal
        ).toBeCalledTimes(1);
        expect(
            FabricClient.Channel.prototype.sendTransactionProposal
        ).toBeCalledWith(request, EXAMPLE_TIMEOUT);
    });

    it(`should call channel.sendTransaction with the expected transaction request`, async () => {
        (FabricClient.Channel.prototype.initialize as any) = jest.fn();
        (FabricClient.Channel.prototype
            .sendTransactionProposal as any) = jest.fn(() => {
            return exampleProposalResponses;
        });
        (FabricClient.Channel.prototype.sendTransaction as any) = jest.fn(
            () => {
                return exampleBroadcastResponse;
            }
        );

        (FabricHelper.registerAndConnectTxEventHub as any) = jest.fn();

        await invokeChaincode(
            EXAMPLE_CONNECTION_PROFILE_PATH,
            EXAMPLE_CHANNEL_NAME,
            EXAMPLE_CHAINCODE_NAME,
            EXAMPLE_FUNCTION_NAME,
            EXAMPLE_ARGS,
            EXAMPLE_ORG,
            NOT_QUERY,
            EXAMPLE_TIMEOUT,
            EXAMPLE_CREDENTIAL_FILE_PATH
        );

        const expectedTransactionRequest = {
            proposalResponses: exampleProposalResponses[0],
            proposal: exampleProposalResponses[1]
        };

        expect(FabricClient.Channel.prototype.sendTransaction).toBeCalledTimes(
            1
        );
        expect(FabricClient.Channel.prototype.sendTransaction).toBeCalledWith(
            expectedTransactionRequest,
            EXAMPLE_TIMEOUT
        );
    });

    it(`should not send transaction to channel if 'queryOnly' is true`, async () => {
        (FabricClient.Channel.prototype.initialize as any) = jest.fn();
        (FabricClient.Channel.prototype
            .sendTransactionProposal as any) = jest.fn(() => {
            return exampleProposalResponses;
        });
        (FabricClient.Channel.prototype.sendTransaction as any) = jest.fn(
            () => {
                return exampleBroadcastResponse;
            }
        );

        (FabricClient.prototype.newTransactionID as any) = jest.fn(() => {
            return exampleTx;
        });

        (FabricHelper.registerAndConnectTxEventHub as any) = jest.fn();

        const result = await invokeChaincode(
            EXAMPLE_CONNECTION_PROFILE_PATH,
            EXAMPLE_CHANNEL_NAME,
            EXAMPLE_CHAINCODE_NAME,
            EXAMPLE_FUNCTION_NAME,
            EXAMPLE_ARGS,
            EXAMPLE_ORG,
            IS_QUERY,
            EXAMPLE_TIMEOUT,
            EXAMPLE_CREDENTIAL_FILE_PATH
        );

        expect(FabricClient.Channel.prototype.sendTransaction).toBeCalledTimes(
            0
        );
        expect(result).toEqual(exampleInvokeResult);
    });

    it(`should throw an error if a proposal response is bad`, async () => {
        (FabricClient.Channel.prototype.initialize as any) = jest.fn();
        (FabricClient.Channel.prototype
            .sendTransactionProposal as any) = jest.fn(() => {
            return exampleProposalResponsesWithBad;
        });

        (FabricClient.prototype.newTransactionID as any) = jest.fn(() => {
            return exampleTx;
        });

        (FabricHelper.registerAndConnectTxEventHub as any) = jest.fn();

        const expectedError = new Error(
            `Response null or has a status not equal to 200: { response: { status: 400 } }`
        );

        await expect(
            invokeChaincode(
                EXAMPLE_CONNECTION_PROFILE_PATH,
                EXAMPLE_CHANNEL_NAME,
                EXAMPLE_CHAINCODE_NAME,
                EXAMPLE_FUNCTION_NAME,
                EXAMPLE_ARGS,
                EXAMPLE_ORG,
                NOT_QUERY,
                EXAMPLE_TIMEOUT,
                EXAMPLE_CREDENTIAL_FILE_PATH
            )
        ).rejects.toThrow(expectedError);
    });

    it(`should throw an error if a broadcast response is bad`, async () => {
        (FabricClient.Channel.prototype.initialize as any) = jest.fn();
        (FabricClient.Channel.prototype
            .sendTransactionProposal as any) = jest.fn(() => {
            return exampleProposalResponses;
        });

        (FabricClient.prototype.newTransactionID as any) = jest.fn(() => {
            return exampleTx;
        });

        (FabricClient.Channel.prototype.sendTransaction as any) = jest.fn(
            () => {
                return exampleBroadcastResponseBad;
            }
        );

        (FabricHelper.registerAndConnectTxEventHub as any) = jest.fn();

        const expectedError = new Error(
            `sendTransaction returned with an invalid status code: ${
                exampleBroadcastResponseBad.status
            }: ${exampleBroadcastResponseBad.info}`
        );

        await expect(
            invokeChaincode(
                EXAMPLE_CONNECTION_PROFILE_PATH,
                EXAMPLE_CHANNEL_NAME,
                EXAMPLE_CHAINCODE_NAME,
                EXAMPLE_FUNCTION_NAME,
                EXAMPLE_ARGS,
                EXAMPLE_ORG,
                NOT_QUERY,
                EXAMPLE_TIMEOUT,
                EXAMPLE_CREDENTIAL_FILE_PATH
            )
        ).rejects.toThrow(expectedError);
    });
});
