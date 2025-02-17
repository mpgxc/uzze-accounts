import * as path from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientOptions, Transport } from '@nestjs/microservices';

type zString = `GRPC.${string}`;

@Injectable()
export class GrpcClientOptionsService {
  constructor(private readonly config: ConfigService) {}

  private buildClientOptions(
    _host: zString,
    _port: zString,
    _package: zString,
    _protoPath: string,
  ): ClientOptions {
    const host = this.config.getOrThrow(_host);
    const port = this.config.getOrThrow(_port);

    return {
      transport: Transport.GRPC,
      options: {
        url: `${host}:${port}`,
        package: this.config.getOrThrow(_package),
        protoPath: path.join(__dirname, _protoPath),
      },
    };
  }

  get accountsOptions(): ClientOptions {
    return this.buildClientOptions(
      'GRPC.GRPC_HOST',
      'GRPC.GRPC_PORT',
      'GRPC.GRPC_PACKAGE',
      './protos/accounts.proto',
    );
  }

  get secretsManagerOptions(): ClientOptions {
    return this.buildClientOptions(
      'GRPC.SM_GRPC_HOST',
      'GRPC.SM_GRPC_PORT',
      'GRPC.SM_GRPC_PACKAGE',
      './protos/secrets-manager.proto',
    );
  }
}
