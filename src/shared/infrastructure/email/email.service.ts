import { Injectable } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'
import { ConfigService } from '@nestjs/config'
import { VerificationType } from '@/shared/constants'
import { EmailContext, VerificationCodeEmailContext } from './interfaces'

@Injectable()
export class EmailService {
    constructor(
        private readonly mailerService: MailerService,
        private readonly configService: ConfigService
    ) {}

    /**
     * Send verification code email for registration or password reset
     */
    async sendVerificationCode(email: string, code: string, type: VerificationType, fullName?: string): Promise<void> {
        const appName = this.configService.get<string>('app.name')!
        const subject =
            type === VerificationType.REGISTER ? `Verify your ${appName} account` : `Reset your ${appName} password`

        const context: VerificationCodeEmailContext = {
            code,
            appName,
            expiresIn: 10, // minutes
            fullName
        }

        await this.mailerService.sendMail({
            to: email,
            subject,
            template: type === VerificationType.REGISTER ? './verification-code' : './password-reset-code',
            context
        })
    }

    /**
     * Send generic email (for custom use cases)
     */
    async sendEmail(to: string, subject: string, template: string, context: EmailContext): Promise<void> {
        await this.mailerService.sendMail({
            to,
            subject,
            template,
            context
        })
    }
}
