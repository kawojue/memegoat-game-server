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
import { IsArray, IsNumber } from 'class-validator';
import { PrismaService } from 'prisma/prisma.service';
import BigNumber from 'bignumber.js';
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

  constructor(private readonly prisma: PrismaService) {}

  async storeTournamentRewards(data: txData, tourId: number) {
    try {
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
      const postConditionAmount = new BigNumber(
        new BigNumber(data.totalTicketsUsed).toFixed(0),
      )
        .multipliedBy(new BigNumber(Number(env.hiro.ticketPrice)))
        .multipliedBy(new BigNumber(2.05))
        .dividedBy(new BigNumber(100))
        .toFixed(0);

      // get percentage for treasury
      const ca = splitCA(env.hiro.contractId);
      const postConditions = [
        makeContractSTXPostCondition(
          ca[0],
          'memegoat-vault',
          postConditionCode,
          BigInt(postConditionAmount),
        ),
      ];

      const rewardArgs = data.rewardData.map((reward) =>
        tupleCV({
          addr: standardPrincipalCV(reward.addr),
          amount: uintCV(BigInt(new BigNumber(reward.amount).toFixed(0))),
        }),
      );

      const payToken = splitCA(env.hiro.paymentToken);
      const txOptions = {
        contractAddress: ca[0],
        contractName: ca[1],
        functionName: 'store-tournament-record',
        functionArgs: [
          uintCV(Number(tourId)),
          contractPrincipalCV(payToken[0], payToken[1]),
          listCV(rewardArgs),
          tupleCV({
            'no-of-players': uintCV(
              BigInt(new BigNumber(data.totalNoOfPlayers).toFixed(0)),
            ),
            'total-tickets-used': uintCV(
              BigInt(new BigNumber(data.totalTicketsUsed).toFixed(0)),
            ),
          }),
        ],
        fee: 200000n,
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

      return await this.prisma.transaction.create({
        data: {
          txId: broadcastResponse.txid,
          tag: 'STORE-TOURNAMENT-RECORD',
          txStatus: 'Pending',
          txSender: senderAddress,
          action: 'REWARDS-UPLOADED-MEMEGOAT-GAMES',
          tournament: { connect: { id: data.tournamentId } },
        },
      });
    } catch (err) {
      throw err;
    }
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
  tournamentId: string;
}

export interface RewardData {
  addr: string;
  amount: number;
}

export class TxDataDTO {
  @IsArray()
  rewardData: RewardData[];

  @IsNumber()
  totalTicketsUsed: number;

  @IsNumber()
  totalNoOfPlayers: number;
}
