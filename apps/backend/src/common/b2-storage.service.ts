import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class B2StorageService {
  private readonly logger = new Logger(B2StorageService.name);
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env.B2_BUCKET_NAME || '';

    this.s3 = new S3Client({
      endpoint: process.env.B2_ENDPOINT || '',
      region: process.env.B2_REGION || 'us-east-005',
      credentials: {
        accessKeyId: process.env.B2_KEY_ID || '',
        secretAccessKey: process.env.B2_APP_KEY || '',
      },
    });
  }

  async uploadTransactionImage(
    imageBuffer: Buffer,
    transactionId: string,
  ): Promise<string> {
    const key = `bills/${transactionId}-${randomUUID()}.jpg`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
      }),
    );

    this.logger.log(`Uploaded image: ${key}`);
    return key;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of response.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
    this.logger.log(`Deleted object: ${key}`);
  }
}
