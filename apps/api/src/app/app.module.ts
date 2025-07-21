import { Module } from '@nestjs/common';
import { ExampleConfigModule, PostgresModule } from '@example/common';

@Module({
  imports: [ExampleConfigModule, PostgresModule.forRootAsync()],
  controllers: [],
  providers: [],
})
export class AppModule {}
