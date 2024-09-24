import { Injectable } from '@nestjs/common';
import {
  AnchorMode,
  broadcastTransaction,
  contractPrincipalCV,
  FungibleConditionCode,
  listCV,
  makeContractCall,
  makeContractSTXPostCondition,
  standardPrincipalCV,
  TransactionVersion,
  tupleCV,
  uintCV,
} from '@stacks/transactions';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { env } from 'configs/env.config';

@Injectable()
export class TournamentService {
  private walletConfig: Record<
    HiroChannel,
    {
      txVersion: TransactionVersion;
      network: StacksTestnet | StacksMainnet;
    }
  > = {
    testnet: {
      txVersion: TransactionVersion.Testnet,
      network: new StacksTestnet(),
    },
    mainnet: {
      txVersion: TransactionVersion.Mainnet,
      network: new StacksMainnet(),
    },
  };

  async startNewTournament(data: txData) {
    const networkEnv = env.wallet.network;
    const networkData = this.walletConfig[networkEnv];
    if (!networkData) {
      throw new Error(`Unknown network: ${networkEnv}`);
    }
    const wallet = await generateWallet({
      secretKey: env.wallet.key,
      password: env.wallet.password,
    });
    const account = wallet.accounts[0];
    const senderAddress = getStxAddress({
      account,
      transactionVersion: networkData.txVersion,
    });
    const postConditionCode = FungibleConditionCode.LessEqual;

    const postConditionAmount = data.totalSTX * 0.01; // get percentage for treasury

    const ca = splitCA(env.hiroV2.contractId);
    const postConditions = [
      makeContractSTXPostCondition(
        ca[0],
        'memegoat-vault',
        postConditionCode,
        postConditionAmount,
      ),
    ];

    const rewardArgs = data.rewardData.map((reward) =>
      tupleCV({
        addr: standardPrincipalCV(reward.addr),
        amount: uintCV(reward.amount),
      }),
    );

    const payToken = splitCA(env.hiroV2.paymentToken);
    const txOptions = {
      contractAddress: ca[0],
      contractName: ca[1],
      functionName: 'start-new-tournament',
      functionArgs: [
        contractPrincipalCV(payToken[0], payToken[1]),
        listCV(rewardArgs),
      ],
      senderKey: account.stxPrivateKey,
      validateWithAbi: true,
      network: networkData.network,
      postConditions,
      anchorMode: AnchorMode.Any,
      address: senderAddress,
    };
    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(
      transaction,
      networkData.network,
    );
    return broadcastResponse;
  }
}

function splitCA(pair: string) {
  const data = pair.split('.');
  return data;
}

interface txData {
  rewardData: { addr: string; amount: number }[];
  totalSTX: number;
}
