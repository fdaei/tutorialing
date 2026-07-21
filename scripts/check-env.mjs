const required=['DATABASE_URL','REDIS_URL','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','WEB_URL','S3_ENDPOINT','S3_ACCESS_KEY','S3_SECRET_KEY','S3_BUCKET','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_DB'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length){console.error(`Blocking: missing environment variables: ${missing.join(', ')}`);process.exit(1)}
if(process.env.JWT_ACCESS_SECRET.length<32||process.env.JWT_REFRESH_SECRET.length<32){console.error('Blocking: JWT secrets must contain at least 32 characters.');process.exit(1)}
let database;
try{database=new URL(process.env.DATABASE_URL)}catch{console.error('Blocking: DATABASE_URL is not a valid URL.');process.exit(1)}
const same=decodeURIComponent(database.username)===process.env.POSTGRES_USER&&decodeURIComponent(database.password)===process.env.POSTGRES_PASSWORD&&database.pathname.slice(1)===process.env.POSTGRES_DB;
if(!same){console.error('Blocking: DATABASE_URL credentials/database do not match Docker Compose PostgreSQL variables.');process.exit(1)}
console.log('Environment validation passed; no secret values were printed.');
