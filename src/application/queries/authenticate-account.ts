import { Inject } from '@nestjs/common';
import { ImplRegisterAccountCommand } from 'application/commands/register-account';
import { ApplicationError } from 'commons/errors';
import { Result } from 'commons/logic';
import {
  AuthenticateAccountCommand,
  AuthenticateAccountCommandInput,
  AuthenticateAccountCommandOutput,
} from 'domain/queries/authenticate-account';
import { AccountRepository } from 'domain/repositories/account-repository';
import { ImplAccountRepository } from 'infra/database/repositories';
import { ImplHasherProvider } from 'infra/providers/hasher/hasher.provider';
import { LoggerService } from 'infra/providers/logger/logger.service';

class ImplAuthenticateAccountCommand implements AuthenticateAccountCommand {
  constructor(
    @Inject(ImplAccountRepository.name)
    private readonly accountRepository: AccountRepository,
    private readonly hasher: ImplHasherProvider,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ImplRegisterAccountCommand.name);
  }

  async handle({
    email,
    password,
  }: AuthenticateAccountCommandInput): Promise<AuthenticateAccountCommandOutput> {
    try {
      const account = await this.accountRepository.findBy({
        email,
      });

      if (!account) {
        return Result.failure(
          ApplicationError.build({
            message: 'Account not found!',
            name: 'AccountNotFound',
          }),
        );
      }

      const passwordMatch = await this.hasher.isMatch(
        password,
        account.props.password,
      );

      if (!passwordMatch) {
        return Result.failure(
          ApplicationError.build({
            message: 'Cant authenticate account! Invalid credentials!',
            name: 'CantAuthenticateAccount',
          }),
        );
      }

      //TODO: Tem que virar mapper!
      const roles = account.props.roles.map((role) => ({
        role: role.props.name,
        permissions: role.props.permissions.map(({ props }) => props.name),
      }));

      return Result.success({
        refreshToken: 'refreshToken',
        token: 'token',
        roles,
      });
    } catch (error) {
      this.logger.error(
        'Application > Command - Authenticate Account > Unexpected Error',
        error,
      );

      return Result.failure(
        ApplicationError.build({
          message: `Unexpected error on authenticate account! ${
            (error as Error).message
          }`,
          name: 'UnexpectedError',
        }),
      );
    }
  }
}

export { ImplAuthenticateAccountCommand };
