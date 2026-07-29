import { Module } from "@nestjs/common";
import { OptOutController } from "./optout.controller.js";
import { OptOutService } from "./optout.service.js";
import { PurgeRunner } from "./purge.runner.js";

@Module({
  controllers: [OptOutController],
  providers: [OptOutService, PurgeRunner],
  exports: [PurgeRunner],
})
export class RgpdModule {}
