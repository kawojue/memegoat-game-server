import {
  Res,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Controller,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { FolderDTO } from './dto/index.dto'
import { ApiBasicAuth } from '@nestjs/swagger'
import { CloudinaryApiGuard } from './cloudinary.guard'
import { CloudinaryService } from './cloudinary.service'
import { FileInterceptor } from '@nestjs/platform-express'

@ApiBasicAuth()
@ApiTags('Cloudinary')
@Controller('cloudinary')
@UseGuards(CloudinaryApiGuard)
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) { }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@Res() res: Response, @UploadedFile() file: Express.Multer.File) {
    let uploadedFile: Record<string, any>

    const uploader = await this.cloudinaryService.upload({
      file,
      folder: 'CLAIM-REWARD',
      maxSize: 2 << 20,
      mimeTypes: ['image/png', 'image/jpeg']
    })

    uploadedFile = {
      size: file.size,
      width: uploader.width,
      height: uploader.height,
      url: uploader.secure_url,
      public_id: uploader.public_id,
    }

    return res.status(200).json({
      message: 'File uploaded successfully',
      data: uploadedFile,
    })
  }

  // @Get('/list-by-folders')
  async listFilesByFolder(
    @Res() res: Response,
    @Body() { folderName }: FolderDTO,
  ) {
    const files = await this.cloudinaryService.listFilesByFolderName(
      folderName,
    )

    return res.status(200).json({
      message: 'File(s) fetched successfully',
      data: files,
    })
  }

  // @Get('/list-folders')
  async listFolders(@Res() res: Response) {
    const folders = await this.cloudinaryService.listFolders()
    return res.status(200).json({
      message: 'Folders fetched successfully',
      data: folders,
    })
  }

  // @Delete('/delete/:publicId')
  async deleteImage(@Res() res: Response, @Param('publicId') publicId: string) {
    await this.cloudinaryService.delete(publicId)
    return res.sendStatus(204)
  }
}
