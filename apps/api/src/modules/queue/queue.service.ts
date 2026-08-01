import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../../prisma.service';
import { config } from '../../config';
import { releaseDiscount } from '../commerce/discount-reservation';

/**
 * Formats a lesson start time for a Kavenegar lookup token.
 *
 * Two problems with sending `startsAt.toISOString()`, which is what this used to
 * do. Kavenegar rejects lookup tokens containing spaces and punctuation such as
 * `:`, so the reminder SMS would fail to send at all; and a UTC instant is the
 * wrong thing to show a student whose lesson time was quoted in their own zone.
 * The booking's stored timezone is used, and the output is restricted to digits
 * and hyphens so it always survives token validation.
 *
 * NOTE: the `lingospeak-reminder` template and this token format have to be
 * confirmed against the Kavenegar panel before launch — the exact accepted
 * character set is not documented and cannot be verified without a live key.
 */
export function reminderToken(startsAt: Date, timezone: string) {
  const zone = (() => {
    try { new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(startsAt); return timezone; }
    catch { return 'Asia/Tehran'; }
  })();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(startsAt);
  const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}-${value('minute')}`,
  };
}

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
      const failures:unknown[]=[];
      // Same lesson time for both recipients, so it is formatted once. Rendered
      // in the booking's timezone rather than UTC — see `reminderToken`.
      const when=reminderToken(reminder.booking.startsAt,reminder.booking.timezone);
      for(const user of [reminder.booking.student,reminder.booking.teacher.user]){
        const dedupeKey=`reminder:${reminder.id}:${user.id}`;
        const notification=await this.db.notification.findUnique({where:{idempotencyKey:dedupeKey},include:{deliveries:true}})
          ??await this.db.notification.create({data:{userId:user.id,type:'class-reminder',idempotencyKey:dedupeKey,titleFa:'یادآوری کلاس',titleEn:'Class reminder',bodyFa:`کلاس شما در تاریخ ${when.date} ساعت ${when.time.replace('-',':')} برگزار می‌شود.`,bodyEn:`Your class starts on ${when.date} at ${when.time.replace('-',':')}.`,deliveries:{create:{channel:'IN_APP',status:'sent',sentAt:new Date()}}},include:{deliveries:true}});
        if(notification.deliveries.some(d=>d.channel==='SMS'&&d.status==='sent'))continue;
        const delivery=notification.deliveries.find(d=>d.channel==='SMS')
          ??await this.db.notificationDelivery.create({data:{notificationId:notification.id,channel:'SMS',status:'sending',attempts:1}});
        try{
          let providerId:string,response:object;
          if(this.cfg.KAVENEGAR_API_KEY){
            const r=await fetch(`https://api.kavenegar.com/v1/${this.cfg.KAVENEGAR_API_KEY}/verify/lookup.json?receptor=${encodeURIComponent(user.phone)}&token=${encodeURIComponent(when.date)}&token2=${encodeURIComponent(when.time)}&template=lingospeak-reminder`,{method:'POST'});
            response=await r.json() as object;if(!r.ok)throw new Error('Kavenegar delivery failed');providerId=`kavenegar-${Date.now()}`;
          }else{providerId=`development-${Date.now()}`;response={adapter:'development',phone:user.phone,startsAt:reminder.booking.startsAt};}
          await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'sent',providerId,providerResponse:response,sentAt:new Date()}});
        }catch(error){
          await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'failed',attempts:{increment:1},providerResponse:{error:error instanceof Error?error.message:'delivery failed'}}});
          failures.push(error);
        }
      }
      await this.db.reminder.update({where:{id:reminder.id},data:{status:failures.length?'scheduled':'sent',attempts:{increment:1}}});
      if(failures.length)throw failures[0];
    },{connection:this.connection,concurrency:5});
  }

  async scheduleExpiration(bookingId:string,expiresAt:Date){await this.queue.add('booking-expiration',{bookingId},{jobId:`expiration-${bookingId}`,delay:Math.max(0,expiresAt.getTime()-Date.now()),attempts:3,backoff:{type:'exponential',delay:5000},removeOnComplete:true,removeOnFail:{count:500}});}
  private async expireBooking(bookingId:string){await this.db.$transaction(async tx=>{const booking=await tx.booking.findUnique({where:{id:bookingId},include:{payment:true}});if(!booking||booking.status!=='PENDING_PAYMENT'||!booking.paymentExpiresAt||booking.paymentExpiresAt>new Date())return;await tx.booking.update({where:{id:bookingId},data:{status:'CANCELLED',cancelledAt:new Date(),cancellationReason:'payment_expired'}});if(booking.payment?.status==='PENDING'){if(booking.payment.walletAmount>0)await tx.walletEntry.create({data:{userId:booking.payment.userId,transactionId:`tx_${booking.payment.id}`,account:'user_wallet',direction:'CREDIT',amount:booking.payment.walletAmount,description:'expired payment wallet rollback',referenceType:'Payment',referenceId:booking.payment.id,idempotencyKey:`wallet-expire:${booking.payment.id}`}});
      // An expired checkout abandons its discount reservation just like a failed
      // one does, so the use has to go back to the code here too.
      await releaseDiscount(tx,booking.payment.discountId);
      await tx.payment.update({where:{id:booking.payment.id},data:{status:'EXPIRED',callbackPayload:{reason:'payment_expired'}}});}if(booking.enrollmentId)await tx.creditEntry.create({data:{enrollmentId:booking.enrollmentId,bookingId,type:'RESTORE',amount:1,idempotencyKey:`expire-restore:${bookingId}`}});});}
  async scheduleBooking(bookingId:string,startsAt:Date){for(const [minutes,type] of [[1440,'24h'],[60,'1h']] as const){const scheduledAt=new Date(startsAt.getTime()-minutes*60e3);if(scheduledAt<=new Date())continue;const reminder=await this.db.reminder.upsert({where:{bookingId_type:{bookingId,type}},create:{bookingId,type,scheduledAt},update:{scheduledAt,status:'scheduled'}});await this.queue.add('booking-reminder',{reminderId:reminder.id},{jobId:`reminder-${reminder.id}`,delay:scheduledAt.getTime()-Date.now(),attempts:5,backoff:{type:'exponential',delay:30000},removeOnComplete:true,removeOnFail:{count:500}});}}
  async onModuleDestroy(){await this.worker?.close();await this.queue.close();}
}
