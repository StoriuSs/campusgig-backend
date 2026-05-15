import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Controller, Get } from '@nestjs/common'

/**
 * Minimal E2E test example
 * 
 * This test creates a minimal module to demonstrate how E2E testing works
 * without requiring the full AppModule (which has auth/DB/cache dependencies).
 */

// Simple test controller
@Controller('test')
class TestController {
    @Get()
    test() {
        return { status: 'ok', message: 'Test endpoint working' }
    }
}

describe('E2E Test Example', () => {
    let app: INestApplication

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [TestController]
        }).compile()

        app = moduleFixture.createNestApplication()
        await app.init()
    })

    afterAll(async () => {
        if (app) {
            await app.close()
        }
    })

    describe('/test (GET)', () => {
        it('should return test response', () => {
            return request(app.getHttpServer())
                .get('/test')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('status', 'ok')
                    expect(res.body).toHaveProperty('message', 'Test endpoint working')
                })
        })
    })
})
