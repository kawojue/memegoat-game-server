import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary'
import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  InternalServerErrorException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import * as crypto from 'crypto'
import { parse } from 'file-type-mime'
import { env } from 'configs/env.config'

const toStream = require('buffer-to-stream')

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      ...env.cloudinary,
      secure: true,
    })
  }

  async upload({
    file,
    folder,
    maxSize,
    public_id,
    mimeTypes,
  }: UploadOption): Promise<UploadApiResponse | UploadApiErrorResponse> {
    let size: number

    if (Buffer.isBuffer(file)) {
      size = file.length
    } else if (file && file.size) {
      size = file.size
    } else {
      throw new BadRequestException('Invalid input type')
    }

    if (size > maxSize) {
      throw new PayloadTooLargeException(`File is too large`)
    }

    if (mimeTypes?.length) {
      let mimeType: string

      if (Buffer.isBuffer(file)) {
        const type = parse(file)

        mimeType = type?.mime || ''
      } else if (file && file.originalname) {
        mimeType = file.mimetype
      }

      if (!mimeTypes.includes(mimeType)) {
        throw new UnsupportedMediaTypeException('File is not allowed')
      }
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          public_id:
            public_id || Buffer.isBuffer(file)
              ? crypto.randomBytes(12).toString('hex')
              : file.originalname.split('.')[0],
        },
        (error, result) => {
          if (error) return reject(error)
          resolve(result)
        },
      )

      if (Buffer.isBuffer(file)) {
        toStream(file).pipe(upload)
      } else {
        toStream(file.buffer).pipe(upload)
      }
    })
  }

  async delete(public_id: string) {
    return await cloudinary.uploader.destroy(public_id)
  }

  async listFilesByFolderName(folderName: string) {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: folderName,
      max_results: 500,
    })

    return result.resources.map((result: any) => {
      return {
        public_id: result.public_id,
        url: result.secure_url,
      }
    })
  }

  async listFolders() {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        max_results: 500,
      })

      const folders = new Set<string>()
      result.resources.forEach((file: any) => {
        const folderPath = file.public_id.split('/')[0]
        folders.add(folderPath)
      })

      return Array.from(folders)
    } catch (error) {
      throw new Error(`Error listing folders: ${error.message}`)
    }
  }
}
