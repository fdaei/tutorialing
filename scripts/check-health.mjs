const base=process.env.API_URL||'http://localhost:4001';
try{
 const response=await fetch(`${base}/api/health`),body=await response.json();
 // Redis is included because booking takes a distributed lock through it and the
 // rate limiter fails closed without it — a "healthy" API with Redis down cannot
 // take a single booking.
 if(!response.ok||body.status!=='ok'||body.database!=='connected'||body.cache!=='connected')throw new Error(`API is not healthy (database=${body.database}, cache=${body.cache})`);
 console.log(`Health check passed: status=${body.status}, database=${body.database}, cache=${body.cache}`);
}catch(error){console.error(`Blocking: health check failed (${error instanceof Error?error.message:'unknown error'}).`);process.exit(1)}
