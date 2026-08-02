import{BadGatewayException,Injectable}from'@nestjs/common';import{createHash,randomUUID}from'crypto';import{config}from'../../../config';

const SANDBOX_MERCHANT_ID='XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
type ZarinpalResponse={data?:{authority?:string;code?:number;ref_id?:number|string;message?:string};errors?:unknown};
// All LingoSpeak prices and ledger entries are stored in toman, while Zarinpal
// v4 accepts and verifies amounts in rial. Keep the conversion at this provider
// boundary so the rest of the finance domain stays in one unit.
const toRial=(toman:number)=>toman*10;

@Injectable()
export class GatewayService {
 private options(){
  const cfg=config(),sandbox=cfg.ZARINPAL_SANDBOX;
  return{
   cfg,
   merchantId:cfg.ZARINPAL_MERCHANT_ID||(sandbox?SANDBOX_MERCHANT_ID:''),
   apiBase:sandbox?'https://sandbox.zarinpal.com':'https://payment.zarinpal.com',
   startBase:sandbox?'https://sandbox.zarinpal.com':'https://payment.zarinpal.com',
  };
 }

 async request(amount:number,description:string,callbackUrl:string){
  const{cfg,merchantId,apiBase,startBase}=this.options();
  if(!merchantId){const authority=`dev_${randomUUID()}`;return{authority,url:`${cfg.WEB_URL}/payment/development?authority=${authority}`}}
  const response=await fetch(`${apiBase}/pg/v4/payment/request.json`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({merchant_id:merchantId,amount:toRial(amount),description,callback_url:callbackUrl})});
  const body=await this.body(response);
  const authority=body.data?.authority;
  if(!response.ok||body.data?.code!==100||!authority)throw new BadGatewayException('Zarinpal payment request failed');
  return{authority,url:`${startBase}/pg/StartPay/${authority}`};
 }

 // Reconstructs the same redirect URL `request()` would have returned for an
 // authority it already issued, so a payment that already has one can be
 // resumed without opening a second Zarinpal session for the same payment.
 resumeUrl(authority:string){
  const{cfg,startBase}=this.options();
  if(authority.startsWith('dev_'))return`${cfg.WEB_URL}/payment/development?authority=${authority}`;
  return`${startBase}/pg/StartPay/${authority}`;
 }

 async verify(authority:string,amount:number){
  const{cfg,merchantId,apiBase}=this.options();
  if(authority.startsWith('dev_')&&!merchantId)return{ok:true,reference:`DEV-${createHash('sha1').update(authority).digest('hex').slice(0,12)}`};
  if(!merchantId)return{ok:false};
  const response=await fetch(`${apiBase}/pg/v4/payment/verify.json`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({merchant_id:merchantId,amount:toRial(amount),authority})});
  const body=await this.body(response);
  const ok=response.ok&&[100,101].includes(body.data?.code??0);
  return{ok,...(ok&&body.data?.ref_id!=null?{reference:String(body.data.ref_id)}:{})};
 }

 private async body(response:Response){
  try{return await response.json()as ZarinpalResponse}catch{throw new BadGatewayException('Zarinpal returned an invalid response')}
 }
}
