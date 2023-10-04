import { ImplGetAccountQuery } from '@application/queries/get-account';
import { GetAccountQuery } from '@domain/queries/get-account';
import { UserRequester } from '@global/express';
import { LoggerService } from '@infra/providers/logger/logger.service';
import {
  ImplSecretsManagerProvider,
  SecretsManagerOutput,
} from '@infra/providers/secrets-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Cache } from 'cache-manager';
import { decode } from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { firstValueFrom } from 'rxjs';
import { TokenPayloadInput } from './token.strategy';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh-token',
) {
  constructor(
    @Inject(ImplGetAccountQuery.name)
    private readonly getAccountQuery: GetAccountQuery,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    private readonly logger: LoggerService,
    private readonly secretsManager: ImplSecretsManagerProvider,
  ) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: async (
        request: Request,
        jwtToken: string,
        done: (unknown?: any, secret?: string) => void,
      ) => {
        const user = decode(jwtToken) as TokenPayloadInput;

        if (!user) return done();

        let secrets = await this.cacheManager.get<SecretsManagerOutput>(
          `${user.tenantCode}_SECRETS`,
        );

        if (!secrets) {
          secrets = await firstValueFrom(
            this.secretsManager.get({ key: user.tenantCode }),
          );

          await this.cacheManager.set(`${user.tenantCode}_SECRETS`, secrets);
        }

        return done(null, secrets.value.jwt_refresh_public_key);
      },
    });

    this.logger.setContext(RefreshTokenStrategy.name);
  }

  async validate(
    request: Request,
    payload: TokenPayloadInput,
  ): Promise<UserRequester> {
    this.logger.log('Http > Auth > Refresh Token Strategy > Validate');

    const account = await this.getAccountQuery.handle({
      id: payload.sub,
      tenantCode: payload.tenantCode,
    });

    if (account.hasError) {
      this.logger.warn(
        `Http > Auth > Refresh Token Strategy > ${account.value.message}`,
      );

      throw new UnauthorizedException(
        `You don't have permission! ${account.value.message}`,
      );
    }

    this.logger.log('Http > Auth > Refresh Token Strategy > Success');

    const [, refreshToken] = request.headers['Authorization'].split(' ');

    return {
      avatar: account.value.avatar,
      email: account.value.email,
      id: account.value.id,
      lastName: account.value.lastName,
      name: account.value.name,
      phone: account.value.phone,
      roles: account.value.roles,
      tenantCode: account.value.tenantCode,
      username: account.value.username,
    };
  }
}
