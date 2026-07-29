import { Module } from "@nestjs/common";
import { OutreachRunner } from "./outreach.runner.js";

@Module({
  providers: [OutreachRunner],
  exports: [OutreachRunner],
})
export class OutreachModule {}
