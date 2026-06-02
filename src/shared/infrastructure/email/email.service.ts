import { Injectable, Logger } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'
import { ConfigService } from '@nestjs/config'
import { VerificationType } from '@/shared/constants'
import { EmailContext, VerificationCodeEmailContext } from './interfaces'

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name)

    constructor(
        private readonly mailerService: MailerService,
        private readonly configService: ConfigService
    ) {}

    private async deliver(to: string, subject: string, template: string, context: EmailContext): Promise<void> {
        this.logger.log(`Sending email → to=${to} subject="${subject}" template=${template}`)
        try {
            const info = (await this.mailerService.sendMail({ to, subject, template, context })) as {
                messageId?: string
                response?: string
                accepted?: string[]
                rejected?: string[]
            }
            this.logger.log(
                `Email sent → to=${to} messageId=${info?.messageId ?? 'n/a'} accepted=${JSON.stringify(info?.accepted ?? [])} rejected=${JSON.stringify(info?.rejected ?? [])} response=${info?.response ?? ''}`
            )
        } catch (err) {
            this.logger.error(
                `Email FAILED → to=${to} subject="${subject}": ${(err as Error)?.message}`,
                (err as Error)?.stack
            )
            throw err
        }
    }

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

        const template = type === VerificationType.REGISTER ? './verification-code' : './password-reset-code'
        await this.deliver(email, subject, template, context)
    }

    /**
     * Send generic email (for custom use cases)
     */
    async sendEmail(to: string, subject: string, template: string, context: EmailContext): Promise<void> {
        await this.deliver(to, subject, template, context)
    }
}
