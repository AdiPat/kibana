/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Logger, SavedObjectsErrorHelpers } from '@kbn/core/server';
import { AuditEvent, AuditLogger } from '@kbn/security-plugin/server';

import { BlobStorageService } from '../blob_storage_service';
import { InternalFileShareService } from '../file_share_service';
import { FileMetadata, File as IFile, FileKind, FileJSON, FilesMetrics } from '../../common';
import { File, toJSON } from '../file';
import { FileKindsRegistry } from '../../common/file_kinds_registry';
import { FileNotFoundError } from './errors';
import type { FileMetadataClient } from '../file_client';
import type {
  CreateFileArgs,
  UpdateFileArgs,
  DeleteFileArgs,
  FindFileArgs,
  GetByIdArgs,
  ListFilesArgs,
} from './file_action_types';
import { createFileClient, FileClientImpl } from '../file_client/file_client';
/**
 * Service containing methods for working with files.
 *
 * All file business logic is encapsulated in the {@link File} class.
 *
 * @internal
 */
export class InternalFileService {
  constructor(
    private readonly metadataClient: FileMetadataClient,
    private readonly blobStorageService: BlobStorageService,
    private readonly fileShareService: InternalFileShareService,
    private readonly auditLogger: undefined | AuditLogger,
    private readonly fileKindRegistry: FileKindsRegistry,
    private readonly logger: Logger
  ) {}

  public async createFile(args: CreateFileArgs): Promise<IFile> {
    return this.createFileClient(args.fileKind).create({ metadata: { ...args } });
  }

  public writeAuditLog(event: AuditEvent) {
    if (this.auditLogger) {
      this.auditLogger.log(event);
    } else {
      // Otherwise just log to info
      this.logger.info(event.message);
    }
  }

  public async updateFile({ attributes, fileKind, id }: UpdateFileArgs): Promise<IFile> {
    const file = await this.getById({ fileKind, id });
    return await file.update(attributes);
  }

  public async deleteFile({ id, fileKind }: DeleteFileArgs): Promise<void> {
    const file = await this.getById({ id, fileKind });
    await file.delete();
  }

  private async get(id: string) {
    try {
      const { metadata } = await this.metadataClient.get({ id });
      if (metadata.Status === 'DELETED') {
        throw new FileNotFoundError('File has been deleted');
      }
      return this.toFile(id, metadata, metadata.FileKind);
    } catch (e) {
      if (SavedObjectsErrorHelpers.isNotFoundError(e)) {
        throw new FileNotFoundError('File not found');
      }
      this.logger.error(`Could not retrieve file: ${e}`);
      throw e;
    }
  }

  public async getById({ fileKind, id }: GetByIdArgs): Promise<IFile> {
    const file = await this.get(id);
    if (file.data.fileKind !== fileKind) {
      throw new Error(`Unexpected file kind "${file.data.fileKind}", expected "${fileKind}".`);
    }
    return file;
  }

  public async list({
    fileKind: fileKindId,
    page = 1,
    perPage = 100,
  }: ListFilesArgs): Promise<IFile[]> {
    const fileKind = this.getFileKind(fileKindId);
    const result = await this.metadataClient.list({
      fileKind: fileKind.id,
      page,
      perPage,
    });
    const fileClient = this.createFileClient(fileKind.id);
    return result.map((file) => this.toFile(file.id, file.metadata, fileKind.id, fileClient));
  }

  public getFileKind(id: string): FileKind {
    return this.fileKindRegistry.get(id);
  }

  public async findFilesJSON(args: FindFileArgs): Promise<FileJSON[]> {
    const result = await this.metadataClient.find(args);
    return result.map((r) => toJSON(r.id, r.metadata));
  }

  public async getUsageMetrics(): Promise<FilesMetrics> {
    return this.metadataClient.getUsageMetrics({
      esFixedSizeIndex: {
        capacity: this.blobStorageService.getStaticBlobStorageSettings().esFixedSizeIndex.capacity,
      },
    });
  }

  public async getByToken(token: string) {
    const { fileId } = await this.fileShareService.getByToken(token);
    return this.get(fileId);
  }

  private toFile(
    id: string,
    fileMetadata: FileMetadata,
    fileKind: string,
    fileClient?: FileClientImpl
  ): IFile {
    return new File(
      id,
      toJSON(id, fileMetadata),
      fileClient ?? this.createFileClient(fileKind),
      this.logger.get(`file-${id}`)
    );
  }

  private createFileClient(fileKindId: string) {
    const fileKind = this.fileKindRegistry.get(fileKindId);
    return createFileClient({
      auditLogger: this.auditLogger,
      blobStorageClient: this.blobStorageService.createBlobStorageClient(
        fileKind.blobStoreSettings
      ),
      fileKindDescriptor: fileKind,
      internalFileShareService: this.fileShareService,
      logger: this.logger,
      metadataClient: this.metadataClient,
    });
  }
}
