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
// import { ApiService } from './api.service';

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

  // constructor(private readonly apiService: ApiService) {}

  async storeTournamentRewards(data: txData, tourId: number) {
    const networkEnv = env.hiro.channel;
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

    const postConditionAmount =
      data.totalTicketsUsed * env.hiro.ticketPrice * 0.01; // get percentage for treasury

    const ca = splitCA(env.hiro.contractId);
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

    const payToken = splitCA(env.hiro.paymentToken);
    const txOptions = {
      contractAddress: ca[0],
      contractName: ca[1],
      functionName: 'store-tournament-record ',
      functionArgs: [
        uintCV(tourId),
        contractPrincipalCV(payToken[0], payToken[1]),
        listCV(rewardArgs),
        tupleCV({
          'no-of-players': uintCV(data.totalNoOfPlayers),
          'total-tickets-used': uintCV(data.totalTicketsUsed),
        }),
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

  // async getBlockHeight() {
  //   const data = await this.apiService.getCurrentBlock<any>(env.hiro.channel);
  //   return data.results['0'].burn_block_height;
  // }
}

function splitCA(pair: string) {
  const data = pair.split('.');
  return data;
}

export interface txData {
  rewardData: RewardData[];
  totalTicketsUsed: number;
  totalNoOfPlayers: number;
}

export interface RewardData {
  addr: string;
  amount: number;
}
