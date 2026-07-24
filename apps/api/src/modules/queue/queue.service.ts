import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../../prisma.service';
import { config } from '../../config';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private cfg = config();
  private redisUrl = new URL(this.cfg.REDIS_URL);
  private connection = { host:this.redisUrl.hostname, port:Number(this.redisUrl.port||6379), password:this.redisUrl.password||undefined, maxRetriesPerRequest:null };
  private queue = new Queue('notifications',{connection:this.connection});
  private worker?: Worker;
  constructor(private db:PrismaService) {}

  onModuleInit(){
    this.worker=new Worker('notifications',async job=>{
      if(job.name==='booking-expiration'){await this.expireBooking(job.data.bookingId);return;}
      if(job.name!=='booking-reminder')return;
      const reminder=await this.db.reminder.findUnique({where:{id:job.data.reminderId},include:{booking:{include:{student:true,teacher:{include:{user:true}}}}}});
      if(!reminder||reminder.status!=='scheduled'||reminder.booking.status!=='CONFIRMED')return;
      for(const user of [reminder.booking.student,reminder.booking.teacher.user]){
        const notification=await this.db.notification.create({data:{userId:user.id,type:'class-reminder',titleFa:'یادآوری کلاس',titleEn:'Class reminder',bodyFa:`کلاس شما در ${reminder.booking.startsAt.toISOString()} برگزار می‌شود.`,bodyEn:`Your class starts at ${reminder.booking.startsAt.toISOString()}.`,deliveries:{create:{channel:'IN_APP',status:'sent',sentAt:new Date()}}}});
        const delivery=await this.db.notificationDelivery.create({data:{notificationId:notification.id,channel:'SMS',status:'sending',attempts:1}});
        try{
          let providerId:string,response:object;
          if(this.cfg.KAVENEGAR_API_KEY){
            const r=await fetch(`https://api.kavenegar.com/v1/${this.cfg.KAVENEGAR_API_KEY}/verify/lookup.json?receptor=${encodeURIComponent(user.phone)}&token=${encodeURIComponent(reminder.booking.startsAt.toISOString())}&template=lingospeak-reminder`,{method:'POST'});
            response=await r.json() as object;if(!r.ok)throw new Error('Kavenegar delivery failed');providerId=`kavenegar-${Date.now()}`;
          }else{providerId=`development-${Date.now()}`;response={adapter:'development',phone:user.phone,startsAt:reminder.booking.startsAt};}
          await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'sent',providerId,providerResponse:response,sentAt:new Date()}});
        }catch(error){await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'failed',providerResponse:{error:error instanceof Error?error.message:'delivery failed'}}});throw error;}
      }
      await this.db.reminder.update({where:{id:reminder.id},data:{status:'sent',attempts:{increment:1}}});
    },{connection:this.connection,concurrency:5});
  }

  async scheduleExpiration(bookingId:string,expiresAt:Date){await this.queue.add('booking-expiration',{bookingId},{jobId:`expiration-${bookingId}`,delay:Math.max(0,expiresAt.getTime()-Date.now()),attempts:3,backoff:{type:'exponential',delay:5000},removeOnComplete:true});}
  private async expireBooking(bookingId:string){await this.db.$transaction(async tx=>{const booking=await tx.booking.findUnique({where:{id:bookingId},include:{payment:true}});if(!booking||booking.status!=='PENDING_PAYMENT'||!booking.paymentExpiresAt||booking.paymentExpiresAt>new Date())return;await tx.booking.update({where:{id:bookingId},data:{status:'CANCELLED',cancelledAt:new Date(),cancellationReason:'payment_expired'}});if(booking.payment?.status==='PENDING'){if(booking.payment.walletAmount>0)await tx.walletEntry.create({data:{userId:booking.payment.userId,transactionId:`tx_${booking.payment.id}`,account:'user_wallet',direction:'CREDIT',amount:booking.payment.walletAmount,description:'expired payment wallet rollback',referenceType:'Payment',referenceId:booking.payment.id,idempotencyKey:`wallet-expire:${booking.payment.id}`}});await tx.payment.update({where:{id:booking.payment.id},data:{status:'EXPIRED',callbackPayload:{reason:'payment_expired'}}});}if(booking.enrollmentId)await tx.creditEntry.create({data:{enrollmentId:booking.enrollmentId,bookingId,type:'RESTORE',amount:1,idempotencyKey:`expire-restore:${bookingId}`}});});}
  async scheduleBooking(bookingId:string,startsAt:Date){for(const [minutes,type] of [[1440,'24h'],[60,'1h']] as const){const scheduledAt=new Date(startsAt.getTime()-minutes*60e3);if(scheduledAt<=new Date())continue;const reminder=await this.db.reminder.upsert({where:{bookingId_type:{bookingId,type}},create:{bookingId,type,scheduledAt},update:{scheduledAt,status:'scheduled'}});await this.queue.add('booking-reminder',{reminderId:reminder.id},{jobId:`reminder-${reminder.id}`,delay:scheduledAt.getTime()-Date.now(),attempts:5,backoff:{type:'exponential',delay:30000},removeOnComplete:true});}}
  async onModuleDestroy(){await this.worker?.close();await this.queue.close();}
}
