import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class BackblazeStorageService {
  private readonly logger = new Logger(BackblazeStorageService.name);
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env.B2_BUCKET_NAME || '';

    this.s3 = new S3Client({
      endpoint: process.env.B2_ENDPOINT || '',
      region: process.env.B2_REGION || 'us-west-004',
      credentials: {
        accessKeyId: process.env.B2_KEY_ID || '',
        secretAccessKey: process.env.B2_APP_KEY || '',
      },
    });
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Uploaded file: ${key}`);
    return key;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
    this.logger.log(`Deleted file: ${key}`);
  }

  buildBillKey(fileIdPrefix: string): string {
    const timestamp = Date.now();
    return `bills/${timestamp}_${fileIdPrefix}.jpg`;
  }
}
