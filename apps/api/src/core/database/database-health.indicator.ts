import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  isUp(): Promise<boolean> {
    return this.dataSource.query('SELECT 1').then(
      () => true,
      () => false,
    );
  }
}
