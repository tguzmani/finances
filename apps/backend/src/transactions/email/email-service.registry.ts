import { Injectable } from '@nestjs/common';
import { IBankEmailService } from './email.interfaces';

@Injectable()
export class EmailServiceRegistry {
  private services: IBankEmailService[] = [];

  register(service: IBankEmailService): void {
    this.services.push(service);
  }

  getAllServices(): IBankEmailService[] {
    return this.services;
  }
}
