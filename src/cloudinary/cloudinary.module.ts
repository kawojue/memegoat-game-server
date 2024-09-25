import { Module } from '@nestjs/common'
import { CloudinaryService } from './cloudinary.service'
import { CloudinaryController } from './clodinary.controller'

@Module({
  exports: [CloudinaryService],
  providers: [CloudinaryService],
  controllers: [CloudinaryController],
})
export class CloudinaryModule { }
