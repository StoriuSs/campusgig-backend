import { Module } from '@nestjs/common'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { EmailService } from './email.service'
import * as path from 'path'

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                // In dev mode, use src folder; in prod, use dist folder
                const isDev = process.env.NODE_ENV !== 'production'
                const templateDir = isDev
                    ? path.join(process.cwd(), 'src', 'modules', 'core', 'email', 'templates')
                    : path.join(__dirname, 'templates')

                // Debug logging
                const emailConfig = {
                    host: config.get<string>('email.host'),
                    port: config.get<number>('email.port'),
                    secure: config.get<boolean>('email.secure'),
                    user: config.get<string>('email.auth.user'),
                    password: config.get<string>('email.auth.password'),
                    name: config.get<string>('email.from.name'),
                    address: config.get<string>('email.from.address')
                }

                return {
                    transport: {
                        host: emailConfig.host,
                        port: emailConfig.port,
                        secure: emailConfig.secure,
                        auth: {
                            user: emailConfig.user,
                            pass: emailConfig.password
                        }
                    },
                    defaults: {
                        from: `"${emailConfig.name}" <${emailConfig.address}>`
                    },
                    template: {
                        dir: templateDir,
                        adapter: new HandlebarsAdapter(),
                        options: {
                            strict: true
                        }
                    }
                }
            }
        })
    ],
    providers: [EmailService],
    exports: [EmailService]
})
export class EmailModule {}
