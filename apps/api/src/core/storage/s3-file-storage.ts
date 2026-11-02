import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, NoSuchKey, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { assertStorageKey, FileStorage } from './file-storage.port.js';

export interface S3Options {
  bucket: string;
  region: string;
  /** For S3-compatible services: MinIO, Cloudflare R2, … */
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * An S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). The bucket stays
 * private: the API streams files in and out, so no public access, bucket CORS
 * or presigned URLs are needed. Without explicit keys the AWS default
 * credential chain is used (e.g. an instance role).
 */
export class S3FileStorage extends FileStorage {
  private readonly client: S3Client;

  constructor(private readonly options: S3Options) {
    super();
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: options.accessKeyId && options.secretAccessKey ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } : undefined,
      requestHandler: { requestTimeout: 30_000, connectionTimeout: 5_000 },
    });
  }

  async put(key: string, body: Readable, contentType: string): Promise<void> {
    assertStorageKey(key);
    // Buffered so the length is known: uploads are size-limited well below memory concerns.
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk as Buffer));
    await this.client.send(new PutObjectCommand({ Bucket: this.options.bucket, Key: key, Body: Buffer.concat(chunks), ContentType: contentType }));
  }

  async size(key: string): Promise<number | null> {
    assertStorageKey(key);
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }));
      return head.ContentLength ?? 0;
    } catch (error) {
      if (error instanceof NotFound || error instanceof NoSuchKey || (error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  async head(key: string, bytes: number): Promise<Buffer> {
    assertStorageKey(key);
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    return Buffer.from((await object.Body?.transformToByteArray()) ?? []);
  }

  async read(key: string): Promise<Readable> {
    assertStorageKey(key);
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
    if (!object.Body) throw new Error('Empty object');
    return object.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }
}
