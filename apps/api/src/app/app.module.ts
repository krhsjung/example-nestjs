import { Module } from '@nestjs/common';
import { ExampleConfigModule, PostgresModule } from '@example/common';
import { UserModule } from './user/user.module';

@Module({
  imports: [ExampleConfigModule, PostgresModule.forRootAsync(), UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
