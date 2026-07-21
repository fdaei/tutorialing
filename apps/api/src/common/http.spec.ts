import {BadRequestException}from'@nestjs/common';import{ApiExceptionFilter}from'./http';

describe('localized API errors',()=>{
  it('returns Persian validation errors when requested',()=>{
    const json=jest.fn(),status=jest.fn(()=>({json}));
    const host={switchToHttp:()=>({getResponse:()=>({status,getHeader:()=> 'request-id'}),getRequest:()=>({headers:{'accept-language':'fa-IR'},method:'POST',url:'/api/tests'})})};
    new ApiExceptionFilter().catch(new BadRequestException('Attempt is closed'),host as never);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({locale:'fa',message:'این جلسه آزمون بسته شده است.'}));
  });
  it('keeps English errors in English',()=>{
    const json=jest.fn(),status=jest.fn(()=>({json}));
    const host={switchToHttp:()=>({getResponse:()=>({status,getHeader:()=> 'request-id'}),getRequest:()=>({headers:{'accept-language':'en'},method:'POST',url:'/api/tests'})})};
    new ApiExceptionFilter().catch(new BadRequestException('Attempt is closed'),host as never);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({locale:'en',message:'Attempt is closed'}));
  });
});
