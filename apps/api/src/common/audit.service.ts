import {Injectable} from '@nestjs/common';import {PrismaService} from '../prisma.service';
@Injectable() export class AuditService{constructor(private db:PrismaService){}write(actorId:string|undefined,action:string,entity:string,entityId?:string,before?:object,after?:object){return this.db.auditLog.create({data:{actorId,action,entity,entityId,before,after}})}}
