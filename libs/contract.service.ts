import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { Cl, cvToValue } from '@stacks/transactions';

@Injectable()
export class ContractService {
  constructor(private readonly httpService: HttpService) {}
  async readContract(dto: contractDTO) {
    const args: Uint8Array[] = [];
    if (dto.arguments) {
      const argsC = dto.arguments.map((data) => Cl.serialize(filterArg(data)));
      args.push(...argsC);
    }
    const response = await firstValueFrom(
      this.httpService.post(
        `https://api.hiro.so/v2/contracts/call-read/SP2F4QC563WN0A0949WPH5W1YXVC4M1R46QKE0G14/${dto.contract}/${dto.function}`,
        {
          sender: 'SP2F4QC563WN0A0949WPH5W1YXVC4M1R46QKE0G14',
          arguments: args,
        },
        {
          headers: {
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    const data = response.data as apiResponse;
    if (data.result) {
      return cvToValue(Cl.deserialize(data.result)).value;
    } else {
      return null;
    }
  }
}

function filterArg(args: contractArgs) {
  switch (args.type) {
    case 'uint':
      return Cl.uint(args.arg);
    case 'bool':
      return Cl.bool(args.arg);
    case 'buffer':
      return Cl.buffer(args.arg);
    case 'int':
      return Cl.int(args.arg);
    case 'principal':
      return Cl.standardPrincipal(args.arg);
    case 'contract':
      const ca = splitCA(args.arg);
      return Cl.contractPrincipal(ca[0], ca[1]);
    case 'option':
      return Cl.some(args.arg);
    case 'none':
      return Cl.none();
    case 'list':
      return Cl.list(args.arg);
    case 'tuple':
      return Cl.tuple(args.arg);
    default:
      return Cl.uint(args.arg);
  }
}

function splitCA(pair: string) {
  const data = pair.split('.');
  return data;
}

export class contractDTO {
  @IsNotEmpty()
  @IsString()
  contract: string;

  @IsNotEmpty()
  @IsString()
  function: string;

  @IsArray()
  arguments?: contractArgs[];
}

export type contractArgs = {
  arg: any;
  type: ArgType;
};

export type ArgType =
  | 'uint'
  | 'bool'
  | 'buffer'
  | 'int'
  | 'principal'
  | 'contract'
  | 'option'
  | 'none'
  | 'list'
  | 'tuple';

type apiResponse = {
  ok?: boolean;
  result?: string;
  cause?: string;
};
