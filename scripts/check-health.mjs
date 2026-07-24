const base=process.env.API_URL||'http://localhost:4001';
try{
 const response=await fetch(`${base}/api/health`),body=await response.json();
 if(!response.ok||body.status!=='ok'||body.database!=='connected')throw new Error('API or database is not healthy');
 console.log(`Health check passed: status=${body.status}, database=${body.database}`);
}catch(error){console.error(`Blocking: health check failed (${error instanceof Error?error.message:'unknown error'}).`);process.exit(1)}
