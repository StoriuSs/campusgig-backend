import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common'
import camelcaseKeys from 'camelcase-keys'

@Injectable()
export class SnakeToCamelPipe implements PipeTransform {
    transform(value: unknown, _metadata: ArgumentMetadata): unknown {
        if (typeof value === 'object' && value !== null) {
            return camelcaseKeys(value as Record<string, unknown>, { deep: true })
        }
        return value
    }
}
